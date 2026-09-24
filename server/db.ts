import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'intelligreen_wa.db');
const db = new Database(dbPath);

// Enable foreign keys, WAL mode & busy timeout for concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 10000');

export function initDatabase() {
  // Reset any orphaned RUNNING campaigns to PAUSED on server start
  try {
    db.prepare("UPDATE campaigns SET status = 'PAUSED' WHERE status = 'RUNNING'").run();
  } catch (e) {
    // Ignore if table not created yet
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL DEFAULT 'SIMULATION', -- 'SIMULATION' | 'LIVE'
      waba_id TEXT DEFAULT '',
      phone_number_id TEXT DEFAULT '',
      access_token TEXT DEFAULT '',
      webhook_verify_token TEXT DEFAULT 'intelligreen_secret_token_123',
      quality_rating TEXT DEFAULT 'GREEN', -- 'GREEN' | 'YELLOW' | 'RED'
      messaging_tier TEXT DEFAULT 'TIER_1', -- 'TIER_1' (1k) | 'TIER_2' (10k) | 'UNVERIFIED_TRIAL' (250)
      imagekit_public_key TEXT DEFAULT '',
      imagekit_private_key TEXT DEFAULT '',
      imagekit_url_endpoint TEXT DEFAULT '',
      storage_provider TEXT DEFAULT 'BUILTIN', -- 'BUILTIN' | 'SUPABASE' | 'IMAGEKIT'
      supabase_url TEXT DEFAULT '',
      supabase_anon_key TEXT DEFAULT '',
      supabase_bucket TEXT DEFAULT 'whatsapp-media',
      public_url TEXT DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL, -- 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
      language TEXT NOT NULL DEFAULT 'en_US',
      header_type TEXT NOT NULL DEFAULT 'NONE', -- 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
      header_content TEXT DEFAULT '', -- text or media url
      body_text TEXT NOT NULL,
      footer_text TEXT DEFAULT '',
      buttons_json TEXT DEFAULT '[]',
      sample_values_json TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED'
      rejection_reason TEXT DEFAULT '',
      meta_template_id TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_number TEXT NOT NULL UNIQUE,
      variables_json TEXT DEFAULT '{}',
      tags TEXT DEFAULT 'General',
      is_opted_out INTEGER NOT NULL DEFAULT 0,
      opted_out_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      total_contacts INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      read_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      suppressed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
      messages_per_second INTEGER NOT NULL DEFAULT 5,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaign_messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'suppressed'
      wamid TEXT DEFAULT '',
      error_message TEXT DEFAULT '',
      sent_at INTEGER,
      delivered_at INTEGER,
      read_at INTEGER,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL UNIQUE,
      contact_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      last_message_text TEXT DEFAULT '',
      last_message_at INTEGER NOT NULL,
      service_window_expires_at INTEGER NOT NULL,
      unread_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      direction TEXT NOT NULL, -- 'INBOUND' | 'OUTBOUND'
      message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'template' | 'image' | 'video' | 'button_reply'
      content TEXT NOT NULL,
      media_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'delivered', -- 'sent' | 'delivered' | 'read'
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Run migrations for ImageKit settings columns on existing databases
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN imagekit_public_key TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN imagekit_private_key TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN imagekit_url_endpoint TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN storage_provider TEXT DEFAULT 'BUILTIN'").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN supabase_url TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN supabase_anon_key TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN supabase_bucket TEXT DEFAULT 'whatsapp-media'").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN public_url TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE chat_messages ADD COLUMN wamid TEXT DEFAULT ''").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE chat_messages ADD COLUMN error_message TEXT DEFAULT ''").run();
  } catch (e) {}

  // Initialize default settings if empty or ensure production mode
  const settingsRow = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  const defaultWabaId = process.env.META_WABA_ID || '';
  const defaultPhoneId = process.env.META_PHONE_NUMBER_ID || '';
  const defaultAccessToken = process.env.META_ACCESS_TOKEN || '';
  const defaultWebhookToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'intelligreen_secret_token_123';

  if (!settingsRow) {
    db.prepare(`
      INSERT INTO settings (id, mode, waba_id, phone_number_id, access_token, webhook_verify_token, quality_rating, messaging_tier, updated_at)
      VALUES (1, 'LIVE', ?, ?, ?, ?, 'GREEN', 'TIER_1', ?)
    `).run(defaultWabaId, defaultPhoneId, defaultAccessToken, defaultWebhookToken, Date.now());
  } else if (settingsRow.mode === 'SIMULATION' || settingsRow.waba_id?.startsWith('sim_')) {
    db.prepare(`
      UPDATE settings 
      SET mode = 'LIVE',
          waba_id = CASE WHEN waba_id LIKE 'sim_%' THEN ? ELSE waba_id END,
          phone_number_id = CASE WHEN phone_number_id LIKE 'sim_%' THEN ? ELSE phone_number_id END,
          access_token = CASE WHEN access_token LIKE 'sim_%' THEN ? ELSE access_token END
      WHERE id = 1
    `).run(defaultWabaId, defaultPhoneId, defaultAccessToken);
  }

  purgeLegacyDummyData();
}

