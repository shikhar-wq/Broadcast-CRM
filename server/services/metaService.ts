import axios from 'axios';
import fs from 'fs';
import path from 'path';

const META_GRAPH_VERSION = 'v21.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export interface MetaSettings {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
}

export const metaService = {
  // 1. Submit a template to Meta for review/approval
  async submitTemplateToMeta(template: any, settings: MetaSettings) {
    if (!settings.waba_id || !settings.access_token) {
      throw new Error('Meta WABA ID and Access Token must be configured in Settings.');
    }

    const components: any[] = [];

    // Header component
    if (template.header_type && template.header_type !== 'NONE') {
      const headerComp: any = {
        type: 'HEADER',
        format: template.header_type,
      };

      if (template.header_type === 'TEXT') {
        headerComp.text = template.header_content;
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header_type)) {
        if (template.header_content) {
          headerComp.example = {
            header_handle: [template.header_content]
          };
        }
      }
      components.push(headerComp);
    }

    // Body component
    const bodyComp: any = {
      type: 'BODY',
      text: template.body_text,
    };

    // Body variable sample values
    const sampleValues = typeof template.sample_values_json === 'string'
      ? JSON.parse(template.sample_values_json || '[]')
      : (template.sample_values_json || []);

    if (sampleValues.length > 0) {
      bodyComp.example = {
        body_text: [sampleValues]
      };
    }
    components.push(bodyComp);

    // Footer component
    if (template.footer_text && template.footer_text.trim()) {
      components.push({
        type: 'FOOTER',
        text: template.footer_text.trim()
      });
    }

    // Buttons component
    const buttons = typeof template.buttons_json === 'string'
      ? JSON.parse(template.buttons_json || '[]')
      : (template.buttons_json || []);

    if (buttons.length > 0) {
      const formattedButtons = buttons.map((btn: any) => {
        if (btn.type === 'QUICK_REPLY') {
          return { type: 'QUICK_REPLY', text: btn.text };
        } else if (btn.type === 'URL') {
          return { type: 'URL', text: btn.text, url: btn.url };
        } else if (btn.type === 'PHONE_NUMBER') {
          return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number };
        }
        return btn;
      });

      components.push({
        type: 'BUTTONS',
        buttons: formattedButtons
      });
    }

    const payload = {
      name: template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      category: template.category,
      language: template.language || 'en_US',
      components
    };

    const url = `${GRAPH_BASE_URL}/${settings.waba_id}/message_templates`;
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data; // e.g. { id: '12345678', status: 'PENDING', category: 'MARKETING' }
  },

  // 2. Fetch live template statuses from Meta
  async fetchTemplates(settings: MetaSettings) {
    if (!settings.waba_id || !settings.access_token) {
      throw new Error('Meta WABA ID and Access Token must be configured in Settings.');
    }

    const url = `${GRAPH_BASE_URL}/${settings.waba_id}/message_templates?limit=100`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${settings.access_token}` }
    });

    return response.data;
  },

  // 3. Send a single template message to a recipient
  async sendTemplateMessage(phoneNumber: string, template: any, variables: Record<string, string>, settings: MetaSettings) {
    if (!settings.phone_number_id || !settings.access_token) {
      throw new Error('Phone Number ID and Access Token are required to send messages.');
    }

    let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    // Strip leading zero and prefix Indian country code if 11 digits (e.g. 09876543210 -> 919876543210)
    if (cleanNumber.length === 11 && cleanNumber.startsWith('0')) {
      cleanNumber = '91' + cleanNumber.slice(1);
    } else if (cleanNumber.length === 10) {
      // Auto-prefix Indian country code if user entered 10 digits
      cleanNumber = '91' + cleanNumber;
    }

    const components: any[] = [];

    const isDefaultHelloWorld = template.name?.toLowerCase() === 'hello_world';

    if (!isDefaultHelloWorld) {
      // Header media/text parameter if applicable
      if (template.header_type === 'IMAGE') {
        const imgLink = (template.header_content && template.header_content.startsWith('http')) 
          ? template.header_content 
          : 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop';
        components.push({
          type: 'header',
          parameters: [{ type: 'image', image: { link: imgLink } }]
        });
      } else if (template.header_type === 'VIDEO') {
        const vidLink = (template.header_content && template.header_content.startsWith('http')) 
          ? template.header_content 
          : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
        components.push({
          type: 'header',
          parameters: [{ type: 'video', video: { link: vidLink } }]
        });
      }

      // Body variables
      const bodyParams: any[] = [];
      // Extract variables {{1}}, {{2}} in order
      const matches = template.body_text?.match(/{{\s*(\d+)\s*}}/g) || [];
      for (let i = 1; i <= matches.length; i++) {
        const val = variables[i.toString()] || variables[i] || `Var${i}`;
        bodyParams.push({
          type: 'text',
          text: val
        });
      }

      if (bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams
        });
      }
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanNumber,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language || 'en_US' }
      }
    };

    if (components.length > 0) {
      payload.template.components = components;
    }

    const url = `${GRAPH_BASE_URL}/${settings.phone_number_id}/messages`;
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data; // { messages: [{ id: 'wamid.HBg...' }] }
  },

  // Helper: Upload local media file directly to Meta Media API
  async uploadMediaToMeta(filePath: string, mimeType: string, settings: MetaSettings): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', blob, fileName);
    formData.append('type', mimeType);

    const url = `${GRAPH_BASE_URL}/${settings.phone_number_id}/media`;
    const res = await axios.post(url, formData, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`
      }
    });
    return res.data?.id;
  },

  // 4. Send freeform reply within 24-hr customer service window (Query Tab)
  async sendFreeformMessage(
    phoneNumber: string, 
    text: string, 
    settings: MetaSettings,
    mediaUrl?: string,
    mediaType?: string
  ) {
    if (!settings.phone_number_id || !settings.access_token) {
      throw new Error('Phone Number ID and Access Token are required to send replies.');
    }

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    let payload: any;

    if (mediaUrl) {
      // Determine media type
      let type = mediaType?.toLowerCase();
      if (!type || !['image', 'video', 'document', 'audio'].includes(type)) {
        if (mediaUrl.match(/\.(jpeg|jpg|png|webp|gif)/i)) {
          type = 'image';
        } else if (mediaUrl.match(/\.(mp4|webm|mov|ogg|m4v)/i)) {
          type = 'video';
        } else if (mediaUrl.match(/\.(mp3|aac|ogg|wav|m4a)/i)) {
          type = 'audio';
        } else {
          type = 'document';
        }
      }

      // Check if media is stored locally on this machine
      let metaMediaId: string | null = null;
      if (mediaUrl.includes('/uploads/')) {
        const filename = mediaUrl.split('/uploads/').pop()?.split('?')[0];
        if (filename) {
          const localPath = path.resolve('data', 'uploads', filename);
          if (fs.existsSync(localPath)) {
            let mimeType = 'application/octet-stream';
            const ext = path.extname(filename).toLowerCase();
            if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.webp') mimeType = 'image/webp';
            else if (ext === '.mp4') mimeType = 'video/mp4';
            else if (ext === '.pdf') mimeType = 'application/pdf';

            try {
              metaMediaId = await this.uploadMediaToMeta(localPath, mimeType, settings);
            } catch (uploadErr: any) {
              console.error('[Meta Media Direct Upload Error]:', uploadErr.response?.data || uploadErr.message);
            }
          }
        }
      }

      // Format caption with trailing newline so WhatsApp Mobile never renders the timestamp on top of text
      const cleanCaption = text && text.trim() ? `${text.trim()}\n` : undefined;

      if (metaMediaId) {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: type,
          [type]: {
            id: metaMediaId,
            ...(cleanCaption ? { caption: cleanCaption } : {})
          }
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: type,
          [type]: {
            link: mediaUrl,
            ...(cleanCaption ? { caption: cleanCaption } : {})
          }
        };
      }
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: { body: text }
      };
    }

    const url = `${GRAPH_BASE_URL}/${settings.phone_number_id}/messages`;
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  },

  // 5. Check phone number quality score & tier
  async fetchPhoneNumberHealth(settings: MetaSettings) {
    if (!settings.phone_number_id || !settings.access_token) {
      return null;
    }

    const url = `${GRAPH_BASE_URL}/${settings.phone_number_id}?fields=display_phone_number,quality_rating,messaging_limit_tier`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${settings.access_token}` }
    });

    return response.data;
  }
};
