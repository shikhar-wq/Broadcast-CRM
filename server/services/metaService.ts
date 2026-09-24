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

  // Cache of live Meta template schemas by template name (5 minute TTL)
  _liveTemplateCache: new Map<string, { fetchedAt: number; data: any }>(),

  async getLiveTemplateSchema(templateName: string, preferredLanguage: string, settings: MetaSettings): Promise<any | null> {
    if (!settings.waba_id || !settings.access_token || !templateName) return null;
    const cacheKey = `${settings.waba_id}:${templateName}:${preferredLanguage || ''}`;
    const cached = this._liveTemplateCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached.data;
    }

    try {
      const url = `${GRAPH_BASE_URL}/${settings.waba_id}/message_templates?name=${encodeURIComponent(templateName)}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${settings.access_token}` }
      });
      const list: any[] = res.data?.data || [];
      if (list.length === 0) return null;

      // Prefer exact language match & APPROVED status
      const matched =
        list.find(t => t.language === preferredLanguage && t.status === 'APPROVED') ||
        list.find(t => t.status === 'APPROVED') ||
        list[0];

      if (matched) {
        this._liveTemplateCache.set(cacheKey, { fetchedAt: Date.now(), data: matched });
      }
      return matched || null;
    } catch (e) {
      return null;
    }
  },

  // Sanitize template parameter text (Meta rejects newlines, tabs, >4 consecutive spaces, or empty strings with #132012)
  sanitizeParamText(val: any, fallback: string = 'Val'): string {
    const str = String(val ?? '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{4,}/g, '   ')
      .trim();
    return str.length > 0 ? str : fallback;
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

    // Fetch exact live template structure from Meta so header/body/button formats & NAMED vs POSITIONAL match 100%
    const liveMetaTpl = await this.getLiveTemplateSchema(template.name, template.language, settings);
    const resolvedLanguage = liveMetaTpl?.language || template.language || 'en_US';
    const parameterFormat = (liveMetaTpl?.parameter_format || 'POSITIONAL').toUpperCase();
    const contactName = variables['_contact_name'] || variables['name'] || variables['customer_name'] || '';

    const localSampleValues: string[] = typeof template.sample_values_json === 'string'
      ? JSON.parse(template.sample_values_json || '[]')
      : (Array.isArray(template.sample_values_json) ? template.sample_values_json : []);

    if (!isDefaultHelloWorld) {
      if (liveMetaTpl && Array.isArray(liveMetaTpl.components)) {
        // Build components strictly according to Meta's live created template schema
        for (const comp of liveMetaTpl.components) {
          const compType = (comp.type || '').toUpperCase();

          if (compType === 'HEADER') {
            const format = (comp.format || 'TEXT').toUpperCase();
            if (format === 'IMAGE') {
              const imgLink = (template.header_content && template.header_content.startsWith('http'))
                ? template.header_content
                : 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop';
              components.push({
                type: 'header',
                parameters: [{ type: 'image', image: { link: imgLink } }]
              });
            } else if (format === 'VIDEO') {
              const vidLink = (template.header_content && template.header_content.startsWith('http'))
                ? template.header_content
                : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
              components.push({
                type: 'header',
                parameters: [{ type: 'video', video: { link: vidLink } }]
              });
            } else if (format === 'DOCUMENT') {
              const docLink = (template.header_content && template.header_content.startsWith('http'))
                ? template.header_content
                : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
              components.push({
                type: 'header',
                parameters: [{ type: 'document', document: { link: docLink, filename: 'Order_Receipt.pdf' } }]
              });
            } else if (format === 'TEXT' && comp.text) {
              // Check if header text contains variables like {{1}} or {{order_id}}
              const namedHeaderExamples: any[] = comp.example?.header_text_named_params || [];
              const posHeaderExamples: string[] = comp.example?.header_text || [];
              const rawMatches = [...comp.text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((m: any) => m[1]);

              if (namedHeaderExamples.length > 0 || (parameterFormat === 'NAMED' && rawMatches.length > 0)) {
                const paramNames = namedHeaderExamples.length > 0
                  ? namedHeaderExamples.map((e: any) => e.param_name)
                  : Array.from(new Set(rawMatches));
                const headerParams = paramNames.map((pName: string, idx: number) => {
                  const exVal = namedHeaderExamples.find((e: any) => e.param_name === pName)?.example;
                  const val = variables[pName] || exVal || contactName || `Ref-${idx + 1}`;
                  return {
                    type: 'text',
                    parameter_name: pName,
                    text: this.sanitizeParamText(val, `Ref-${idx + 1}`)
                  };
                });
                if (headerParams.length > 0) {
                  components.push({ type: 'header', parameters: headerParams });
                }
              } else if (rawMatches.length > 0 || posHeaderExamples.length > 0) {
                const count = Math.max(rawMatches.length, posHeaderExamples.length);
                const headerParams = [];
                for (let i = 1; i <= count; i++) {
                  const val = variables[`header_${i}`] || posHeaderExamples[i - 1] || variables[String(i)] || `100${i}`;
                  headerParams.push({
                    type: 'text',
                    text: this.sanitizeParamText(val, `100${i}`)
                  });
                }
                if (headerParams.length > 0) {
                  components.push({ type: 'header', parameters: headerParams });
                }
              }
            }
          } else if (compType === 'BODY') {
            const bodyText = comp.text || template.body_text || '';
            const namedBodyExamples: any[] = comp.example?.body_text_named_params || [];
            const posBodyExamples: string[] = comp.example?.body_text?.[0] || localSampleValues;
            const rawMatches = [...bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((m: any) => m[1]);
            const hasNonNumericVar = rawMatches.some((v: string) => !/^\d+$/.test(v));

            if (namedBodyExamples.length > 0 || parameterFormat === 'NAMED' || hasNonNumericVar) {
              const paramNames = namedBodyExamples.length > 0
                ? namedBodyExamples.map((e: any) => e.param_name)
                : Array.from(new Set(rawMatches));
              const bodyParams = paramNames.map((pName: string, idx: number) => {
                const exVal = namedBodyExamples.find((e: any) => e.param_name === pName)?.example;
                const isNameField = /name|customer|user|client|recipient/i.test(pName);
                const val =
                  variables[pName] ||
                  (isNameField && contactName ? contactName : '') ||
                  exVal ||
                  posBodyExamples[idx] ||
                  (idx === 0 && contactName ? contactName : `Value ${idx + 1}`);
                return {
                  type: 'text',
                  parameter_name: pName,
                  text: this.sanitizeParamText(val, `Value ${idx + 1}`)
                };
              });
              if (bodyParams.length > 0) {
                components.push({ type: 'body', parameters: bodyParams });
              }
            } else if (rawMatches.length > 0 || posBodyExamples.length > 0) {
              const maxIndex = rawMatches.reduce((max: number, cur: string) => {
                const n = parseInt(cur, 10);
                return !isNaN(n) && n > max ? n : max;
              }, 0);
              const count = Math.max(maxIndex, posBodyExamples.length);
              const bodyParams = [];
              for (let i = 1; i <= count; i++) {
                const val =
                  variables[String(i)] ||
                  (i === 1 && contactName ? contactName : '') ||
                  posBodyExamples[i - 1] ||
                  localSampleValues[i - 1] ||
                  (i === 1 ? 'Valued Customer' : `100${i}`);
                bodyParams.push({
                  type: 'text',
                  text: this.sanitizeParamText(val, `100${i}`)
                });
              }
              if (bodyParams.length > 0) {
                components.push({ type: 'body', parameters: bodyParams });
              }
            }
          } else if (compType === 'BUTTONS' && Array.isArray(comp.buttons)) {
            comp.buttons.forEach((btn: any, index: number) => {
              const bType = (btn.type || '').toUpperCase();
              if (bType === 'URL' && typeof btn.url === 'string' && btn.url.includes('{{')) {
                const urlParamVal =
                  variables[`button_url_${index}`] ||
                  variables['button_url'] ||
                  (Array.isArray(btn.example) ? btn.example[0] : btn.example) ||
                  '1001';
                components.push({
                  type: 'button',
                  sub_type: 'url',
                  index: String(index),
                  parameters: [
                    {
                      type: 'text',
                      text: this.sanitizeParamText(urlParamVal, '1001')
                    }
                  ]
                });
              } else if (bType === 'COPY_CODE') {
                const codeVal =
                  variables['coupon_code'] ||
                  (Array.isArray(btn.example) ? btn.example[0] : btn.example) ||
                  'INTELLIGREEN';
                components.push({
                  type: 'button',
                  sub_type: 'copy_code',
                  index: String(index),
                  parameters: [
                    {
                      type: 'coupon_code',
                      coupon_code: this.sanitizeParamText(codeVal, 'INTELLIGREEN')
                    }
                  ]
                });
              }
            });
          }
        }
      } else {
        // Fallback when live template lookup is unavailable
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
        } else if (template.header_type === 'DOCUMENT') {
          const docLink = (template.header_content && template.header_content.startsWith('http'))
            ? template.header_content
            : 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
          components.push({
            type: 'header',
            parameters: [{ type: 'document', document: { link: docLink, filename: 'Order_Receipt.pdf' } }]
          });
        } else if (template.header_type === 'TEXT' && template.header_content) {
          const hdrMatches = [...template.header_content.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((m: any) => m[1]);
          if (hdrMatches.length > 0) {
            const headerParams = hdrMatches.map((m: string, idx: number) => {
              const isNamed = !/^\d+$/.test(m);
              const val = variables[m] || contactName || `Ref-${idx + 1}`;
              return isNamed
                ? { type: 'text', parameter_name: m, text: this.sanitizeParamText(val) }
                : { type: 'text', text: this.sanitizeParamText(val) };
            });
            components.push({ type: 'header', parameters: headerParams });
          }
        }

        // Body variables (supports both {{1}} positional and {{name}} named placeholders)
        const rawBodyMatches = [...(template.body_text || '').matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((m: any) => m[1]);
        if (rawBodyMatches.length > 0) {
          const hasNamed = rawBodyMatches.some((m: string) => !/^\d+$/.test(m));
          if (hasNamed) {
            const uniqueNames = Array.from(new Set(rawBodyMatches));
            const bodyParams = uniqueNames.map((pName: string, idx: number) => {
              const val = variables[pName] || localSampleValues[idx] || (idx === 0 && contactName ? contactName : `Value ${idx + 1}`);
              return {
                type: 'text',
                parameter_name: pName,
                text: this.sanitizeParamText(val, `Value ${idx + 1}`)
              };
            });
            components.push({ type: 'body', parameters: bodyParams });
          } else {
            const maxIndex = rawBodyMatches.reduce((max: number, cur: string) => {
              const n = parseInt(cur, 10);
              return !isNaN(n) && n > max ? n : max;
            }, 0);
            const bodyParams = [];
            for (let i = 1; i <= maxIndex; i++) {
              const val =
                variables[String(i)] ||
                (i === 1 && contactName ? contactName : '') ||
                localSampleValues[i - 1] ||
                (i === 1 ? 'Valued Customer' : `100${i}`);
              bodyParams.push({
                type: 'text',
                text: this.sanitizeParamText(val, `100${i}`)
              });
            }
            components.push({ type: 'body', parameters: bodyParams });
          }
        }
      }
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanNumber,
      type: 'template',
      template: {
        name: template.name,
        language: { code: resolvedLanguage }
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
