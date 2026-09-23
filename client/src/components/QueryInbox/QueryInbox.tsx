import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Search, CheckCheck, Sparkles, Clock, 
  Paperclip, Video, FileText, X, Eye, Loader2, Radio, 
  Copy, Check, Info, ShieldCheck, Trash2, ChevronLeft, AlertCircle
} from 'lucide-react';
import { Conversation, ChatMessage, Template } from '../../types';
import { api } from '../../api';

interface QueryInboxProps {
  conversations: Conversation[];
  onRefreshConversations: () => void;
  isSimulationMode: boolean;
}

interface AttachedMedia {
  url: string;
  name: string;
  type: 'image' | 'video' | 'document';
  size?: number;
}

export const QueryInbox: React.FC<QueryInboxProps> = ({
  conversations,
  onRefreshConversations,
  isSimulationMode
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(conversations[0]?.id || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Mobile navigation state ('LIST' = conversation list on mobile, 'CHAT' = active chat thread)
  const [mobileView, setMobileView] = useState<'LIST' | 'CHAT'>('LIST');

  // Media attachment state
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Webhook guide & retention modal state
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [pruneStatus, setPruneStatus] = useState<string | null>(null);

  // Send Template directly within conversation modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedConvId && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Load messages when conversation changes or when conversations array updates
  useEffect(() => {
    if (selectedConvId) {
      api.getConversationMessages(selectedConvId).then((data) => {
        setMessages(data.messages || []);
        setActiveConv(data.conversation || null);
      });
    }
  }, [selectedConvId, conversations]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection and upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected if removed
    e.target.value = '';

    // Max 50 MB check
    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50 MB limit.');
      return;
    }

    setIsUploadingMedia(true);
    try {
      const res = await api.uploadMedia(file);
      let mediaType: 'image' | 'video' | 'document' = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';

      setAttachedMedia({
        url: res.url,
        name: file.name,
        type: mediaType,
        size: file.size
      });
    } catch (err: any) {
      alert(`Failed to upload media: ${err.message}`);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !attachedMedia) || !selectedConvId) return;

    setIsSending(true);
    try {
      setErrorBanner(null);
      await api.sendReply(
        selectedConvId,
        replyText.trim(),
        attachedMedia?.url,
        attachedMedia?.type
      );
      setReplyText('');
      setAttachedMedia(null);
      const data = await api.getConversationMessages(selectedConvId);
      setMessages(data.messages || []);
      setActiveConv(data.conversation || null);
      onRefreshConversations();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleManualPrune = async () => {
    try {
      const res = await api.pruneChatHistory();
      setPruneStatus(`Cleaned ${res.deletedMessages || 0} expired messages.`);
      onRefreshConversations();
      if (selectedConvId) {
        const data = await api.getConversationMessages(selectedConvId);
        setMessages(data.messages || []);
      }
      setTimeout(() => setPruneStatus(null), 3500);
    } catch (err: any) {
      alert('Pruning failed: ' + err.message);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText('intelligreen_secret_token_123');
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleOpenTemplateModal = async () => {
    try {
      const templates = await api.getTemplates();
      const approved = templates.filter((t) => t.status === 'APPROVED');
      const listToUse = approved.length > 0 ? approved : templates;
      setAvailableTemplates(listToUse);
      if (listToUse.length > 0) {
        setSelectedTemplateId(listToUse[0].id);
      }
      setShowTemplateModal(true);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleSendTemplate = async () => {
    if (!selectedConvId || !selectedTemplateId) return;
    setIsSendingTemplate(true);
    try {
      setErrorBanner(null);
      await api.sendConversationTemplate(selectedConvId, selectedTemplateId);
      setShowTemplateModal(false);
      const data = await api.getConversationMessages(selectedConvId);
      setMessages(data.messages || []);
      setActiveConv(data.conversation || null);
      onRefreshConversations();
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to dispatch template');
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const filtered = conversations.filter(
    (c) =>
      c.contact_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.phone_number.includes(searchFilter) ||
      c.last_message_text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-2 sm:space-y-3 max-w-6xl mx-auto h-[calc(100dvh-130px)] md:h-[calc(100vh-140px)] min-h-[500px] max-h-[850px] flex flex-col">
      {/* Header with Title, Auto-Retention, and Swipeable Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">Queries & Live Chat</h1>
            {/* 7-Day Auto-Retention Active Badge */}
            <div 
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-[11px] font-medium cursor-help"
              title="Auto-Retention: Messages older than 7 days are automatically purged to keep storage clean and fast."
            >
              <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden xs:inline">7-Day Retention</span>
              <span className="xs:hidden">7d Purge</span>
            </div>
            {pruneStatus && (
              <span className="text-[10px] sm:text-[11px] text-emerald-300 animate-fadeIn truncate">{pruneStatus}</span>
            )}
          </div>
        </div>

        {/* Swipeable Action Pills on Mobile, flex-wrap on desktop */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0 max-w-full">
          {/* Live Phone Sync Webhook Guide Button */}
          <button
            onClick={() => setShowWebhookGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-all font-medium whitespace-nowrap shrink-0"
            title="Setup Meta Webhook so replies typed on your phone appear here live"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span>Phone Sync</span>
          </button>

          {/* Purge Expired Manual Trigger */}
          <button
            onClick={handleManualPrune}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs hover:text-slate-200 hover:bg-slate-850 transition-all whitespace-nowrap shrink-0"
            title="Purge chat history older than 7 days immediately"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Purge &gt; 7d</span>
          </button>
        </div>
      </div>

      {/* Main Locked Scrollable Chat Window (WhatsApp Mobile & Desktop Pattern) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 shadow-xl">
        {/* Left Column: Contact List (Visible on desktop, or when mobileView === 'LIST') */}
        <div className={`lg:col-span-4 border-r border-slate-800/80 flex-col h-full overflow-hidden bg-slate-950/40 ${mobileView === 'CHAT' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-2.5 sm:p-3 border-b border-slate-800/80 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search queries..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No active conversations yet. Send a broadcast or template to start chatting!
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = selectedConvId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedConvId(c.id);
                      setMobileView('CHAT');
                    }}
                    className={`w-full text-left p-3 transition-all flex items-start gap-2.5 hover:bg-slate-850 ${
                      isSelected ? 'bg-slate-850/80 border-l-2 border-emerald-400' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-medium text-slate-200 text-xs shrink-0">
                      {c.contact_name.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-white truncate">
                          {c.contact_name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs truncate mt-0.5">
                        {c.last_message_text}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Thread (Visible on desktop, or when mobileView === 'CHAT') */}
        <div className={`lg:col-span-8 flex-col h-full overflow-hidden bg-[#0b141a] ${mobileView === 'LIST' ? 'hidden lg:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              {/* Clean Chat Header with Mobile Back Button */}
              <div className="bg-[#1f2c34] px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  {/* Back to List button for Mobile view */}
                  <button
                    type="button"
                    onClick={() => setMobileView('LIST')}
                    className="lg:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all shrink-0 flex items-center gap-0.5"
                    title="Back to conversation list"
                  >
                    <ChevronLeft className="w-5 h-5 text-emerald-400" />
                  </button>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-xs text-white truncate">{activeConv.contact_name}</h3>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 truncate block">{activeConv.phone_number}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeConv.is_opted_out === 1 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Unsubscribed
                    </span>
                  ) : activeConv.service_window_expires_at > Date.now() ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span className="hidden sm:inline">24h Service Window Active</span>
                      <span className="sm:hidden">24h Active</span>
                    </span>
                  ) : (
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 cursor-help"
                      title="24h Customer Service Window is closed. To chat, customer must send a message to +1 555-191-0444 first, or you can send an approved template."
                    >
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span className="hidden sm:inline">24h Window Closed</span>
                      <span className="sm:hidden">Window Closed</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenTemplateModal}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-medium flex items-center gap-1 transition-all"
                    title="Send Template Message"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    <span className="hidden xs:inline">Send Template</span>
                  </button>
                </div>
              </div>

              {/* Chat Canvas (Independently Scrollable with Native Feel) */}
              <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 wa-chat-bg min-h-0">
                {messages.map((m) => {
                  const isOutbound = m.direction === 'OUTBOUND';
                  const hasMedia = Boolean(m.media_url);
                  const isVideo = hasMedia && (m.message_type === 'video' || m.media_url?.match(/\.(mp4|webm|mov|ogg)/i));
                  const isImage = hasMedia && (m.message_type === 'image' || m.media_url?.match(/\.(jpeg|jpg|png|webp|gif)/i));

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] sm:max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                          isOutbound
                            ? 'bg-[#005c4b] text-slate-100 rounded-tr-none'
                            : 'bg-[#202c33] text-slate-200 rounded-tl-none border border-slate-700/30'
                        }`}
                      >
                        {/* Media Attachment Rendering */}
                        {hasMedia && (
                          <div className="mb-2">
                            {isImage && (
                              <div
                                className="relative rounded-xl overflow-hidden cursor-pointer group bg-black/30 max-w-xs sm:max-w-sm max-h-52"
                                onClick={() => setLightboxMedia({ url: m.media_url!, type: 'image' })}
                              >
                                <img
                                  src={m.media_url}
                                  alt="Chat media"
                                  className="w-full max-h-52 max-w-xs sm:max-w-sm object-cover rounded-xl group-hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                  onError={(e) => {
                                    // Cleanly hide broken image badges
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-5 h-5 text-white drop-shadow" />
                                </div>
                              </div>
                            )}

                            {isVideo && (
                              <div className="rounded-xl overflow-hidden bg-black max-w-xs sm:max-w-sm max-h-52 shadow-md">
                                <video
                                  src={m.media_url}
                                  controls
                                  className="w-full max-h-52 object-contain rounded-xl"
                                  preload="metadata"
                                />
                              </div>
                            )}

                            {!isImage && !isVideo && (
                              <a
                                href={m.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-slate-700/50 hover:bg-black/50 transition-all text-emerald-300"
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate flex-1 text-[11px] underline">View Attached File</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Text Content */}
                        {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}

                        {/* Error Callout if Failed */}
                        {m.status === 'failed' && m.error_message && (
                          <div className="mt-1.5 p-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-[10px] text-rose-200 leading-tight flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{m.error_message}</span>
                          </div>
                        )}

                        {/* Timestamp & Status Checkmarks */}
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400/80 mt-1">
                          <span>
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isOutbound && (
                            <>
                              {m.status === 'failed' ? (
                                <span className="flex items-center gap-0.5 text-rose-400 font-semibold" title={m.error_message || 'Delivery failed'}>
                                  <AlertCircle className="w-3 h-3 text-rose-400" />
                                  <span>Failed</span>
                                </span>
                              ) : m.status === 'read' ? (
                                <span title="Read by recipient"><CheckCheck className="w-3 h-3 text-sky-400" /></span>
                              ) : m.status === 'delivered' ? (
                                <span title="Delivered to phone"><CheckCheck className="w-3 h-3 text-slate-300" /></span>
                              ) : (
                                <span title="Sent to WhatsApp"><Check className="w-3 h-3 text-slate-400" /></span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Attached Media Staging Preview (Pinned above input) */}
              {attachedMedia && (
                <div className="bg-[#182229] px-3 py-2 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {attachedMedia.type === 'image' && (
                      <img
                        src={attachedMedia.url}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-700 shrink-0"
                      />
                    )}
                    {attachedMedia.type === 'video' && (
                      <div className="w-10 h-10 rounded-lg bg-black/80 flex items-center justify-center border border-slate-700 shrink-0 text-emerald-400">
                        <Video className="w-5 h-5" />
                      </div>
                    )}
                    {attachedMedia.type === 'document' && (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 text-sky-400">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{attachedMedia.name}</p>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {attachedMedia.type} {attachedMedia.size ? `(${Math.round(attachedMedia.size / 1024)} KB)` : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setAttachedMedia(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                    title="Remove attached media"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Dismissible Error Banner */}
              {errorBanner && (
                <div className="bg-rose-500/15 border-t border-b border-rose-500/30 px-3 py-2 flex items-center justify-between text-xs text-rose-300 shrink-0 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorBanner}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setErrorBanner(null)} 
                    className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Informative Warning Banner when 24-hr window is closed */}
              {activeConv && activeConv.service_window_expires_at <= Date.now() && (
                <div className="bg-amber-500/10 border-t border-b border-amber-500/25 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200 shrink-0 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="leading-snug">
                      <strong>24h Service Window Closed:</strong> Under Meta WhatsApp policies, freeform messages won't deliver until <strong>{activeConv.contact_name}</strong> sends a message to your WhatsApp number (<code>+1 555-191-0444</code>) or you dispatch an approved Template.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenTemplateModal}
                    className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] shrink-0 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Send Template</span>
                  </button>
                </div>
              )}

              {/* Reply Input Form (Permanently Pinned at Bottom) */}
              <form onSubmit={handleSendReply} className="bg-[#1f2c34] p-2 sm:p-2.5 border-t border-slate-800 flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  className="hidden"
                />

                {/* Media Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingMedia || isSending}
                  className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-[#2a3942] transition-all disabled:opacity-50 relative shrink-0"
                  title="Attach Photo, Video (up to 50MB), or Document"
                >
                  {isUploadingMedia ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={attachedMedia ? "Add caption..." : "Type response..."}
                  className="flex-1 bg-[#2a3942] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-slate-500"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isSending || isUploadingMedia || (!replyText.trim() && !attachedMedia)}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden xs:inline">Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Media Modal */}
      {lightboxMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setLightboxMedia(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxMedia(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            {lightboxMedia.type === 'image' ? (
              <img
                src={lightboxMedia.url}
                alt="Full size"
                className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-slate-800"
              />
            ) : (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded-xl shadow-2xl bg-black border border-slate-800"
              />
            )}
          </div>
        </div>
      )}

      {/* Live Phone Sync Webhook Setup Guide Modal */}
      {showWebhookGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm text-white">Live WhatsApp Phone Sync</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">Why phone replies don't show yet & how to connect</p>
                </div>
              </div>
              <button
                onClick={() => setShowWebhookGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <p className="font-medium text-white flex items-center gap-1.5 text-xs">
                  <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Why does Meta block physical phone messages in Development Mode?
                </p>
                <p className="text-slate-400 text-[11px]">
                  Meta strictly enforces a security rule: While an app is in <strong>Development Mode</strong>, real incoming messages from physical phones are blocked from webhooks. Only test events from the dashboard or when switched to <strong>Live Mode</strong> are forwarded.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-white text-xs">Your Live Webhook URL & Token:</p>
                
                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-medium text-emerald-400">Callback URL:</span>
                    <code className="block p-1.5 rounded bg-slate-900 text-slate-200 font-mono text-[10px] sm:text-[11px] break-all select-all">
                      {window.location.origin}/webhook
                    </code>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-medium text-emerald-400">Verify Token:</span> 
                    <div className="flex items-center justify-between">
                      <code className="text-emerald-300 bg-slate-900 px-2 py-0.5 rounded font-mono text-xs">
                        intelligreen_secret_token_123
                      </code>
                      <button
                        onClick={handleCopyToken}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:text-white flex items-center gap-1 text-[11px]"
                      >
                        {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setShowWebhookGuide(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-all"
              >
                Got It, Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Template Directly from Chat Modal */}
      {showTemplateModal && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm text-white">Send Template Message</h3>
                  <p className="text-[10px] text-slate-400">To: {activeConv.contact_name} ({activeConv.phone_number})</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Select Approved Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-700"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status}) - {t.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Preview */}
              {availableTemplates.find((t) => t.id === selectedTemplateId) && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Preview</span>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {availableTemplates.find((t) => t.id === selectedTemplateId)?.body_text}
                  </p>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-snug">
                Template messages bypass the 24-hour service window and will deliver directly to {activeConv.contact_name}'s phone.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                disabled={isSendingTemplate}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTemplate}
                disabled={isSendingTemplate || !selectedTemplateId}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all"
              >
                {isSendingTemplate ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