export function purgeLegacyDummyData() {
  try {
    // 1. Remove legacy dummy contacts and their associated dummy conversations/messages
    const dummyPhones = [
      '+919876543211',
      '+919876543212',
      '+919876543213',
      '+919876543214',
      '+14155552671',
      '+919876543216',
      '+919876543217',
      '+919876543218',
      '+919876543219',
      '+919876543220'
    ];

    const placeholders = dummyPhones.map(() => '?').join(',');
    const dummyContacts = db.prepare(`SELECT id FROM contacts WHERE phone_number IN (${placeholders})`).all(...dummyPhones) as { id: string }[];

    if (dummyContacts.length > 0) {
      const dummyIds = dummyContacts.map(c => c.id);
      const idPlaceholders = dummyIds.map(() => '?').join(',');

      // Delete chat messages of dummy conversations
      const dummyConvs = db.prepare(`SELECT id FROM conversations WHERE contact_id IN (${idPlaceholders})`).all(...dummyIds) as { id: string }[];
      if (dummyConvs.length > 0) {
        const convPlaceholders = dummyConvs.map(() => '?').join(',');
        db.prepare(`DELETE FROM chat_messages WHERE conversation_id IN (${convPlaceholders})`).run(...dummyConvs.map(c => c.id));
        db.prepare(`DELETE FROM conversations WHERE id IN (${convPlaceholders})`).run(...dummyConvs.map(c => c.id));
      }

      // Delete campaign messages for dummy contacts
      db.prepare(`DELETE FROM campaign_messages WHERE contact_id IN (${idPlaceholders})`).run(...dummyIds);
      // Delete dummy contacts
      db.prepare(`DELETE FROM contacts WHERE id IN (${idPlaceholders})`).run(...dummyIds);
    }

    // 2. Remove legacy dummy templates that were never registered on Meta
    const dummyTemplateNames = [
      'green_product_launch_v1',
      'solar_energy_tour_v2',
      'sustainability_webinar_invite'
    ];
    for (const tplName of dummyTemplateNames) {
      const tpl = db.prepare("SELECT id, meta_template_id FROM templates WHERE name = ?").get(tplName) as any;
      if (tpl && (!tpl.meta_template_id || tpl.meta_template_id === '')) {
        // Delete any campaigns using this dummy template first
        const dummyCamps = db.prepare("SELECT id FROM campaigns WHERE template_id = ?").all(tpl.id) as { id: string }[];
        for (const camp of dummyCamps) {
          db.prepare("DELETE FROM campaign_messages WHERE campaign_id = ?").run(camp.id);
          db.prepare("DELETE FROM campaigns WHERE id = ?").run(camp.id);
        }
        db.prepare("DELETE FROM templates WHERE id = ?").run(tpl.id);
      }
    }
  } catch (e) {
    // Ignore if tables are being initialized
  }
}

export default db;
