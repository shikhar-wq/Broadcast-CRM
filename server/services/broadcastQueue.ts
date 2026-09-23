import db from '../db.ts';
import { v4 as uuidv4 } from 'uuid';
import { eventEmitter } from './eventBus.ts';
import { metaService } from './metaService.ts';

interface RunningJob {
  campaignId: string;
  isPaused: boolean;
  isStopped: boolean;
  timeoutRef?: NodeJS.Timeout;
}

const activeJobs = new Map<string, RunningJob>();

export const broadcastQueue = {
  // Start or resume a campaign
  async startCampaign(campaignId: string) {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as any;
    if (!campaign) throw new Error('Campaign not found');

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(campaign.template_id) as any;
    if (!template) throw new Error('Template not found');
    if (template.status !== 'APPROVED') {
      throw new Error(`Cannot broadcast: Template is currently ${template.status}. Only APPROVED templates can be broadcasted.`);
    }

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

    // Check if already active
    if (activeJobs.has(campaignId)) {
      const job = activeJobs.get(campaignId)!;
      if (job.isPaused) {
        job.isPaused = false;
        db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('RUNNING', campaignId);
        eventEmitter.emit('campaign_update', { id: campaignId, status: 'RUNNING' });
        this.processNext(campaignId, settings, template);
        return;
      }
      return;
    }

    // Set status to RUNNING
    db.prepare('UPDATE campaigns SET status = ?, started_at = COALESCE(started_at, ?) WHERE id = ?')
      .run('RUNNING', Date.now(), campaignId);

    activeJobs.set(campaignId, {
      campaignId,
      isPaused: false,
      isStopped: false
    });

    eventEmitter.emit('campaign_update', { id: campaignId, status: 'RUNNING' });

    // Begin processing
    this.processNext(campaignId, settings, template);
  },

  // Process messages one by one with rate limiting & jitter
  async processNext(campaignId: string, settings: any, template: any) {
    const job = activeJobs.get(campaignId);
    if (!job || job.isPaused || job.isStopped) return;

    // Fetch next queued message
    const msg = db.prepare(`
      SELECT cm.*, c.is_opted_out, c.variables_json
      FROM campaign_messages cm
      JOIN contacts c ON cm.contact_id = c.id
      WHERE cm.campaign_id = ? AND cm.status = 'queued'
      ORDER BY cm.rowid ASC
      LIMIT 1
    `).get(campaignId) as any;

    if (!msg) {
      // Campaign completed
      db.prepare('UPDATE campaigns SET status = ?, completed_at = ? WHERE id = ?')
        .run('COMPLETED', Date.now(), campaignId);
      activeJobs.delete(campaignId);
      eventEmitter.emit('campaign_update', { id: campaignId, status: 'COMPLETED' });
      return;
    }

    // Check if contact opted out in the meantime (Anti-Ban safeguard)
    if (msg.is_opted_out === 1) {
      db.prepare('UPDATE campaign_messages SET status = ?, error_message = ? WHERE id = ?')
        .run('suppressed', 'Recipient has opted out/unsubscribed.', msg.id);
      db.prepare('UPDATE campaigns SET suppressed_count = suppressed_count + 1 WHERE id = ?')
        .run(campaignId);
      
      this.scheduleNext(campaignId, settings, template);
      return;
    }

    const now = Date.now();
    const variables = msg.variables_json ? JSON.parse(msg.variables_json) : {};

    if (settings.mode === 'SIMULATION') {
      // Simulation dispatch
      const simWamid = 'wamid.HBg' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      db.prepare('UPDATE campaign_messages SET status = ?, wamid = ?, sent_at = ? WHERE id = ?')
        .run('sent', simWamid, now, msg.id);
      db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?')
        .run(campaignId);

      // Emit progress with latest stats
      const campStats = db.prepare('SELECT sent_count, delivered_count, read_count, failed_count, suppressed_count, total_contacts FROM campaigns WHERE id = ?').get(campaignId) as any;
      eventEmitter.emit('campaign_progress', {
        campaignId,
        messageId: msg.id,
        phone: msg.phone_number,
        status: 'sent',
        ...campStats
      });

      // Safely simulate Delivery after 1.2 - 2.5 seconds
      setTimeout(() => {
        try {
          const isDelivered = Math.random() > 0.02; // 98% delivery rate
          if (isDelivered) {
            db.prepare('UPDATE campaign_messages SET status = ?, delivered_at = ? WHERE id = ?')
              .run('delivered', Date.now(), msg.id);
            db.prepare('UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = ?')
              .run(campaignId);

            // Safely simulate Read receipt after 2 - 4 seconds (75% read rate)
            if (Math.random() > 0.25) {
              setTimeout(() => {
                try {
                  db.prepare('UPDATE campaign_messages SET status = ?, read_at = ? WHERE id = ?')
                    .run('read', Date.now(), msg.id);
                  db.prepare('UPDATE campaigns SET read_count = read_count + 1 WHERE id = ?')
                    .run(campaignId);

                  const updatedStats = db.prepare('SELECT sent_count, delivered_count, read_count, failed_count, suppressed_count, total_contacts FROM campaigns WHERE id = ?').get(campaignId) as any;
                  eventEmitter.emit('campaign_progress', { campaignId, messageId: msg.id, status: 'read', ...updatedStats });
                } catch (readErr) {
                  // Silent catch to prevent crash
                }
              }, 2000 + Math.random() * 2000);
            }
          } else {
            db.prepare('UPDATE campaign_messages SET status = ?, error_message = ? WHERE id = ?')
              .run('failed', 'Simulated network timeout or unreachable phone number.', msg.id);
            db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?')
              .run(campaignId);
          }

          const curStats = db.prepare('SELECT sent_count, delivered_count, read_count, failed_count, suppressed_count, total_contacts FROM campaigns WHERE id = ?').get(campaignId) as any;
          eventEmitter.emit('campaign_progress', { campaignId, messageId: msg.id, status: isDelivered ? 'delivered' : 'failed', ...curStats });
        } catch (deliveryErr) {
          // Silent catch to prevent crash
        }
      }, 1200 + Math.random() * 1200);

    } else {
      // Live Meta API dispatch
      try {
        const res = await metaService.sendTemplateMessage(msg.phone_number, template, variables, settings);
        const wamid = res?.messages?.[0]?.id || '';
        db.prepare('UPDATE campaign_messages SET status = ?, wamid = ?, sent_at = ? WHERE id = ?')
          .run('sent', wamid, now, msg.id);
        db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?')
          .run(campaignId);

        eventEmitter.emit('campaign_progress', { campaignId, messageId: msg.id, status: 'sent' });
      } catch (err: any) {
        const errMsg = err.response?.data?.error?.message || err.message || 'Dispatch error';
        const errCode = err.response?.data?.error?.code;

        db.prepare('UPDATE campaign_messages SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', errMsg, msg.id);
        db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?')
          .run(campaignId);

        eventEmitter.emit('campaign_progress', { campaignId, messageId: msg.id, status: 'failed', error: errMsg });

        // Circuit breaker: Rate limit hit from Meta
        if (errCode === 130429 || errCode === 131026) {
          console.warn(`[Anti-Ban Circuit Breaker] Pausing campaign ${campaignId} due to Meta rate limit or warning.`);
          this.pauseCampaign(campaignId);
          return;
        }
      }
    }

    this.scheduleNext(campaignId, settings, template);
  },

  scheduleNext(campaignId: string, settings: any, template: any) {
    const campaign = db.prepare('SELECT messages_per_second FROM campaigns WHERE id = ?').get(campaignId) as any;
    const mps = campaign?.messages_per_second || 5;

    // Base interval in milliseconds (e.g. 5 MPS = 200ms)
    const baseInterval = Math.max(50, Math.floor(1000 / mps));
    // Add jitter (-30ms to +50ms) to avoid synthetic robotic intervals
    const jitter = Math.floor(Math.random() * 80) - 30;
    const delay = Math.max(30, baseInterval + jitter);

    const job = activeJobs.get(campaignId);
    if (job && !job.isPaused && !job.isStopped) {
      job.timeoutRef = setTimeout(() => {
        this.processNext(campaignId, settings, template);
      }, delay);
    }
  },

  // Pause campaign
  pauseCampaign(campaignId: string) {
    const job = activeJobs.get(campaignId);
    if (job) {
      job.isPaused = true;
      if (job.timeoutRef) clearTimeout(job.timeoutRef);
    }
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('PAUSED', campaignId);
    eventEmitter.emit('campaign_update', { id: campaignId, status: 'PAUSED' });
  },

  // Stop / Cancel campaign
  stopCampaign(campaignId: string) {
    const job = activeJobs.get(campaignId);
    if (job) {
      job.isStopped = true;
      if (job.timeoutRef) clearTimeout(job.timeoutRef);
      activeJobs.delete(campaignId);
    }
    db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('PAUSED', campaignId);
    eventEmitter.emit('campaign_update', { id: campaignId, status: 'PAUSED' });
  }
};
