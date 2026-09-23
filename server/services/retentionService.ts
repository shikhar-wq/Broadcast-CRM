import fs from 'fs';
import path from 'path';
import db from '../db.ts';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const retentionService = {
  // Prune chat history older than 7 days
  pruneOldChatHistory(): { deletedMessages: number; deletedFiles: number } {
    const cutoffTimestamp = Date.now() - SEVEN_DAYS_MS;

    // 1. Find messages older than 7 days that have media attachments
    const oldMessages = db.prepare(`
      SELECT id, media_url 
      FROM chat_messages 
      WHERE timestamp < ?
    `).all(cutoffTimestamp) as Array<{ id: string; media_url: string }>;

    let deletedFilesCount = 0;

    // 2. Safely remove associated local files if they are not used by templates or other messages
    for (const msg of oldMessages) {
      if (msg.media_url && msg.media_url.includes('/uploads/')) {
        const filename = msg.media_url.split('/uploads/').pop()?.split('?')[0];
        if (filename) {
          // Check if file is still used in active templates or newer messages
          const inTemplates = db.prepare('SELECT id FROM templates WHERE header_content LIKE ?').get(`%${filename}%`);
          const inOtherMsgs = db.prepare('SELECT id FROM chat_messages WHERE media_url LIKE ? AND timestamp >= ?').get(`%${filename}%`, cutoffTimestamp);

          if (!inTemplates && !inOtherMsgs) {
            const localFilePath = path.resolve('data', 'uploads', filename);
            if (fs.existsSync(localFilePath)) {
              try {
                fs.unlinkSync(localFilePath);
                deletedFilesCount++;
              } catch (e) {
                // Ignore file lock errors
              }
            }
          }
        }
      }
    }

    // 3. Delete messages older than 7 days from the database
    const deleteResult = db.prepare(`
      DELETE FROM chat_messages 
      WHERE timestamp < ?
    `).run(cutoffTimestamp);

    const deletedCount = deleteResult.changes;

    // 4. Update conversation summaries to reflect latest remaining message
    const conversations = db.prepare('SELECT id FROM conversations').all() as Array<{ id: string }>;
    for (const conv of conversations) {
      const latestMsg = db.prepare(`
        SELECT content, timestamp 
        FROM chat_messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `).get(conv.id) as { content: string; timestamp: number } | undefined;

      if (latestMsg) {
        db.prepare(`
          UPDATE conversations 
          SET last_message_text = ?, last_message_at = ? 
          WHERE id = ?
        `).run(latestMsg.content, latestMsg.timestamp, conv.id);
      }
    }

    if (deletedCount > 0) {
      console.log(`[7-Day Auto-Retention] Automatically purged ${deletedCount} message(s) older than 7 days (${deletedFilesCount} file(s) removed).`);
    }

    return { deletedMessages: deletedCount, deletedFiles: deletedFilesCount };
  },

  // Initialize auto-retention timer running every hour
  initRetentionSchedule() {
    // Run once on server startup
    try {
      this.pruneOldChatHistory();
    } catch (err: any) {
      console.error('[Retention Schedule Error on startup]:', err.message);
    }

    // Schedule cleanup every 1 hour (3600000 ms)
    setInterval(() => {
      try {
        this.pruneOldChatHistory();
      } catch (err: any) {
        console.error('[Recurring Retention Schedule Error]:', err.message);
      }
    }, 60 * 60 * 1000);

    console.log('[Retention Service] 7-Day chat history auto-cleanup scheduler active (runs hourly).');
  }
};
