import { Template, Contact, Campaign, Conversation, ChatMessage, AppSettings, UploadResponse } from './types';

const API_BASE = '/api';

export const api = {
  // Settings
  async getSettings(): Promise<AppSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return await res.json();
    } catch {
      return {
        id: 1,
        mode: 'SIMULATION',
        waba_id: '',
        phone_number_id: '',
        access_token: '',
        webhook_verify_token: 'intelligreen_secret_token_123',
        quality_rating: 'GREEN',
        messaging_tier: 'TIER_1',
        updated_at: Date.now(),
      };
    }
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async testMeta(credentials: { accessToken?: string; phoneNumberId?: string; wabaId?: string }): Promise<{
    success: boolean;
    message: string;
    phone_info?: any;
    token_info?: any;
    expiry_desc?: string;
    error_code?: number;
    error_message?: string;
    hint?: string;
  }> {
    const res = await fetch(`${API_BASE}/settings/test-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: credentials.accessToken,
        phone_number_id: credentials.phoneNumberId,
        waba_id: credentials.wabaId,
      }),
    });
    return res.json();
  },

  async testImageKit(credentials: { publicKey: string; privateKey: string; urlEndpoint: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/settings/test-imagekit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return res.json();
  },

  async testSupabase(credentials: { url: string; anonKey: string; bucket: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/settings/test-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return res.json();
  },

  // Media Upload (supports ImageKit CDN or secure local storage)
  async uploadMedia(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Failed to upload media file');
    }

    return res.json();
  },

  // Templates
  async getTemplates(): Promise<Template[]> {
    try {
      const res = await fetch(`${API_BASE}/templates`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async createTemplate(templateData: any): Promise<Template> {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create template' }));
      throw new Error(err.error || 'Failed to create template');
    }
    return res.json();
  },

  async submitTemplate(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/${id}/submit`, { method: 'POST' });
    return res.json();
  },

  async deleteTemplate(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async syncTemplates(): Promise<{ success: boolean; syncedCount: number; templates: Template[] }> {
    const res = await fetch(`${API_BASE}/templates/sync`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sync templates from Meta');
    }
    return data;
  },

  async sendTestTemplate(id: string, phoneNumber: string, variables: Record<string, string> = {}): Promise<any> {
    const res = await fetch(`${API_BASE}/templates/${id}/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber, variables }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send test template');
    }
    return data;
  },

  // Contacts
  async getContacts(params?: { search?: string; tag?: string; optedOut?: boolean; limit?: number; offset?: number }) {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.tag) query.set('tag', params.tag);
      if (params?.optedOut !== undefined) query.set('optedOut', String(params.optedOut));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));

      const res = await fetch(`${API_BASE}/contacts?${query.toString()}`);
      if (!res.ok) return { contacts: [], total: 0, filteredTotal: 0, optedOutCount: 0, activeCount: 0 };
      const data = await res.json();
      return {
        contacts: Array.isArray(data.contacts) ? data.contacts : [],
        total: typeof data.total === 'number' ? data.total : 0,
        filteredTotal: typeof data.filteredTotal === 'number' ? data.filteredTotal : (data.total || 0),
        optedOutCount: typeof data.optedOutCount === 'number' ? data.optedOutCount : 0,
        activeCount: typeof data.activeCount === 'number' ? data.activeCount : 0,
      };
    } catch {
      return { contacts: [], total: 0, filteredTotal: 0, optedOutCount: 0, activeCount: 0 };
    }
  },

  async getTags(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/contacts/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async createContact(data: { name: string; phone_number: string; variables?: Record<string, string>; tags?: string }) {
    const res = await fetch(`${API_BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add contact' }));
      throw new Error(err.error || 'Failed to add contact');
    }
    return res.json();
  },

  async deleteContact(id: string) {
    const res = await fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete contact' }));
      throw new Error(err.error || 'Failed to delete contact');
    }
    return res.json();
  },

  async toggleOptOut(id: string) {
    const res = await fetch(`${API_BASE}/contacts/${id}/toggle-opt-out`, { method: 'POST' });
    return res.json();
  },

  async clearAllContacts(passkey: string) {
    const res = await fetch(`${API_BASE}/contacts/clear-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to clear contacts' }));
      throw new Error(err.error || 'Failed to clear contacts');
    }
    return res.json();
  },

  // Campaigns & Broadcast
  async getCampaigns(): Promise<Campaign[]> {
    try {
      const res = await fetch(`${API_BASE}/campaigns`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async getCampaignDetails(id: string) {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async createCampaign(data: { name: string; template_id: string; messages_per_second?: number; target_tags?: string }) {
    const res = await fetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create campaign' }));
      throw new Error(err.error || 'Failed to create campaign');
    }
    return res.json();
  },

  async startCampaign(id: string) {
    const res = await fetch(`${API_BASE}/campaigns/${id}/start`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to start broadcast' }));
      throw new Error(err.error || 'Failed to start broadcast');
    }
    return res.json();
  },

  async pauseCampaign(id: string) {
    const res = await fetch(`${API_BASE}/campaigns/${id}/pause`, { method: 'POST' });
    return res.json();
  },

  async stopCampaign(id: string) {
    const res = await fetch(`${API_BASE}/campaigns/${id}/stop`, { method: 'POST' });
    return res.json();
  },

  // Query Inbox
  async getConversations(): Promise<Conversation[]> {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async getConversationMessages(id: string): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}/messages`);
      if (!res.ok) {
        return {
          conversation: {
            id,
            contact_id: '',
            contact_name: 'Contact',
            phone_number: '',
            last_message_text: '',
            last_message_at: Date.now(),
            service_window_expires_at: Date.now(),
            unread_count: 0,
          },
          messages: [],
        };
      }
      return await res.json();
    } catch {
      return {
        conversation: {
          id,
          contact_id: '',
          contact_name: 'Contact',
          phone_number: '',
          last_message_text: '',
          last_message_at: Date.now(),
          service_window_expires_at: Date.now(),
          unread_count: 0,
        },
        messages: [],
      };
    }
  },

  async sendReply(id: string, text: string, media_url?: string, media_type?: string) {
    const res = await fetch(`${API_BASE}/conversations/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, media_url, media_type }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send reply' }));
      throw new Error(err.error || 'Failed to send reply');
    }
    return res.json();
  },

  async sendConversationTemplate(id: string, template_id: string, variables: Record<string, string> = {}) {
    const res = await fetch(`${API_BASE}/conversations/${id}/send-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id, variables }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send template' }));
      throw new Error(err.error || 'Failed to send template');
    }
    return res.json();
  },

  async pruneChatHistory() {
    const res = await fetch(`${API_BASE}/conversations/prune-history`, {
      method: 'POST',
    });
    return res.json();
  },
};
