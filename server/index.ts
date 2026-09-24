import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import db, { initDatabase, purgeLegacyDummyData } from './db.ts';
import { eventEmitter } from './services/eventBus.ts';
import { metaService } from './services/metaService.ts';
import { simulationService } from './services/simulationService.ts';
import { broadcastQueue } from './services/broadcastQueue.ts';
import { mediaService, ALLOWED_MIME_TYPES } from './services/mediaService.ts';
import { retentionService } from './services/retentionService.ts';
import { cloudSyncService } from './services/cloudSyncService.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Automatically trigger background cloud backup after any successful data modification
app.use((req, res, next) => {
  res.on('finish', () => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode < 400 && (req.path.startsWith('/api/') || req.path.startsWith('/webhook'))) {
      cloudSyncService.scheduleBackup();
    }
  });
  next();
});

// Ensure upload directory exists
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded media statically with anti-MIME-sniffing protection
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(uploadsDir));

// Defensive Multer configuration: supports media up to 55 MB (accommodating 50 MB videos)
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 55 * 1024 * 1024 // 55 MB max
  },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (ALLOWED_MIME_TYPES[mime]) {
      cb(null, true);
    } else {
      cb(new Error(`Security block: Unsupported file format "${file.mimetype}". Only JPG, PNG, WebP images (max 5MB) and MP4, 3GP videos (max 50MB) are allowed.`));
    }
  }
});

// Initialize database and restore from cloud snapshot if available
initDatabase();
cloudSyncService.restoreFromSupabaseOnBoot().then(() => {
  purgeLegacyDummyData();
});

// Database Backup & Restore Endpoints
app.get('/api/backup/export', (req: Request, res: Response) => {
  try {
    const snapshot = cloudSyncService.exportFullDatabase();
    res.setHeader('Content-Disposition', `attachment; filename="intelligreen-crm-backup-${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/import', (req: Request, res: Response) => {
  try {
    cloudSyncService.importFullDatabase(req.body);
    cloudSyncService.scheduleBackup();
    res.json({ success: true, message: 'Database restored successfully!' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/backup/restore-cloud', async (req: Request, res: Response) => {
  try {
    const restored = await cloudSyncService.restoreFromSupabaseOnBoot();
    if (restored) {
      res.json({ success: true, message: 'Restored latest snapshot from Supabase Cloud Storage!' });
    } else {
      res.status(404).json({ error: 'No snapshot found in Supabase bucket or credentials not set.' });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 1. SETTINGS & MEDIA UPLOAD ENDPOINTS
// ----------------------------------------------------
app.get('/api/settings', (req: Request, res: Response) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settings);
});

app.post('/api/settings', async (req: Request, res: Response) => {
  const {
    mode,
    waba_id,
    phone_number_id,
    access_token,
    webhook_verify_token,
    quality_rating,
    messaging_tier,
    imagekit_public_key,
    imagekit_private_key,
    imagekit_url_endpoint,
    storage_provider,
    supabase_url,
    supabase_anon_key,
    supabase_bucket,
    public_url
  } = req.body;

  const current = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

  let sanitizedToken: string | undefined = undefined;
  if (access_token !== undefined) {
    if (typeof access_token === 'string') {
      sanitizedToken = access_token.replace(/^Bearer\s+/i, '').replace(/\s+/g, '').trim();
    } else {
      sanitizedToken = '';
    }
  }

  const newMode = mode !== undefined ? mode : current.mode;
  const newWabaId = waba_id !== undefined ? (typeof waba_id === 'string' ? waba_id.trim() : waba_id) : current.waba_id;
  const newPhoneNumberId = phone_number_id !== undefined ? (typeof phone_number_id === 'string' ? phone_number_id.trim() : phone_number_id) : current.phone_number_id;
  const newAccessToken = sanitizedToken !== undefined ? sanitizedToken : current.access_token;
  const newWebhookToken = webhook_verify_token !== undefined ? (typeof webhook_verify_token === 'string' ? webhook_verify_token.trim() : webhook_verify_token) : current.webhook_verify_token;
  const newQualityRating = quality_rating !== undefined ? quality_rating : current.quality_rating;
  const newMessagingTier = messaging_tier !== undefined ? messaging_tier : current.messaging_tier;
  const newImagekitPublicKey = imagekit_public_key !== undefined ? imagekit_public_key : current.imagekit_public_key;
  const newImagekitPrivateKey = imagekit_private_key !== undefined ? imagekit_private_key : current.imagekit_private_key;
  const newImagekitUrlEndpoint = imagekit_url_endpoint !== undefined ? imagekit_url_endpoint : current.imagekit_url_endpoint;
  const newStorageProvider = storage_provider !== undefined ? storage_provider : current.storage_provider;
  const newSupabaseUrl = supabase_url !== undefined ? supabase_url : current.supabase_url;
  const newSupabaseAnonKey = supabase_anon_key !== undefined ? supabase_anon_key : current.supabase_anon_key;
  const newSupabaseBucket = supabase_bucket !== undefined ? supabase_bucket : current.supabase_bucket;
  const newPublicUrl = public_url !== undefined ? public_url : current.public_url;

  db.prepare(`
    UPDATE settings
    SET mode = ?,
        waba_id = ?,
        phone_number_id = ?,
        access_token = ?,
        webhook_verify_token = ?,
        quality_rating = ?,
        messaging_tier = ?,
        imagekit_public_key = ?,
        imagekit_private_key = ?,
        imagekit_url_endpoint = ?,
        storage_provider = ?,
        supabase_url = ?,
        supabase_anon_key = ?,
        supabase_bucket = ?,
        public_url = ?,
        updated_at = ?
    WHERE id = 1
  `).run(
    newMode,
    newWabaId,
    newPhoneNumberId,
    newAccessToken,
    newWebhookToken,
    newQualityRating,
    newMessagingTier,
    newImagekitPublicKey,
    newImagekitPrivateKey,
    newImagekitUrlEndpoint,
    newStorageProvider,
    newSupabaseUrl,
    newSupabaseAnonKey,
    newSupabaseBucket,
    newPublicUrl,
    Date.now()
  );

  const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  // Auto-subscribe the WABA to this app so inbound messages are never missed
  if (newMode === 'LIVE' && newWabaId && newAccessToken) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${newWabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${newAccessToken}` }
      });
    } catch {
      // background subscription attempt
    }
  }

  res.json(updated);
});

