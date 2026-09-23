import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ImageKit from 'imagekit';

// Strict Whitelist of allowed media types according to WhatsApp Cloud API standards
export const ALLOWED_MIME_TYPES: Record<string, { ext: string; type: 'IMAGE' | 'VIDEO'; maxSize: number }> = {
  'image/jpeg': { ext: '.jpg', type: 'IMAGE', maxSize: 5 * 1024 * 1024 }, // 5 MB
  'image/jpg': { ext: '.jpg', type: 'IMAGE', maxSize: 5 * 1024 * 1024 },
  'image/png': { ext: '.png', type: 'IMAGE', maxSize: 5 * 1024 * 1024 },
  'image/webp': { ext: '.webp', type: 'IMAGE', maxSize: 5 * 1024 * 1024 },
  'video/mp4': { ext: '.mp4', type: 'VIDEO', maxSize: 50 * 1024 * 1024 }, // 50 MB (Upgraded)
  'video/3gpp': { ext: '.3gp', type: 'VIDEO', maxSize: 50 * 1024 * 1024 }  // 50 MB (Upgraded)
};

export interface MediaUploadResult {
  url: string;
  provider: 'builtin' | 'supabase' | 'imagekit' | 'local';
  fileType: 'IMAGE' | 'VIDEO';
  fileName: string;
  size: number;
  message?: string;
}

