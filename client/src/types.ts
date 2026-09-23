export interface Template {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  header_type: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  header_content: string;
  body_text: string;
  footer_text: string;
  buttons_json: string; // JSON string of TemplateButton[]
  sample_values_json: string; // JSON string of string[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';
  rejection_reason?: string;
  meta_template_id?: string;
  created_at: number;
  updated_at: number;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone_number: string;
  variables_json: string;
  tags: string;
  is_opted_out: number; // 0 or 1
  opted_out_at?: number;
  created_at: number;
}

export interface Campaign {
  id: string;
  name: string;
  template_id: string;
  template_name?: string;
  template_category?: string;
  header_type?: string;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  suppressed_count: number;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  messages_per_second: number;
  started_at?: number;
  completed_at?: number;
  created_at: number;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  phone_number: string;
  contact_name: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'suppressed';
  wamid?: string;
  error_message?: string;
  sent_at?: number;
  delivered_at?: number;
  read_at?: number;
}

export interface Conversation {
  id: string;
  contact_id: string;
  contact_name: string;
  phone_number: string;
  last_message_text: string;
  last_message_at: number;
  service_window_expires_at: number;
  unread_count: number;
  is_opted_out?: number;
  tags?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  message_type: 'text' | 'template' | 'image' | 'video' | 'button_reply';
  content: string;
  media_url?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  wamid?: string;
  error_message?: string;
  timestamp: number;
}

export interface AppSettings {
  id: number;
  mode: 'SIMULATION' | 'LIVE';
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  webhook_verify_token: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED';
  messaging_tier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'UNVERIFIED_TRIAL';
  storage_provider?: 'BUILTIN' | 'SUPABASE' | 'IMAGEKIT';
  public_url?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_bucket?: string;
  imagekit_public_key?: string;
  imagekit_private_key?: string;
  imagekit_url_endpoint?: string;
  updated_at: number;
}

export interface UploadResponse {
  url: string;
  provider: 'builtin' | 'supabase' | 'imagekit' | 'local';
  fileType: 'IMAGE' | 'VIDEO';
  fileName: string;
  size: number;
  message?: string;
}