// Endpoint to test Meta WhatsApp credentials & token validity
app.post('/api/settings/test-meta', async (req: Request, res: Response) => {
  try {
    const { access_token, phone_number_id, waba_id } = req.body;
    const current = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

    let tokenToTest = access_token !== undefined ? access_token : current?.access_token;
    if (typeof tokenToTest === 'string') {
      tokenToTest = tokenToTest.replace(/^Bearer\s+/i, '').replace(/\s+/g, '').trim();
    }
    const phoneIdToTest = (phone_number_id !== undefined ? phone_number_id : current?.phone_number_id || '').trim();

    if (!tokenToTest) {
      return res.status(400).json({
        success: false,
        message: 'No access token provided. Please paste your Meta Access Token first.'
      });
    }

    const targetId = phoneIdToTest || 'me';
    const phoneUrl = `https://graph.facebook.com/v21.0/${targetId}?access_token=${encodeURIComponent(tokenToTest)}&fields=id,verified_name,display_phone_number,quality_rating,code_verification_status`;

    let phoneInfo: any = null;
    let metaError: any = null;

    try {
      const response = await fetch(phoneUrl);
      const data = await response.json();
      if (data.error) {
        metaError = data.error;
      } else {
        phoneInfo = data;
      }
    } catch (e: any) {
      metaError = { message: e.message || 'Network error reaching Meta Graph API' };
    }

    if (metaError) {
      let friendlyHint = '';
      const errMsg = metaError.message || '';
      const errCode = metaError.code;

      if (errMsg.includes('could not be decrypted') || errMsg.includes('Cannot parse access token')) {
        friendlyHint = 'The token is corrupted or incomplete. Please click "Clear", copy the token fresh from Meta, and click "Paste".';
      } else if (errMsg.includes('Session has expired') || errMsg.includes('expired') || errCode === 190) {
        friendlyHint = 'This token has expired (Meta temporary developer tokens expire in 24 hours). Please copy a fresh token or create a Permanent System User Token.';
      } else if (errMsg.includes('Unsupported get request') || errCode === 100) {
        friendlyHint = 'Phone Number ID is incorrect or not permitted for this token.';
      }

      return res.json({
        success: false,
        error_code: errCode,
        error_message: errMsg,
        hint: friendlyHint,
        message: `Meta Authentication Error: ${errMsg}${friendlyHint ? ` (${friendlyHint})` : ''}`
      });
    }

    // Try debug_token to check expiration and token type
    let tokenDebugInfo: any = null;
    try {
      const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(tokenToTest)}&access_token=${encodeURIComponent(tokenToTest)}`;
      const debugRes = await fetch(debugUrl);
      const debugData = await debugRes.json();
      if (debugData.data) {
        tokenDebugInfo = debugData.data;
      }
    } catch {
      // debug_token is optional
    }

    let expiryDesc = 'Valid';
    if (tokenDebugInfo?.expires_at) {
      if (tokenDebugInfo.expires_at === 0) {
        expiryDesc = 'Permanent (Never expires)';
      } else {
        const d = new Date(tokenDebugInfo.expires_at * 1000);
        const hoursLeft = Math.max(0, Math.round((d.getTime() - Date.now()) / (1000 * 3600)));
        expiryDesc = `Expires in ~${hoursLeft}h (${d.toLocaleTimeString()})`;
      }
    }

    // Auto-subscribe the WABA to this app to ensure inbound messages work
    const wabaIdToTest = (waba_id !== undefined ? waba_id : current?.waba_id || '').trim();
    if (wabaIdToTest && tokenToTest) {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${wabaIdToTest}/subscribed_apps`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToTest}` }
        });
      } catch {
        // subscription attempt
      }
    }

    return res.json({
      success: true,
      phone_info: phoneInfo,
      token_info: tokenDebugInfo,
      expiry_desc: expiryDesc,
      message: `Meta API Connected! Number: ${phoneInfo.display_phone_number || phoneInfo.id} (${phoneInfo.verified_name || 'Verified'}) • ${expiryDesc}`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal error verifying Meta credentials'
    });
  }
});

// Endpoint to test Supabase Storage bucket connection
app.post('/api/settings/test-supabase', async (req: Request, res: Response) => {
  const { url, anonKey, bucket } = req.body;
  const result = await mediaService.testSupabaseConnection(url, anonKey, bucket);
  res.json(result);
});

// Endpoint to test ImageKit API keys without persisting invalid values
app.post('/api/settings/test-imagekit', async (req: Request, res: Response) => {
  const { publicKey, privateKey, urlEndpoint } = req.body;
  const result = await mediaService.testImageKitConnection(publicKey, privateKey, urlEndpoint);
  res.json(result);
});

// Secure media upload endpoint (supports local file upload from UI)
app.post('/api/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided.' });
    }

    try {
      const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
      const protocol = req.protocol;
      const host = req.get('host') || `localhost:${PORT}`;

      const result = await mediaService.uploadMedia(req.file, settings, protocol, host);
      return res.json(result);
    } catch (uploadErr: any) {
      return res.status(500).json({ error: uploadErr.message });
    }
  });
});

// ----------------------------------------------------
// 2. TEMPLATE STUDIO ENDPOINTS
// ----------------------------------------------------
app.get('/api/templates', (req: Request, res: Response) => {
  const templates = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
  res.json(templates);
});

app.post('/api/templates', async (req: Request, res: Response) => {
  try {
    const {
      name,
      category,
      language = 'en_US',
      header_type = 'NONE',
      header_content = '',
      body_text,
      footer_text = '',
      buttons = [],
      sample_values = [],
      submit_immediately = true
    } = req.body;

    if (!name || !category || !body_text) {
      return res.status(400).json({ error: 'Name, category, and body text are required.' });
    }

    const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    if (cleanName === 'hello_world') {
      return res.status(400).json({
        error: "'hello_world' is a reserved system template on Meta and is already pre-approved for your account! You do not need to create it. Please use a custom name like 'intelligreen_promo' instead."
      });
    }

    const existing = db.prepare('SELECT id FROM templates WHERE name = ?').get(cleanName);
    if (existing) {
      return res.status(400).json({ error: 'A template with this name already exists.' });
    }

    const id = uuidv4();
    const now = Date.now();
    const status = submit_immediately ? 'PENDING' : 'DRAFT';

    db.prepare(`
      INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanName,
      category,
      language,
      header_type,
      header_content,
      body_text,
      footer_text,
      JSON.stringify(buttons),
      JSON.stringify(sample_values),
      status,
      now,
      now
    );

    const createdTemplate = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

    if (submit_immediately) {
      if (settings.mode === 'SIMULATION') {
        simulationService.simulateTemplateSubmission(id);
      } else {
        try {
          const metaRes = await metaService.submitTemplateToMeta(createdTemplate, settings);
          if (metaRes?.id) {
            db.prepare('UPDATE templates SET meta_template_id = ? WHERE id = ?').run(metaRes.id, id);
          }
        } catch (metaErr: any) {
          console.error('Meta API template error:', metaErr.response?.data || metaErr.message);
          db.prepare('UPDATE templates SET status = ?, rejection_reason = ? WHERE id = ?')
            .run('REJECTED', metaErr.response?.data?.error?.message || 'Submission error', id);
        }
      }
    }

    const result = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates/:id/submit', async (req: Request, res: Response) => {
  const { id } = req.params;
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

  if (settings.mode === 'SIMULATION') {
    simulationService.simulateTemplateSubmission(id);
    return res.json({ message: 'Template submitted to Meta Simulation Engine. Verification in progress...' });
  } else {
    try {
      const metaRes = await metaService.submitTemplateToMeta(template, settings);
      db.prepare('UPDATE templates SET status = ?, meta_template_id = ? WHERE id = ?')
        .run('PENDING', metaRes?.id || '', id);
      return res.json({ message: 'Template submitted to Meta Graph API.', meta_id: metaRes?.id });
    } catch (err: any) {
      return res.status(400).json({ error: err.response?.data?.error?.message || err.message });
    }
  }
});

