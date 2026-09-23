import db from '../db.ts';
import { v4 as uuidv4 } from 'uuid';
import { eventEmitter } from './eventBus.ts';

export const simulationService = {
  // 1. Simulate Meta's template verification workflow
  async simulateTemplateSubmission(templateId: string) {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any;
    if (!template) return;

    // Immediately mark as PENDING
    db.prepare('UPDATE templates SET status = ?, rejection_reason = ?, updated_at = ? WHERE id = ?')
      .run('PENDING', '', Date.now(), templateId);

    eventEmitter.emit('template_update', { id: templateId, status: 'PENDING' });

    // Simulate Meta automated AI review taking 5 seconds
    setTimeout(() => {
      const current = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any;
      if (!current || current.status !== 'PENDING') return;

      const isRejectionTest = current.name.toLowerCase().includes('reject') ||
                              current.body_text.toLowerCase().includes('violation_test');

      if (isRejectionTest) {
        db.prepare('UPDATE templates SET status = ?, rejection_reason = ?, updated_at = ? WHERE id = ?')
          .run('REJECTED', 'Template rejected by Meta AI: Category misclassification or invalid variable formatting.', Date.now(), templateId);
        eventEmitter.emit('template_update', { id: templateId, status: 'REJECTED' });
      } else {
        const metaId = 'sim_meta_' + Math.floor(100000000 + Math.random() * 900000000);
        db.prepare('UPDATE templates SET status = ?, meta_template_id = ?, rejection_reason = ?, updated_at = ? WHERE id = ?')
          .run('APPROVED', metaId, '', Date.now(), templateId);
        eventEmitter.emit('template_update', { id: templateId, status: 'APPROVED', meta_template_id: metaId });
      }
    }, 5000);
  },

  // 2. Generate large batches of realistic test contacts (up to 1,000+)
  generateTestContacts(count: number = 1000) {
    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Saanvi', 'Myra', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Sneha', 'Rahul', 'Rohan', 'Amit', 'Pooja', 'Sunita', 'Vikram', 'Priya', 'Rajesh', 'Deepak', 'Kavita', 'Suresh', 'Manish', 'Karan', 'Simran', 'Tanvi', 'Ritu', 'Gaurav', 'Nikhil', 'Alok', 'Preeti'];
    const lastNames = ['Sharma', 'Verma', 'Patel', 'Gupta', 'Mehta', 'Singh', 'Kumar', 'Shah', 'Reddy', 'Chopra', 'Nair', 'Iyer', 'Joshi', 'Bose', 'Rao', 'Malhotra', 'Bhatia', 'Saxena', 'Deshmukh', 'Mishra'];
    const tags = ['VIP Client', 'Solar Prospect', 'Commercial', 'Residential', 'General', 'Wholesale Buyer', 'Green Partner'];

    const insertContact = db.prepare(`
      INSERT OR IGNORE INTO contacts (id, name, phone_number, variables_json, tags, is_opted_out, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);

    const existingCountRow = db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    const startingPhone = 919800000000 + existingCountRow.count + 1;
    const now = Date.now();

    const insertMany = db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
        const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
        const fullName = `${fn} ${ln}`;
        const phone = `+${startingPhone + i}`;
        const tag = tags[Math.floor(Math.random() * tags.length)];
        const variables = {
          '1': fn,
          '2': 'GREEN' + (Math.floor(Math.random() * 40) + 10)
        };

        insertContact.run(uuidv4(), fullName, phone, JSON.stringify(variables), tag, now);
      }
    });

    insertMany();
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    return finalCount.count;
  },

  // 3. Simulate an incoming customer reply for the Query Tab
  simulateCustomerReply(contactId: string, text: string, mediaUrl: string = '', messageType: string = 'text') {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId) as any;
    if (!contact) throw new Error('Contact not found');

    const now = Date.now();
    const isOptOut = ['stop', 'unsubscribe', 'stop promo', 'optout', 'cancel'].includes(text.trim().toLowerCase());
    const previewText = text || (messageType === 'image' ? '📷 Image' : messageType === 'video' ? '🎥 Video' : messageType === 'document' ? '📄 Document' : '📎 Media');

    // Check if conversation exists
    let conversation = db.prepare('SELECT * FROM conversations WHERE contact_id = ?').get(contactId) as any;
    const convId = conversation ? conversation.id : uuidv4();
    const serviceExpiresAt = now + 24 * 60 * 60 * 1000; // 24-hour service window

    if (conversation) {
      db.prepare(`
        UPDATE conversations
        SET last_message_text = ?, last_message_at = ?, service_window_expires_at = ?, unread_count = unread_count + 1
        WHERE id = ?
      `).run(previewText, now, serviceExpiresAt, convId);
    } else {
      db.prepare(`
        INSERT INTO conversations (id, contact_id, contact_name, phone_number, last_message_text, last_message_at, service_window_expires_at, unread_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(convId, contact.id, contact.name, contact.phone_number, previewText, now, serviceExpiresAt);
    }

    // Insert chat message with media
    const msgId = uuidv4();
    db.prepare(`
      INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, media_url, status, timestamp)
      VALUES (?, ?, 'INBOUND', ?, ?, ?, 'delivered', ?)
    `).run(msgId, convId, messageType, text, mediaUrl, now);

    // Auto-opt out handling (Anti-Ban feature)
    if (isOptOut) {
      db.prepare('UPDATE contacts SET is_opted_out = 1, opted_out_at = ? WHERE id = ?').run(now, contact.id);

      // System auto-acknowledgment message
      const sysMsgId = uuidv4();
      const ackText = 'You have been successfully unsubscribed from IntelliGreen marketing updates. You will receive no further promotional messages.';
      db.prepare(`
        INSERT INTO chat_messages (id, conversation_id, direction, message_type, content, status, timestamp)
        VALUES (?, ?, 'OUTBOUND', 'text', ?, 'sent', ?)
      `).run(sysMsgId, convId, ackText, now + 500);

      db.prepare('UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?')
        .run(ackText, now + 500, convId);
    }

    eventEmitter.emit('new_chat_message', {
      id: msgId,
      conversation_id: convId,
      direction: 'INBOUND',
      content: text,
      media_url: mediaUrl,
      message_type: messageType,
      timestamp: now
    });

    return { conversationId: convId, messageId: msgId, isOptOut };
  }
};
