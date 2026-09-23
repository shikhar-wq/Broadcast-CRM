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

  seedInitialData();
}

function seedInitialData() {
  // Check if templates exist
  const count = db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number };
  if (count.count === 0) {
    const now = Date.now();

    // 0. Official Meta pre-approved hello_world template (Available by default on all Meta WhatsApp accounts)
    db.prepare(`
      INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'hello_world',
      'UTILITY',
      'en_US',
      'NONE',
      '',
      'Welcome and congratulations! This message demonstrates your ability to send a WhatsApp message using the Cloud API. To learn more, visit the WhatsApp Cloud API documentation for other sample apps, tutorials, and more.',
      '',
      '[]',
      '[]',
      'APPROVED',
      now,
      now
    );

    // 1. Eco Product Launch (Approved Image Template)
    db.prepare(`
      INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'green_product_launch_v1',
      'MARKETING',
      'en_US',
      'IMAGE',
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop',
      'Hello {{1}},\n\nDiscover IntelliGreen’s new eco-friendly collection! Save up to 25% on your first bulk order with code: {{2}}.\n\nCrafted with zero-waste principles for a sustainable tomorrow.',
      'Reply STOP to unsubscribe from marketing alerts.',
      JSON.stringify([
        { type: 'QUICK_REPLY', text: 'Interested' },
        { type: 'QUICK_REPLY', text: 'Chat with Agent' },
        { type: 'QUICK_REPLY', text: 'Stop Promo' }
      ]),
      JSON.stringify(['Valued Customer', 'GREEN25']),
      'APPROVED',
      now,
      now
    );

    // 2. Solar Installation Showcase (Approved Video Template)
    db.prepare(`
      INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'solar_energy_tour_v2',
      'MARKETING',
      'en_US',
      'VIDEO',
      'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
      'Hi {{1}},\n\nWatch how our turnkey smart-solar systems reduce facility electricity bills by up to 60%. Schedule your site inspection this week!',
      'IntelliGreen CleanTech Services',
      JSON.stringify([
        { type: 'URL', text: 'Book Free Audit', url: 'https://intelligreen.example.com/audit' },
        { type: 'PHONE_NUMBER', text: 'Call Us', phone_number: '+919876543210' }
      ]),
      JSON.stringify(['Facility Director']),
      'APPROVED',
      now,
      now
    );

    // 3. Pending verification template
    db.prepare(`
      INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'sustainability_webinar_invite',
      'MARKETING',
      'en_US',
      'TEXT',
      'Exclusive Sustainability Summit 2026',
      'Dear {{1}},\n\nYou are cordially invited to our exclusive webinar on "Zero-Emission Commercial Facilities" on October 15th at {{2}}.\n\nConfirm your seat before slots fill up!',
      'IntelliGreen Webinars',
      JSON.stringify([
        { type: 'QUICK_REPLY', text: 'RSVP Yes' },
        { type: 'QUICK_REPLY', text: 'Cannot Attend' }
      ]),
      JSON.stringify(['Partner', '4:00 PM IST']),
      'PENDING',
      now,
      now
    );
  }

  // Ensure Meta's official pre-approved hello_world template is available and approved
  try {
    const hw = db.prepare("SELECT id, status FROM templates WHERE name = 'hello_world'").get() as any;
    const officialHelloWorldBody = 'Welcome and congratulations! This message demonstrates your ability to send a WhatsApp message using the Cloud API. To learn more, visit the WhatsApp Cloud API documentation for other sample apps, tutorials, and more.';
    if (!hw) {
      db.prepare(`
        INSERT INTO templates (id, name, category, language, header_type, header_content, body_text, footer_text, buttons_json, sample_values_json, status, created_at, updated_at)
        VALUES (?, 'hello_world', 'UTILITY', 'en_US', 'NONE', '', ?, '', '[]', '[]', 'APPROVED', ?, ?)
      `).run(uuidv4(), officialHelloWorldBody, Date.now(), Date.now());
    } else if (hw.status === 'REJECTED') {
      db.prepare(`
        UPDATE templates 
        SET status = 'APPROVED', rejection_reason = '', body_text = ?, header_type = 'NONE', header_content = '', buttons_json = '[]', sample_values_json = '[]', updated_at = ?
        WHERE name = 'hello_world'
      `).run(officialHelloWorldBody, Date.now());
    }
  } catch (e) {
    // Ignore if table not created
  }

  // Seed sample contacts if empty
  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
  if (contactCount.count === 0) {
    const now = Date.now();
    const initialContacts = [
      { name: 'Arjun Mehta', phone: '+919876543211', vars: { 1: 'Arjun', 2: 'GREEN25' }, tag: 'VIP Client' },
      { name: 'Pooja Sharma', phone: '+919876543212', vars: { 1: 'Pooja', 2: 'GREEN25' }, tag: 'Solar Prospect' },
      { name: 'Vikram Singh', phone: '+919876543213', vars: { 1: 'Vikram', 2: 'GREEN25' }, tag: 'Industrial' },
      { name: 'Neha Rao', phone: '+919876543214', vars: { 1: 'Neha', 2: 'GREEN25' }, tag: 'Eco Lead' },
      { name: 'David Miller', phone: '+14155552671', vars: { 1: 'David', 2: 'GREEN25' }, tag: 'International' },
      { name: 'Rohan Gupta', phone: '+919876543216', vars: { 1: 'Rohan', 2: 'GREEN25' }, tag: 'General' },
      { name: 'Ananya Verma', phone: '+919876543217', vars: { 1: 'Ananya', 2: 'GREEN25' }, tag: 'VIP Client' },
      { name: 'Karan Malhotra', phone: '+919876543218', vars: { 1: 'Karan', 2: 'GREEN25' }, tag: 'Solar Prospect' },
      { name: 'Sneha Joshi', phone: '+919876543219', vars: { 1: 'Sneha', 2: 'GREEN25' }, tag: 'General' },
      { name: 'Sameer Patel', phone: '+919876543220', vars: { 1: 'Sameer', 2: 'GREEN25' }, tag: 'Industrial' }
    ];

    const insertContact = db.prepare(`
      INSERT INTO contacts (id, name, phone_number, variables_json, tags, is_opted_out, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);

    for (const c of initialContacts) {
      insertContact.run(uuidv4(), c.name, c.phone, JSON.stringify(c.vars), c.tag, now);
    }

    // Seed 1 active conversation in Query Tab
    const firstContact = db.prepare('SELECT * FROM contacts LIMIT 1').get() as any;
    if (firstContact) {
      const convId = uuidv4();
      const serviceExpires = now + 24 * 60 * 60 * 1000 - 15 * 60 * 1000; // 23h 45m left
      db.prepare(`
        INSERT INTO conversations (id, contact_id, contact_name, phone_number, last_message_text, last_message_at, service_window_expires_at, unread_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(convId, firstContact.id, firstContact.name, firstContact.phone_number, 'Hello! Is this discount applicable for 500+ units purchase?', now - 60000, serviceExpires);

      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, timestamp, status)
        VALUES (?, ?, 'OUTBOUND', 'template', 'Discover IntelliGreen’s new eco-friendly collection! Save up to 25% on your first bulk order with code: GREEN25.', ?, 'delivered')
      `).run(uuidv4(), convId, now - 3600000);

      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, timestamp, status)
        VALUES (?, ?, 'INBOUND', 'text', 'Hello! Is this discount applicable for 500+ units purchase?', ?, 'delivered')
      `).run(uuidv4(), convId, now - 60000);
    }
  }
}

export default db;