// Sync templates directly from Meta WhatsApp Business Account
app.post('/api/templates/sync', async (req: Request, res: Response) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    if (!settings.waba_id || !settings.access_token) {
      return res.status(400).json({ error: 'Meta WABA ID and Access Token must be configured in Settings to sync templates.' });
    }

    const metaData = await metaService.fetchTemplates(settings);
    const templates = metaData?.data || [];
    let syncedCount = 0;

    for (const tpl of templates) {
      const name = tpl.name;
      const language = tpl.language || 'en_US';
      const category = tpl.category || 'UTILITY';
      const status = tpl.status || 'APPROVED';
      const metaTemplateId = String(tpl.id || '');

      let bodyText = '';
      let headerType = 'NONE';
      let headerContent = '';
      let footerText = '';
      const buttons: any[] = [];
      const sampleValues: string[] = [];

      if (Array.isArray(tpl.components)) {
        for (const comp of tpl.components) {
          if (comp.type === 'HEADER') {
            headerType = comp.format || 'TEXT';
            headerContent = comp.text || '';
          } else if (comp.type === 'BODY') {
            bodyText = comp.text || '';
            if (comp.example?.body_text?.[0]) {
              sampleValues.push(...comp.example.body_text[0]);
            }
          } else if (comp.type === 'FOOTER') {
            footerText = comp.text || '';
          } else if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
            buttons.push(...comp.buttons);
          }
        }
      }

      const existing = db.prepare('SELECT id FROM templates WHERE name = ?').get(name) as any;
      const now = Date.now();

      if (existing) {
        db.prepare(`
          UPDATE templates 
          SET status = ?, rejection_reason = '', meta_template_id = ?, category = ?, language = ?, body_text = ?, header_type = ?, header_content = ?, footer_text = ?, buttons_json = ?, sample_values_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
          status, 
          metaTemplateId, 
          category, 
          language, 
          bodyText || existing.body_text || ' ', 
          headerType, 
          headerContent, 
          footerText, 
          JSON.stringify(buttons), 
          JSON.stringify(sampleValues), 
          now, 
          existing.id
        );
      } else {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, meta_template_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          name, 
          category, 
          language, 
          headerType, 
          headerContent, 
          bodyText || ' ', 
          footerText, 
          JSON.stringify(buttons), 
          JSON.stringify(sampleValues), 
          status, 
          metaTemplateId, 
          now, 
          now
        );
      }
      syncedCount++;
    }

    const allTemplates = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
    return res.json({ success: true, syncedCount, templates: allTemplates });
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    return res.status(400).json({ error: `Failed to sync templates from Meta: ${errorMsg}` });
  }
});

app.delete('/api/templates/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  res.json({ success: true });
});

// Send single test template message directly to a personal WhatsApp phone number
app.post('/api/templates/:id/send-test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { phone_number, variables = {} } = req.body;

    if (!phone_number || !phone_number.trim()) {
      return res.status(400).json({ error: 'Please enter a valid phone number with country code (e.g. +919876543210).' });
    }

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    const cleanPhone = phone_number.trim();

    if (settings.mode === 'SIMULATION') {
      // In simulation mode: log to contacts and chat conversation so it appears in the Query Tab
      let contact = db.prepare('SELECT * FROM contacts WHERE phone_number = ?').get(cleanPhone) as any;
      if (!contact) {
        const contactId = uuidv4();
        db.prepare('INSERT INTO contacts (id, name, phone_number, created_at) VALUES (?, ?, ?, ?)')
          .run(contactId, 'Test Phone User', cleanPhone, Date.now());
        contact = { id: contactId, name: 'Test Phone User', phone_number: cleanPhone };
      }

      let conv = db.prepare('SELECT * FROM conversations WHERE contact_id = ?').get(contact.id) as any;
      if (!conv) {
        const convId = uuidv4();
        db.prepare(`
          INSERT INTO conversations (id, contact_id, contact_name, phone_number, last_message_text, last_message_at, service_window_expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(convId, contact.id, contact.name, contact.phone_number, template.body_text, Date.now(), Date.now() + 24 * 3600 * 1000);
        conv = { id: convId };
      }

      const msgId = uuidv4();
      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, media_url, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, conv.id, 'OUTBOUND', 'template', template.body_text, template.header_content || '', 'delivered', Date.now());

      eventEmitter.emit('new_chat_message', {
        id: msgId,
        conversation_id: conv.id,
        direction: 'OUTBOUND',
        content: template.body_text
      });

      return res.json({
        success: true,
        mode: 'SIMULATION',
        message: `[Test Sandbox] Message dispatched to ${cleanPhone}. To receive this on your real physical phone, enter your free Meta test credentials in Settings and toggle to Live Meta API.`
      });
    } else {
      // LIVE MODE: Real Meta Graph API dispatch straight to user's personal WhatsApp phone!
      try {
        const metaRes = await metaService.sendTemplateMessage(cleanPhone, template, variables, settings);

        // Record in CRM database so message appears in the Query/Inbox tab
        let contact = db.prepare('SELECT * FROM contacts WHERE phone_number = ?').get(cleanPhone) as any;
        if (!contact) {
          const contactId = uuidv4();
          db.prepare('INSERT INTO contacts (id, name, phone_number, created_at) VALUES (?, ?, ?, ?)')
            .run(contactId, 'Live Test User', cleanPhone, Date.now());
          contact = { id: contactId, name: 'Live Test User', phone_number: cleanPhone };
        }

        let conv = db.prepare('SELECT * FROM conversations WHERE contact_id = ?').get(contact.id) as any;
        if (!conv) {
          const convId = uuidv4();
          db.prepare(`
            INSERT INTO conversations (id, contact_id, contact_name, phone_number, last_message_text, last_message_at, service_window_expires_at)
            VALUES (?, ?, ?, ?, ?, ?, 0)
          `).run(convId, contact.id, contact.name, contact.phone_number, template.body_text, Date.now());
          conv = { id: convId };
        }

        const msgId = uuidv4();
        const wamid = metaRes?.messages?.[0]?.id || '';
        db.prepare(`
          INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, media_url, status, timestamp, wamid)
          VALUES (?, ?, 'OUTBOUND', 'template', ?, ?, 'sent', ?, ?)
        `).run(msgId, conv.id, template.body_text, template.header_content || '', Date.now(), wamid);

        eventEmitter.emit('new_chat_message', {
          id: msgId,
          conversation_id: conv.id,
          direction: 'OUTBOUND',
          content: template.body_text
        });

        return res.json({
          success: true,
          mode: 'LIVE',
          meta_response: metaRes,
          message: `Success! Template delivered directly to your WhatsApp at ${cleanPhone} via Meta Cloud API.`
        });
      } catch (err: any) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        return res.status(400).json({
          success: false,
          error: `Meta delivery error: ${errorMsg} (Hint: If using a Meta Developer Test Number, verify that ${cleanPhone} is added to your recipient list in the Meta App Dashboard).`
        });
      }
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. CONTACTS & AUDIENCE ENDPOINTS
// ----------------------------------------------------
app.get('/api/contacts', (req: Request, res: Response) => {
  const { search, tag, optedOut, limit = 25, offset = 0 } = req.query;

  let whereClause = ' WHERE 1=1';
  const filterParams: any[] = [];

  if (search) {
    whereClause += ' AND (name LIKE ? OR phone_number LIKE ?)';
    filterParams.push(`%${search}%`, `%${search}%`);
  }
  if (tag && tag !== 'ALL') {
    whereClause += ' AND tags LIKE ?';
    filterParams.push(`%${tag}%`);
  }
  if (optedOut !== undefined) {
    whereClause += ' AND is_opted_out = ?';
    filterParams.push(optedOut === 'true' ? 1 : 0);
  }

  const countQuery = `SELECT COUNT(*) as filteredTotal FROM contacts${whereClause}`;
  const filteredTotal = (db.prepare(countQuery).get(...filterParams) as { filteredTotal: number }).filteredTotal;

  const dataQuery = `SELECT * FROM contacts${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const contacts = db.prepare(dataQuery).all(...filterParams, Number(limit), Number(offset));

  const totalCountRow = db.prepare('SELECT COUNT(*) as total FROM contacts').get() as { total: number };
  const optedOutCountRow = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE is_opted_out = 1').get() as { count: number };

  res.json({
    contacts,
    total: totalCountRow.total,
    filteredTotal,
    optedOutCount: optedOutCountRow.count,
    activeCount: totalCountRow.total - optedOutCountRow.count
  });
});

// Fetch distinct tags across all contacts
app.get('/api/contacts/tags', (req: Request, res: Response) => {
  const rows = db.prepare("SELECT DISTINCT tags FROM contacts WHERE tags IS NOT NULL AND tags != ''").all() as { tags: string }[];
  const tagSet = new Set<string>();
  for (const r of rows) {
    r.tags.split(',').forEach(t => {
      const trimmed = t.trim();
      if (trimmed) tagSet.add(trimmed);
    });
  }
  res.json(Array.from(tagSet).sort());
});

app.post('/api/contacts', (req: Request, res: Response) => {
  const { name, phone_number, variables = {}, tags = 'General' } = req.body;
  if (!name || !phone_number) {
    return res.status(400).json({ error: 'Name and Phone Number are required.' });
  }

  const trimmedName = name.trim();
  let rawDigits = phone_number.replace(/[^0-9]/g, '');
  if (!rawDigits || rawDigits.length < 7) {
    return res.status(400).json({ error: 'Please enter a valid phone number with country code (e.g. +919876543210).' });
  }

  // Strip leading zero if 11 digits (e.g. 09876543210 -> 919876543210)
  if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
    rawDigits = '91' + rawDigits.slice(1);
  } else if (rawDigits.length === 10) {
    // Auto-prefix Indian country code if user entered 10 digits
    rawDigits = '91' + rawDigits;
  }
  const cleanPhone = `+${rawDigits}`;

  try {
    // Check if contact already exists by full number, digits, or last 10 digits
    const existing = db.prepare(
      'SELECT * FROM contacts WHERE phone_number = ? OR phone_number = ? OR phone_number LIKE ?'
    ).get(cleanPhone, rawDigits, `%${rawDigits.slice(-10)}`) as any;

    if (existing) {
      // Upsert: update the existing contact's name, tags, and variables seamlessly
      db.prepare(`
        UPDATE contacts
        SET name = ?, tags = ?, variables_json = ?
        WHERE id = ?
      `).run(trimmedName, tags, JSON.stringify(variables), existing.id);

      // Also update contact_name in any active conversations so Queries tab displays the proper name
      db.prepare('UPDATE conversations SET contact_name = ? WHERE contact_id = ?')
        .run(trimmedName, existing.id);

      const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(existing.id);
      return res.json(updated);
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO contacts (id, name, phone_number, variables_json, tags, is_opted_out, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, trimmedName, cleanPhone, JSON.stringify(variables), tags, Date.now());

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to save contact.' });
  }
});

app.post('/api/contacts/:id/toggle-opt-out', (req: Request, res: Response) => {
  const { id } = req.params;
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as any;
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const newStatus = contact.is_opted_out === 1 ? 0 : 1;
  const optedOutAt = newStatus === 1 ? Date.now() : null;

  db.prepare('UPDATE contacts SET is_opted_out = ?, opted_out_at = ? WHERE id = ?')
    .run(newStatus, optedOutAt, id);

  res.json({ success: true, is_opted_out: newStatus });
});

// Delete a single contact
app.delete('/api/contacts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  res.json({ success: true, message: 'Contact deleted successfully.' });
});

const handleClearAllContacts = (req: Request, res: Response) => {
  const passkey = req.body?.passkey || req.query?.passkey;
  const REQUIRED_PASSKEY = process.env.SECURITY_PASSKEY || 'HelloIntelligreen';

  if (!passkey || String(passkey).trim() !== REQUIRED_PASSKEY) {
    return res.status(401).json({
      error: 'Invalid security passkey. Please enter the correct passkey (e.g. HelloIntelligreen) to delete all contacts.'
    });
  }

  try {
    const clearTransaction = db.transaction(() => {
      db.prepare('DELETE FROM contacts').run();
      db.prepare('DELETE FROM conversations').run();
      db.prepare('DELETE FROM campaign_messages').run();
      db.prepare('DELETE FROM chat_messages').run();
    });
    clearTransaction();

    try {
      db.pragma('incremental_vacuum');
    } catch {}

    res.json({ success: true, message: 'All contacts and related conversations cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear contacts' });
  }
};

app.post('/api/contacts/clear-all', handleClearAllContacts);
app.delete('/api/contacts/clear-all', handleClearAllContacts);

// ----------------------------------------------------
// 4. BROADCAST & CAMPAIGN ENGINE ENDPOINTS
// ----------------------------------------------------
app.get('/api/campaigns', (req: Request, res: Response) => {
  const campaigns = db.prepare(`
    SELECT c.*, t.name as template_name, t.category as template_category, t.header_type
    FROM campaigns c
    JOIN templates t ON c.template_id = t.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(campaigns);
});

app.get('/api/campaigns/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = db.prepare(`
    SELECT c.*, t.name as template_name, t.body_text, t.header_type, t.header_content
    FROM campaigns c
    JOIN templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(id);

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const messages = db.prepare(`
    SELECT * FROM campaign_messages WHERE campaign_id = ? ORDER BY rowid DESC LIMIT 100
  `).all(id);

  res.json({ campaign, messages });
});