export class MediaService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Defensive validation of uploaded file against strict whitelists and file size constraints
   */
  public validateFile(file: Express.Multer.File): { type: 'IMAGE' | 'VIDEO'; ext: string } {
    if (!file) {
      throw new Error('No media file provided for upload.');
    }

    const mime = file.mimetype.toLowerCase();
    const config = ALLOWED_MIME_TYPES[mime];

    if (!config) {
      throw new Error(
        `Unsupported file type (${file.mimetype}). Security policy only permits JPG, PNG, WebP images (max 5MB) and MP4, 3GP videos (max 50MB).`
      );
    }

    if (file.size > config.maxSize) {
      const maxMb = Math.round(config.maxSize / (1024 * 1024));
      throw new Error(
        `File size exceeds WhatsApp limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size for ${config.type.toLowerCase()}s is ${maxMb} MB.`
      );
    }

    return { type: config.type, ext: config.ext };
  }

  /**
   * Process and store media using:
   * 1. Supabase Storage (Free 50 MB per file cloud CDN)
   * 2. Built-in App Storage (Default 0-setup, 50 MB+ supported on app domain / Render)
   * 3. ImageKit (Legacy, max 25 MB on free plan)
   */
  public async uploadMedia(
    file: Express.Multer.File,
    settings: any,
    reqProtocol: string,
    reqHost: string
  ): Promise<MediaUploadResult> {
    const { type, ext } = this.validateFile(file);

    // Cryptographically secure sanitized filename to neutralize path traversal
    const safeBaseName = `${Date.now()}_${uuidv4().substring(0, 8)}`;
    const safeFileName = `${safeBaseName}${ext}`;

    const provider = (settings?.storage_provider || 'BUILTIN').toUpperCase();

    // Read buffer from disk or memory
    const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
    if (!buffer) {
      throw new Error('Could not read file payload for media storage.');
    }

    // ----------------------------------------------------
    // Option A: SUPABASE CLOUD STORAGE (Free 50 MB per file)
    // ----------------------------------------------------
    if (provider === 'SUPABASE') {
      const supabaseUrl = (settings?.supabase_url || process.env.SUPABASE_URL || '').trim();
      const supabaseAnonKey = (settings?.supabase_anon_key || process.env.SUPABASE_ANON_KEY || '').trim();
      const bucket = (settings?.supabase_bucket || 'whatsapp-media').trim();

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const cleanUrl = supabaseUrl.replace(/\/$/, '');
          const endpoint = `${cleanUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(safeFileName)}`;

          const uploadRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': file.mimetype,
              'x-upsert': 'true'
            },
            body: buffer
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Supabase returned HTTP ${uploadRes.status}: ${errText}`);
          }

          const publicCdnUrl = `${cleanUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(safeFileName)}`;

          // Clean up temporary local multer file
          if (file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (e) {}
          }

          return {
            url: publicCdnUrl,
            provider: 'supabase',
            fileType: type,
            fileName: safeFileName,
            size: file.size,
            message: 'Uploaded to Supabase Cloud Storage (50 MB Free Tier). Ready for WhatsApp broadcasting.'
          };
        } catch (supaErr: any) {
          console.warn('Supabase upload failed, falling back to Built-in App Storage:', supaErr.message);
        }
      }
    }

    // ----------------------------------------------------
    // Option B: IMAGEKIT (Legacy - max 25 MB on free plan)
    // ----------------------------------------------------
    if (provider === 'IMAGEKIT') {
      const publicKey = settings?.imagekit_public_key || process.env.IMAGEKIT_PUBLIC_KEY || '';
      const privateKey = settings?.imagekit_private_key || process.env.IMAGEKIT_PRIVATE_KEY || '';
      const urlEndpoint = settings?.imagekit_url_endpoint || process.env.IMAGEKIT_URL_ENDPOINT || '';

      const hasImageKitConfig = publicKey.trim() && privateKey.trim() && urlEndpoint.trim();

      // ImageKit Free Plan rejects files > 25 MB
      if (hasImageKitConfig && file.size <= 25 * 1024 * 1024) {
        try {
          const ik = new ImageKit({
            publicKey: publicKey.trim(),
            privateKey: privateKey.trim(),
            urlEndpoint: urlEndpoint.trim()
          });

          const ikResponse = await ik.upload({
            file: buffer,
            fileName: safeFileName,
            folder: '/whatsapp_crm_templates',
            tags: ['whatsapp_template', type.toLowerCase()]
          });

          if (file.path && fs.existsSync(file.path)) {
            try { fs.unlinkSync(file.path); } catch (e) {}
          }

          return {
            url: ikResponse.url,
            provider: 'imagekit',
            fileType: type,
            fileName: safeFileName,
            size: file.size,
            message: 'Uploaded to ImageKit CDN.'
          };
        } catch (ikErr: any) {
          console.warn('ImageKit upload encountered error, falling back to Built-in App Storage:', ikErr.message);
        }
      } else if (file.size > 25 * 1024 * 1024) {
        console.warn(`File (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds ImageKit free limit (25 MB). Using Built-in App Storage.`);
      }
    }

    // ----------------------------------------------------
    // Option C: BUILT-IN APP STORAGE (Recommended, 0 Setup, 50 MB+)
    // ----------------------------------------------------
    const localDestination = path.join(this.uploadsDir, safeFileName);

    if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, localDestination);
      try { fs.unlinkSync(file.path); } catch (e) {}
    } else {
      fs.writeFileSync(localDestination, buffer);
    }

    // If a production public URL is specified in settings (e.g. https://your-app.onrender.com), use it!
    const publicBase = settings?.public_url?.trim()
      ? settings.public_url.trim().replace(/\/$/, '')
      : `${reqProtocol}://${reqHost}`;

    const directUrl = `${publicBase}/uploads/${safeFileName}`;

    return {
      url: directUrl,
      provider: 'builtin',
      fileType: type,
      fileName: safeFileName,
      size: file.size,
      message: 'Stored in Built-in App Storage. (Supports 50 MB videos with zero external accounts).'
    };
  }

  /**
   * Verify Supabase credentials and bucket accessibility
   */
  public async testSupabaseConnection(
    supabaseUrl: string,
    anonKey: string,
    bucket: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!supabaseUrl?.trim() || !anonKey?.trim()) {
        return { success: false, message: 'Supabase URL and Anon/Public Key are required.' };
      }

      const cleanUrl = supabaseUrl.trim().replace(/\/$/, '');
      const cleanBucket = (bucket || 'whatsapp-media').trim();
      const testEndpoint = `${cleanUrl}/storage/v1/bucket/${encodeURIComponent(cleanBucket)}`;

      const res = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'apikey': anonKey.trim(),
          'Authorization': `Bearer ${anonKey.trim()}`
        }
      });

      if (res.ok) {
        return {
          success: true,
          message: `Connected to Supabase bucket "${cleanBucket}"! 50 MB file support is active.`
        };
      }

      // Check general storage endpoint
      const listRes = await fetch(`${cleanUrl}/storage/v1/bucket`, {
        headers: {
          'apikey': anonKey.trim(),
          'Authorization': `Bearer ${anonKey.trim()}`
        }
      });

      if (listRes.ok) {
        return {
          success: true,
          message: `Connected to Supabase! Note: Ensure bucket "${cleanBucket}" is created with "Public" access.`
        };
      }

      return {
        success: false,
        message: `Supabase authentication error (HTTP ${res.status}). Check your Project URL and Anon Key.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Could not connect to Supabase: ${err.message}`
      };
    }
  }

  /**
   * Verify ImageKit credentials without saving invalid keys
   */
  public async testImageKitConnection(
    publicKey: string,
    privateKey: string,
    urlEndpoint: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!publicKey?.trim() || !privateKey?.trim() || !urlEndpoint?.trim()) {
        return { success: false, message: 'All three ImageKit fields (Public Key, Private Key, URL Endpoint) are required.' };
      }

      const ik = new ImageKit({
        publicKey: publicKey.trim(),
        privateKey: privateKey.trim(),
        urlEndpoint: urlEndpoint.trim()
      });

      await ik.listFiles({ limit: 1 });
      return {
        success: true,
        message: `Connected to ImageKit! (Note: free plan max file size is 25 MB).`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `ImageKit authentication failed: ${err.message || 'Invalid credentials'}`
      };
    }
  }
}

export const mediaService = new MediaService();
