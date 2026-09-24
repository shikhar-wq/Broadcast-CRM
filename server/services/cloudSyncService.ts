import db from '../db.ts';

let syncTimeout: NodeJS.Timeout | null = null;
const SNAPSHOT_FILENAME = 'intelligreen_db_snapshot.json';

export const cloudSyncService = {
  /**
   * Export all CRM tables into a portable JSON object
   */
  exportFullDatabase() {
    return {
      version: 1,
      timestamp: Date.now(),
      settings: db.prepare('SELECT * FROM settings WHERE id = 1').get(),
      templates: db.prepare('SELECT * FROM templates').all(),
      contacts: db.prepare('SELECT * FROM contacts').all(),
      campaigns: db.prepare('SELECT * FROM campaigns').all(),
      campaign_messages: db.prepare('SELECT * FROM campaign_messages').all(),
      conversations: db.prepare('SELECT * FROM conversations').all(),
      chat_messages: db.prepare('SELECT * FROM chat_messages').all(),
    };
  },

  /**
   * Restore all CRM tables from a snapshot object
   */
  importFullDatabase(snapshot: any) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Invalid backup snapshot format.');
    }

    const restoreTransaction = db.transaction(() => {
      // 1. Settings
      if (snapshot.settings) {
        const s = snapshot.settings;
        const envWaba = process.env.META_WABA_ID || '';
        const envPhone = process.env.META_PHONE_NUMBER_ID || '';
        const envToken = process.env.META_ACCESS_TOKEN || '';
        const envSupaUrl = process.env.SUPABASE_URL || '';
        const envSupaKey = process.env.SUPABASE_ANON_KEY || '';

        db.prepare(`
          UPDATE settings SET
            mode = ?,
            waba_id = ?,
            phone_number_id = ?,
            access_token = ?,
            webhook_verify_token = ?,
            storage_provider = ?,
            supabase_url = ?,
            supabase_anon_key = ?,
            supabase_bucket = ?,
            imagekit_public_key = ?,
            imagekit_private_key = ?,
            imagekit_url_endpoint = ?,
            updated_at = ?
          WHERE id = 1
        `).run(
          s.mode || 'LIVE',
          s.waba_id || envWaba,
          s.phone_number_id || envPhone,
          s.access_token || envToken,
          s.webhook_verify_token || 'intelligreen_secret_token_123',
          s.storage_provider || 'BUILTIN',
          s.supabase_url || envSupaUrl,
          s.supabase_anon_key || envSupaKey,
          s.supabase_bucket || 'whatsapp-media',
          s.imagekit_public_key || '',
          s.imagekit_private_key || '',
          s.imagekit_url_endpoint || '',
          Date.now()
        );
      }

      // 2. Templates
      if (Array.isArray(snapshot.templates) && snapshot.templates.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO templates (
            id, name, category, language, header_type, header_content, body_text, footer_text,
            buttons_json, sample_values_json, status, rejection_reason, meta_template_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of snapshot.templates) {
          stmt.run(
            t.id, t.name, t.category, t.language || 'en_US', t.header_type || 'NONE', t.header_content || '',
            t.body_text || '', t.footer_text || '', t.buttons_json || '[]', t.sample_values_json || '[]',
            t.status || 'APPROVED', t.rejection_reason || '', t.meta_template_id || '',
            t.created_at || Date.now(), t.updated_at || Date.now()
          );
        }
      }

      // 3. Contacts
      if (Array.isArray(snapshot.contacts) && snapshot.contacts.length > 0) {
        db.prepare('DELETE FROM contacts').run();
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO contacts (
            id, name, phone_number, variables_json, is_opted_out, opted_out_at, tags, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of snapshot.contacts) {
          stmt.run(
            c.id, c.name, c.phone_number, c.variables_json || '{}',
            c.is_opted_out || 0, c.opted_out_at || null, c.tags || 'General', c.created_at || Date.now()
          );
        }
      }

      // 4. Campaigns
      if (Array.isArray(snapshot.campaigns) && snapshot.campaigns.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO campaigns (
            id, name, template_id, total_contacts, sent_count, delivered_count, read_count,
            failed_count, suppressed_count, status, messages_per_second, started_at, completed_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const camp of snapshot.campaigns) {
          stmt.run(
            camp.id, camp.name, camp.template_id, camp.total_contacts || 0, camp.sent_count || 0,
            camp.delivered_count || 0, camp.read_count || 0, camp.failed_count || 0, camp.suppressed_count || 0,
            camp.status === 'RUNNING' ? 'PAUSED' : (camp.status || 'COMPLETED'),
            camp.messages_per_second || 5, camp.started_at || null, camp.completed_at || null, camp.created_at || Date.now()
          );
        }
      }

      // 5. Campaign Messages
      if (Array.isArray(snapshot.campaign_messages) && snapshot.campaign_messages.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO campaign_messages (
            id, campaign_id, contact_id, phone_number, contact_name, wamid, status,
            error_message, sent_at, delivered_at, read_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const cm of snapshot.campaign_messages) {
          stmt.run(
            cm.id, cm.campaign_id, cm.contact_id, cm.phone_number, cm.contact_name || '',
            cm.wamid || '', cm.status || 'sent', cm.error_message || '',
            cm.sent_at || null, cm.delivered_at || null, cm.read_at || null
          );
        }
      }

      // 6. Conversations
      if (Array.isArray(snapshot.conversations) && snapshot.conversations.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO conversations (
            id, contact_id, contact_name, phone_number, unread_count, last_message_text,
            last_message_at, service_window_expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const conv of snapshot.conversations) {
          stmt.run(
            conv.id, conv.contact_id, conv.contact_name, conv.phone_number,
            conv.unread_count || 0, conv.last_message_text || '',
            conv.last_message_at || Date.now(), conv.service_window_expires_at || 0
          );
        }
      }

      // 7. Chat Messages
      if (Array.isArray(snapshot.chat_messages) && snapshot.chat_messages.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO chat_messages (
            id, conversation_id, direction, message_type, content, media_url, status, wamid, error_message, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const msg of snapshot.chat_messages) {
          stmt.run(
            msg.id, msg.conversation_id, msg.direction, msg.message_type || 'text',
            msg.content || '', msg.media_url || '', msg.status || 'sent',
            msg.wamid || '', msg.error_message || '', msg.timestamp || Date.now()
          );
        }
      }
    });

    restoreTransaction();
  },

  /**
   * Schedule a debounced cloud backup to Supabase Storage (if configured)
   */
  scheduleBackup() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      this.backupToSupabase().catch((err) => {
        console.warn('[CloudSync] Background backup skipped/failed:', err.message);
      });
    }, 2500);
  },

  /**
   * Upload current DB snapshot to Supabase Storage
   */
  async backupToSupabase(): Promise<{ success: boolean; message: string }> {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    const supabaseUrl = (settings?.supabase_url || process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const supabaseKey = (settings?.supabase_anon_key || process.env.SUPABASE_ANON_KEY || '').trim();
    const bucket = (settings?.supabase_bucket || process.env.SUPABASE_BUCKET || 'whatsapp-media').trim();

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, message: 'Supabase credentials not configured for cloud sync.' };
    }

    const snapshot = this.exportFullDatabase();
    const jsonBytes = Buffer.from(JSON.stringify(snapshot), 'utf-8');

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${SNAPSHOT_FILENAME}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body: jsonBytes
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase backup returned ${res.status}: ${errText}`);
    }

    return { success: true, message: 'Database snapshot synced to Supabase Cloud Storage.' };
  },

  /**
   * Restore database from Supabase Storage when server boots up
   */
  async restoreFromSupabaseOnBoot(): Promise<boolean> {
    try {
      const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
      const supabaseUrl = (process.env.SUPABASE_URL || settings?.supabase_url || '').trim().replace(/\/$/, '');
      const supabaseKey = (process.env.SUPABASE_ANON_KEY || settings?.supabase_anon_key || '').trim();
      const bucket = (process.env.SUPABASE_BUCKET || settings?.supabase_bucket || 'whatsapp-media').trim();

      if (!supabaseUrl || !supabaseKey) {
        return false;
      }

      // Try authenticated download first, then public URL
      const downloadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${SNAPSHOT_FILENAME}`;
      const res = await fetch(downloadUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!res.ok) {
        return false;
      }

      const snapshot = await res.json();
      if (snapshot && snapshot.version) {
        this.importFullDatabase(snapshot);
        console.log(`[CloudSync] Restored CRM state from Supabase Cloud (${snapshot.contacts?.length || 0} contacts, ${snapshot.templates?.length || 0} templates).`);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('[CloudSync] No remote snapshot restored on boot:', err.message);
      return false;
    }
  }
};