app.post('/api/campaigns', (req: Request, res: Response) => {
  const { name, template_id, messages_per_second = 5, target_tags } = req.body;

  if (!name || !template_id) {
    return res.status(400).json({ error: 'Campaign name and approved template are required.' });
  }

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(template_id) as any;
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (template.status !== 'APPROVED') {
    return res.status(400).json({ error: 'Only APPROVED templates can be broadcasted.' });
  }

  // Fetch eligible contacts
  let contactQuery = 'SELECT * FROM contacts WHERE is_opted_out = 0';
  const params: any[] = [];
  if (target_tags && target_tags !== 'ALL') {
    contactQuery += ' AND tags LIKE ?';
    params.push(`%${target_tags}%`);
  }

  const eligibleContacts = db.prepare(contactQuery).all(...params) as any[];
  const optedOutCountRow = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE is_opted_out = 1').get() as { count: number };

  if (eligibleContacts.length === 0) {
    return res.status(400).json({ error: 'No active eligible contacts found for this campaign.' });
  }

  const campaignId = uuidv4();
  const now = Date.now();

  db.prepare(`
    INSERT INTO campaigns (id, name, template_id, total_contacts, suppressed_count, status, messages_per_second, created_at)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(campaignId, name, template_id, eligibleContacts.length, optedOutCountRow.count, messages_per_second, now);

  const insertMsg = db.prepare(`
    INSERT INTO campaign_messages (id, campaign_id, contact_id, phone_number, contact_name, status)
    VALUES (?, ?, ?, ?, ?, 'queued')
  `);

  const insertMany = db.transaction(() => {
    for (const c of eligibleContacts) {
      insertMsg.run(uuidv4(), campaignId, c.id, c.phone_number, c.name);
    }
  });
  insertMany();

  res.json({
    id: campaignId,
    name,
    totalContacts: eligibleContacts.length,
    suppressedOptOuts: optedOutCountRow.count
  });
});

app.post('/api/campaigns/:id/start', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await broadcastQueue.startCampaign(id);
    res.json({ success: true, message: 'Broadcast initiated with rate-limiting.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/pause', (req: Request, res: Response) => {
  const { id } = req.params;
  broadcastQueue.pauseCampaign(id);
  res.json({ success: true, message: 'Campaign paused.' });
});

app.post('/api/campaigns/:id/stop', (req: Request, res: Response) => {
  const { id } = req.params;
  broadcastQueue.stopCampaign(id);
  res.json({ success: true, message: 'Campaign stopped.' });
});

// ----------------------------------------------------
// 5. QUERY TAB / LIVE INBOX ENDPOINTS
// ----------------------------------------------------
app.get('/api/conversations', (req: Request, res: Response) => {
  const conversations = db.prepare(`
    SELECT c.*, ct.is_opted_out, ct.tags
    FROM conversations c
    JOIN contacts ct ON c.contact_id = ct.id
    ORDER BY c.last_message_at DESC
  `).all();
  res.json(conversations);
});

app.get('/api/conversations/:id/messages', (req: Request, res: Response) => {
  const { id } = req.params;
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  // Reset unread count
  db.prepare('UPDATE conversations SET unread_count = 0 WHERE id = ?').run(id);

  const messages = db.prepare(`
    SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY timestamp ASC
  `).all(id);

  res.json({ conversation, messages });
});

app.post('/api/conversations/:id/reply', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { text = '', media_url = '', media_type = '' } = req.body;
  if (!text.trim() && !media_url) {
    return res.status(400).json({ error: 'Message text or media attachment is required' });
  }

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const now = Date.now();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

  // Check 24-hour customer service window
  const isWindowActive = conversation.service_window_expires_at > now;
  if (!isWindowActive) {
    return res.status(403).json({
      error: '24-hour Customer Service Window has expired. Under Meta policies, you can only send an approved Template Message, not a freeform reply.'
    });
  }

  const msgId = uuidv4();
  const messageType = media_url ? (media_type || (media_url.match(/\.(mp4|webm|mov)/i) ? 'video' : 'image')) : 'text';
  const finalContent = text.trim() || (messageType === 'video' ? '🎥 Video' : messageType === 'image' ? '📷 Image' : 'Attachment');

  if (settings.mode === 'SIMULATION') {
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, media_url, status, timestamp)
      VALUES (?, ?, 'OUTBOUND', ?, ?, ?, 'delivered', ?)
    `).run(msgId, id, messageType, finalContent, media_url, now);

    db.prepare(`
      UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?
    `).run(finalContent, now, id);
  } else {
    try {
      const metaRes = await metaService.sendFreeformMessage(conversation.phone_number, text.trim(), settings, media_url, messageType);
      const wamid = metaRes?.messages?.[0]?.id || '';

      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, media_url, status, timestamp, wamid)
        VALUES (?, ?, 'OUTBOUND', ?, ?, ?, 'sent', ?, ?)
      `).run(msgId, id, messageType, finalContent, media_url, now, wamid);

      db.prepare(`
        UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?
      `).run(finalContent, now, id);
    } catch (err: any) {
      const metaErr = err.response?.data?.error;
      const statusCode = err.response?.status === 401 ? 401 : 500;
      let errorMsg = metaErr?.message || err.message;
      if (metaErr?.code === 190 || errorMsg?.toLowerCase().includes('authentication') || errorMsg?.toLowerCase().includes('token')) {
        errorMsg = 'Meta Access Token has expired (developer tokens expire after 24 hours). Please copy a fresh token from Meta Developer Portal or configure a Permanent System User Token in Settings.';
      }
      return res.status(statusCode).json({ error: errorMsg, code: metaErr?.code || 500 });
    }
  }

  eventEmitter.emit('new_chat_message', {
    conversationId: id,
    direction: 'OUTBOUND',
    text: finalContent,
    media_url,
    message_type: messageType
  });
  res.json({ success: true, messageId: msgId });
});

// Dispatch an approved Template message directly within a conversation (even when 24h window is closed)
app.post('/api/conversations/:id/send-template', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { template_id, variables = {} } = req.body;

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(template_id) as any;
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  const now = Date.now();
  const msgId = uuidv4();

  let wamid = '';
  if (settings.mode === 'LIVE') {
    try {
      const metaRes = await metaService.sendTemplateMessage(conversation.phone_number, template, variables, settings);
      wamid = metaRes?.messages?.[0]?.id || '';
    } catch (err: any) {
      const metaErr = err.response?.data?.error;
      const statusCode = err.response?.status === 401 ? 401 : 400;
      let errorMsg = metaErr?.message || err.message;
      if (metaErr?.code === 190 || errorMsg?.toLowerCase().includes('token')) {
        errorMsg = 'Meta Access Token has expired. Please update it in Settings.';
      }
      return res.status(statusCode).json({ error: errorMsg });
    }
  }

  db.prepare(`
    INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, media_url, status, timestamp, wamid)
    VALUES (?, ?, 'OUTBOUND', 'template', ?, ?, ?, ?, ?)
  `).run(msgId, id, template.body_text, template.header_content || '', settings.mode === 'LIVE' ? 'sent' : 'delivered', now, wamid);

  db.prepare(`
    UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?
  `).run(template.body_text, now, id);

  eventEmitter.emit('new_chat_message', {
    id: msgId,
    conversation_id: id,
    direction: 'OUTBOUND',
    content: template.body_text,
    message_type: 'template',
    media_url: template.header_content || '',
    status: settings.mode === 'LIVE' ? 'sent' : 'delivered',
    wamid
  });

  res.json({ success: true, messageId: msgId, wamid });
});

// Trigger or verify 7-day auto-retention cleanup of old chat history
app.post('/api/conversations/prune-history', (req: Request, res: Response) => {
  try {
    const result = retentionService.pruneOldChatHistory();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 6. META WEBHOOK ENDPOINTS (Supports both /webhook & /api/webhook)
// ----------------------------------------------------
const handleWebhookVerification = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const settings = db.prepare('SELECT webhook_verify_token FROM settings WHERE id = 1').get() as any;
  const expectedToken = settings?.webhook_verify_token || 'intelligreen_secret_token_123';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook Verified]');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

// Helper to download media sent by WhatsApp users to local storage
async function downloadInboundMetaMedia(mediaObj: any, type: string, accessToken: string): Promise<{ localUrl: string; mimeType: string }> {
  try {
    let downloadUrl = mediaObj.url;
    // If direct lookaside URL is not in payload, fetch from Meta Graph API
    if (!downloadUrl && mediaObj.id) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${mediaObj.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      downloadUrl = data.url;
    }

    if (!downloadUrl) return { localUrl: '', mimeType: '' };

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!fileRes.ok) {
      console.error('[Inbound Media Download Error]:', fileRes.status, await fileRes.text());
      return { localUrl: '', mimeType: '' };
    }

    const mimeType = mediaObj.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream';
    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('mp4') || mimeType.includes('video')) ext = '.mp4';
    else if (mimeType.includes('pdf')) ext = '.pdf';
    else if (mimeType.includes('ogg') || mimeType.includes('audio')) ext = '.ogg';
    else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = '.mp3';

    const filename = `inbound_${mediaObj.id || Date.now()}_${uuidv4().slice(0, 6)}${ext}`;
    const uploadDir = path.resolve('data', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const localFilePath = path.join(uploadDir, filename);

    const arrayBuf = await fileRes.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(arrayBuf));
    console.log(`[Inbound Media Downloaded]: ${filename} (${arrayBuf.byteLength} bytes)`);

    return {
      localUrl: `/uploads/${filename}`,
      mimeType
    };
  } catch (err: any) {
    console.error('[Inbound Media Error]:', err.message);
    return { localUrl: '', mimeType: '' };
  }
}

const handleWebhookEvents = async (req: Request, res: Response) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // 0. Message template status updates from Meta (e.g. APPROVED, REJECTED)
    if (changes?.field === 'message_template_status_update' && value) {
      const status = value.event || 'APPROVED';
      const name = value.message_template_name;
      const metaId = String(value.message_template_id || '');
      const reason = value.reason || '';

      db.prepare(`
        UPDATE templates 
        SET status = ?, rejection_reason = ?, updated_at = ?
        WHERE name = ? OR meta_template_id = ?
      `).run(status, reason, Date.now(), name, metaId);

      eventEmitter.emit('template_update', { name, status, reason, metaId });
    }

    // Inbound customer messages
    if (value?.messages?.length > 0) {
      const msg = value.messages[0];
      const settings = db.prepare('SELECT access_token FROM settings WHERE id = 1').get() as any;
      const accessToken = settings?.access_token || '';

      let messageType = 'text';
      let mediaUrl = '';
      let text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';

      const mediaObj = msg.image || msg.video || msg.document || msg.audio;
      if (mediaObj) {
        if (msg.image) messageType = 'image';
        else if (msg.video) messageType = 'video';
        else if (msg.document) messageType = 'document';
        else if (msg.audio) messageType = 'audio';

        text = mediaObj.caption || (msg.document ? msg.document.filename : '') || '';

        if (accessToken) {
          const dl = await downloadInboundMetaMedia(mediaObj, messageType, accessToken);
          mediaUrl = dl.localUrl;
        }
      }

      const rawDigits = (msg.from || '').replace(/[^0-9]/g, '');
      const fromWithPlus = '+' + rawDigits;
      console.log(`[Inbound WhatsApp from ${fromWithPlus}]: ${messageType} - "${text}" (media: ${mediaUrl})`);

      // Find or create contact (matches +919559468808, 919559468808, or 10-digit suffix)
      let contact = db.prepare('SELECT * FROM contacts WHERE phone_number = ? OR phone_number = ? OR phone_number LIKE ?').get(
        fromWithPlus, 
        rawDigits, 
        `%${rawDigits.slice(-10)}`
      ) as any;
      if (!contact) {
        const newId = uuidv4();
        const contactName = value.contacts?.[0]?.profile?.name || 'WhatsApp User';
        db.prepare('INSERT INTO contacts (id, name, phone_number, created_at) VALUES (?, ?, ?, ?)')
          .run(newId, contactName, fromWithPlus, Date.now());
        contact = { id: newId, name: contactName, phone_number: fromWithPlus };
      }

      simulationService.simulateCustomerReply(contact.id, text, mediaUrl, messageType);
    }

    // Status updates (sent, delivered, read, failed)
    if (value?.statuses?.length > 0) {
      const statusObj = value.statuses[0];
      const wamid = statusObj.id;
      const status = statusObj.status; // 'delivered', 'read', 'failed'
      const now = Date.now();

      if (status === 'delivered') {
        db.prepare('UPDATE campaign_messages SET status = ?, delivered_at = ? WHERE wamid = ?')
          .run('delivered', now, wamid);
        db.prepare('UPDATE chat_messages SET status = ? WHERE wamid = ?')
          .run('delivered', wamid);
      } else if (status === 'read') {
        db.prepare('UPDATE campaign_messages SET status = ?, read_at = ? WHERE wamid = ?')
          .run('read', now, wamid);
        db.prepare('UPDATE chat_messages SET status = ? WHERE wamid = ?')
          .run('read', wamid);
      } else if (status === 'failed') {
        const errorDetail = statusObj.errors?.[0]?.error_data?.details || statusObj.errors?.[0]?.title || 'Meta delivery failure';
        const errorCode = statusObj.errors?.[0]?.code;
        let friendlyReason = errorDetail;
        if (errorCode === 131047) {
          friendlyReason = 'Failed: 24h Customer Service Window is closed. Customer must message +1 555-191-0444 first, or you must send an approved template.';
        }
        db.prepare('UPDATE campaign_messages SET status = ?, error_message = ? WHERE wamid = ?')
          .run('failed', friendlyReason, wamid);
        db.prepare('UPDATE chat_messages SET status = ?, error_message = ? WHERE wamid = ?')
          .run('failed', friendlyReason, wamid);
      }

      // Check if this status belongs to a chat message and notify frontend
      const chatMsg = db.prepare('SELECT conversation_id, id, status, error_message FROM chat_messages WHERE wamid = ?').get(wamid) as any;
      if (chatMsg) {
        eventEmitter.emit('chat_status_update', {
          conversationId: chatMsg.conversation_id,
          messageId: chatMsg.id,
          status: chatMsg.status,
          error_message: chatMsg.error_message,
          wamid
        });
      }
    }
  }
  res.sendStatus(200);
};

app.get('/api/webhook', handleWebhookVerification);
app.get('/webhook', handleWebhookVerification);
app.post('/api/webhook', handleWebhookEvents);
app.post('/webhook', handleWebhookEvents);

// ----------------------------------------------------
// 7. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
// ----------------------------------------------------
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onTemplate = (data: any) => res.write(`event: template_update\ndata: ${JSON.stringify(data)}\n\n`);
  const onCampaignProgress = (data: any) => res.write(`event: campaign_progress\ndata: ${JSON.stringify(data)}\n\n`);
  const onCampaignUpdate = (data: any) => res.write(`event: campaign_update\ndata: ${JSON.stringify(data)}\n\n`);
  const onChatMessage = (data: any) => res.write(`event: new_chat_message\ndata: ${JSON.stringify(data)}\n\n`);
  const onChatStatus = (data: any) => res.write(`event: chat_status_update\ndata: ${JSON.stringify(data)}\n\n`);

  eventEmitter.on('template_update', onTemplate);
  eventEmitter.on('campaign_progress', onCampaignProgress);
  eventEmitter.on('campaign_update', onCampaignUpdate);
  eventEmitter.on('new_chat_message', onChatMessage);
  eventEmitter.on('chat_status_update', onChatStatus);

  req.on('close', () => {
    eventEmitter.off('template_update', onTemplate);
    eventEmitter.off('campaign_progress', onCampaignProgress);
    eventEmitter.off('campaign_update', onCampaignUpdate);
    eventEmitter.off('new_chat_message', onChatMessage);
    eventEmitter.off('chat_status_update', onChatStatus);
  });
});

// ----------------------------------------------------
// 8. STATIC FRONTEND SERVING
// ----------------------------------------------------
const clientDistPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req: Request, res: Response, next: any) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[IntelliGreen WA CRM] Server running on http://localhost:${PORT}`);
  retentionService.initRetentionSchedule();
});
