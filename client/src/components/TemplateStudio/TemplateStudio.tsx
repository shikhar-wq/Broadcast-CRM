import React, { useState, useRef } from 'react';
import { 
  Plus, CheckCircle2, Clock, XCircle, Image as ImageIcon, 
  Video as VideoIcon, Type, ExternalLink, Phone, MessageSquare, Trash2, Send,
  UploadCloud, Upload, Eye, Play, X, Cloud, HardDrive, AlertCircle, RefreshCw, Smartphone
} from 'lucide-react';
import { Template, TemplateButton } from '../../types';
import { api } from '../../api';

interface TemplateStudioProps {
  templates: Template[];
  onTemplatesChange: () => void;
  isSimulationMode: boolean;
}

export const TemplateStudio: React.FC<TemplateStudioProps> = ({ templates, onTemplatesChange, isSimulationMode }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO'>('IMAGE');
  const [headerContent, setHeaderContent] = useState('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop');
  const [mediaSourceType, setMediaSourceType] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProvider, setUploadProvider] = useState<'builtin' | 'supabase' | 'imagekit' | 'local' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewModalMedia, setPreviewModalMedia] = useState<{ type: 'IMAGE' | 'VIDEO'; url: string; title: string } | null>(null);

  // Test on Personal Phone state
  const [testModalTemplate, setTestModalTemplate] = useState<Template | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Sync from Meta state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleSyncFromMeta = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await api.syncTemplates();
      setSyncStatus({ text: `Successfully synced ${res.syncedCount} template(s) from Meta!` });
      onTemplatesChange();
    } catch (err: any) {
      setSyncStatus({ text: err.message || 'Failed to sync from Meta', isError: true });
    } finally {
      setIsSyncing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [bodyText, setBodyText] = useState('Hello {{1}},\n\nDiscover our eco-friendly solutions! Save up to 25% on your upcoming order with code: {{2}}.\n\nSchedule a consultation today.');
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe.');
  const [buttons, setButtons] = useState<TemplateButton[]>([
    { type: 'QUICK_REPLY', text: 'Interested' },
    { type: 'QUICK_REPLY', text: 'Chat with Us' },
    { type: 'QUICK_REPLY', text: 'Stop Promo' }
  ]);
  const [sampleValues, setSampleValues] = useState<string[]>(['Alex', 'GREEN25']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  // Variables detection
  const varMatches = bodyText.match(/{{\s*(\d+)\s*}}/g) || [];
  const varCount = varMatches.length;

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBodyText(text);

    const matches = text.match(/{{\s*(\d+)\s*}}/g) || [];
    if (matches.length > sampleValues.length) {
      const updated = [...sampleValues];
      for (let i = sampleValues.length; i < matches.length; i++) {
        updated.push(`Sample ${i + 1}`);
      }
      setSampleValues(updated);
    }
  };

  const insertVariable = () => {
    setBodyText((prev) => `${prev} {{${varCount + 1}}}`);
  };

  const handleAddButton = (type: 'QUICK_REPLY' | 'URL') => {
    if (buttons.length >= 3) return;
    if (type === 'QUICK_REPLY') {
      setButtons([...buttons, { type, text: 'Quick Reply' }]);
    } else {
      setButtons([...buttons, { type, text: 'Visit Website', url: 'https://example.com' }]);
    }
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (headerType === 'IMAGE' && !isImage) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (headerType === 'VIDEO' && !isVideo) {
      setUploadError('Please select a valid video file (MP4, 3GP).');
      return;
    }

    if (isImage && file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB WhatsApp limit.');
      return;
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      setUploadError('Video size exceeds 50MB WhatsApp limit.');
      return;
    }

    setUploadError(null);
    setIsUploadingMedia(true);

    try {
      const res = await api.uploadMedia(file);
      setHeaderContent(res.url);
      setUploadProvider(res.provider);
      setUploadedFileName(file.name);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload media file.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createTemplate({
        name: name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category,
        language: 'en_US',
        header_type: headerType,
        header_content: headerContent.trim(),
        body_text: bodyText.trim(),
        footer_text: footerText.trim(),
        buttons,
        sample_values: sampleValues,
        submit_immediately: true,
      });

      setName('');
      setShowCreateDrawer(false);
      onTemplatesChange();
    } catch (err: any) {
      alert(err.message || 'Failed to submit template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this template?')) {
      await api.deleteTemplate(id);
      onTemplatesChange();
    }
  };

  const handleOpenTestModal = (template: Template) => {
    setTestModalTemplate(template);
    setTestResult(null);
    const sampleValues = typeof template.sample_values_json === 'string'
      ? JSON.parse(template.sample_values_json || '[]')
      : (template.sample_values_json || []);
    const initialVars: Record<string, string> = {};
    const matches = template.body_text.match(/{{\s*(\d+)\s*}}/g) || [];
    matches.forEach((_, idx) => {
      initialVars[(idx + 1).toString()] = sampleValues[idx] || `Sample ${idx + 1}`;
    });
    setTestVariables(initialVars);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalTemplate || !testPhoneNumber.trim()) return;

    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await api.sendTestTemplate(testModalTemplate.id, testPhoneNumber.trim(), testVariables);
      setTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to send test message' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const getPreviewBody = () => {
    let rendered = bodyText;
    for (let i = 0; i < sampleValues.length; i++) {
      rendered = rendered.split(`{{${i + 1}}}`).join(sampleValues[i] || `{{${i + 1}}}`);
    }
    return rendered;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header section with minimal title and Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Templates</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Prepare and submit WhatsApp message templates for verification before broadcasting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isSimulationMode && (
            <button
              type="button"
              onClick={handleSyncFromMeta}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all border border-slate-700 disabled:opacity-50 shadow-sm"
              title="Fetch approved templates and review status directly from Meta"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync from Meta'}</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateDrawer(!showCreateDrawer)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${syncStatus.isError ? 'bg-rose-950/40 border-rose-800/80 text-rose-300' : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'}`}>
          <div className="flex items-center gap-2">
            {syncStatus.isError ? <XCircle className="w-4 h-4 shrink-0 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
            <span>{syncStatus.text}</span>
          </div>
          <button onClick={() => setSyncStatus(null)} className="text-slate-400 hover:text-white text-xs">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Collapsible / Toggleable Creation Form & Live Mockup */}
      {showCreateDrawer && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 shadow-sm">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-semibold text-sm text-white">Create Template</span>
              <button
                type="button"
                onClick={() => setShowCreateDrawer(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Template Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g. green_offer_oct"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
                >
                  <option value="MARKETING">Marketing (Promotions & Offers)</option>
                  <option value="UTILITY">Utility (Account & Order Updates)</option>
                </select>
              </div>
            </div>

            {/* Header Media */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Header (Optional)</label>
              <div className="flex gap-2">
                {[
                  { type: 'NONE', label: 'None', icon: Type },
                  { type: 'IMAGE', label: 'Image', icon: ImageIcon },
                  { type: 'VIDEO', label: 'Video', icon: VideoIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = headerType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        setHeaderType(item.type as any);
                        setUploadError(null);
                        if (item.type === 'IMAGE' && !headerContent.startsWith('http')) {
                          setHeaderContent('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop');
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        isSelected
                          ? 'bg-slate-800 border-slate-700 text-emerald-400 font-medium'
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {headerType !== 'NONE' && (
                <div className="mt-3 space-y-2">
                  {/* Mode switcher: Upload vs URL */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setMediaSourceType('UPLOAD')}
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                        mediaSourceType === 'UPLOAD'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload from Device</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaSourceType('URL')}
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                        mediaSourceType === 'URL'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Web Link (URL)</span>
                    </button>
                  </div>

                  {/* Upload Dropzone */}
                  {mediaSourceType === 'UPLOAD' ? (
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        accept={headerType === 'IMAGE' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/3gpp'}
                        className="hidden"
                      />

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files?.[0]) {
                            handleFileUpload(e.dataTransfer.files[0]);
                          }
                        }}
                        className="border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-950/60 hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center space-y-1.5 group"
                      >
                        {isUploadingMedia ? (
                          <div className="flex items-center gap-2 text-xs text-amber-400 py-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Uploading & securing file...</span>
                          </div>
                        ) : uploadedFileName ? (
                          <div className="space-y-1 py-1">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="truncate max-w-[240px]">{uploadedFileName}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                              <span>Click to choose a different file</span>
                              {uploadProvider === 'builtin' ? (
                                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 font-medium">
                                  <HardDrive className="w-2.5 h-2.5" /> Built-in App Storage (50 MB)
                                </span>
                              ) : uploadProvider === 'supabase' ? (
                                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 font-medium">
                                  <Cloud className="w-2.5 h-2.5" /> Supabase CDN (50 MB)
                                </span>
                              ) : uploadProvider === 'imagekit' ? (
                                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                  <Cloud className="w-2.5 h-2.5" /> ImageKit CDN
                                </span>
                              ) : (
                                <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <HardDrive className="w-2.5 h-2.5" /> Local Storage
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                            <div className="text-xs text-slate-300">
                              <span className="text-emerald-400 font-medium">Click to browse</span> or drag and drop
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {headerType === 'IMAGE' ? 'JPG, PNG, or WebP (max 5 MB)' : 'MP4 or 3GP video (max 50 MB)'}
                            </span>
                          </>
                        )}
                      </div>

                      {uploadError && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={headerContent}
                        onChange={(e) => setHeaderContent(e.target.value)}
                        placeholder={headerType === 'IMAGE' ? 'https://... image URL' : 'https://... video URL'}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-600"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Message Body</label>
                <button
                  type="button"
                  onClick={insertVariable}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Insert Variable {`{{${varCount + 1}}}`}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={bodyText}
                onChange={handleBodyChange}
                placeholder="Type your message text here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-600 leading-relaxed font-sans"
                required
              />
            </div>

            {/* Variable Samples for Preview */}
            {varCount > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-[11px] text-slate-400 font-medium">Sample Values for Variables:</span>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: varCount }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-mono">{`{{${idx + 1}}}`}</span>
                      <input
                        type="text"
                        value={sampleValues[idx] || ''}
                        onChange={(e) => {
                          const updated = [...sampleValues];
                          updated[idx] = e.target.value;
                          setSampleValues(updated);
                        }}
                        placeholder={`Value ${idx + 1}`}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Text */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Footer Note (Optional)</label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Reply STOP to unsubscribe."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-600"
              />
            </div>

            {/* Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400">Buttons ({buttons.length}/3)</label>
                {buttons.length < 3 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddButton('QUICK_REPLY')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      + Quick Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddButton('URL')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      + Website
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => {
                        const updated = [...buttons];
                        updated[idx].text = e.target.value;
                        setButtons(updated);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                      placeholder="Button title"
                    />
                    {btn.type === 'URL' && (
                      <input
                        type="text"
                        value={btn.url || ''}
                        onChange={(e) => {
                          const updated = [...buttons];
                          updated[idx].url = e.target.value;
                          setButtons(updated);
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                        placeholder="https://..."
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isUploadingMedia}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting to Meta...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Meta Verification</span>
                </>
              )}
            </button>
          </form>

          {/* Minimal Live WhatsApp Preview Mockup */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="w-[280px] bg-[#0b141a] rounded-[2rem] p-3 border-4 border-slate-800 shadow-xl">
              {/* WhatsApp chat bubble */}
              <div className="bg-[#1f2c34] rounded-2xl rounded-tl-sm overflow-hidden text-white shadow-md">
                {/* Header Media in preview */}
                {headerType === 'IMAGE' && headerContent && (
                  <div className="h-32 bg-slate-800 overflow-hidden relative">
                    <img
                      src={headerContent}
                      alt="Header Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {headerType === 'VIDEO' && headerContent && (
                  <div className="h-32 bg-slate-950 flex items-center justify-center relative overflow-hidden">
                    <video
                      src={headerContent}
                      className="w-full h-full object-cover opacity-80"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3 space-y-1.5">
                  <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-slate-100">
                    {getPreviewBody()}
                  </p>
                  {footerText && (
                    <p className="text-[9px] text-slate-400 italic">{footerText}</p>
                  )}
                  <div className="flex justify-end text-[9px] text-slate-400">
                    <span>12:00</span>
                  </div>
                </div>

                {buttons.length > 0 && (
                  <div className="border-t border-slate-700/50 divide-y divide-slate-700/50">
                    {buttons.map((b, i) => (
                      <div key={i} className="py-1.5 text-center text-[11px] font-medium text-emerald-400 bg-[#202c33]">
                        {b.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-500 mt-2">Live WhatsApp message preview</span>
          </div>
        </div>
      )}

      {/* Minimalist Templates Grid with Image/Video Previews */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => {
          const isApproved = tpl.status === 'APPROVED';
          const isPending = tpl.status === 'PENDING';
          const isRejected = tpl.status === 'REJECTED';

          return (
            <div
              key={tpl.id}
              className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-xs text-white truncate max-w-[180px]">
                    {tpl.name}
                  </span>

                  {isApproved && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Approved
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      In Review
                    </span>
                  )}
                  {isRejected && (
                    <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                </div>

                {/* Media Preview on Template Card */}
                {tpl.header_type === 'IMAGE' && tpl.header_content && (
                  <div
                    onClick={() => setPreviewModalMedia({ type: 'IMAGE', url: tpl.header_content, title: tpl.name })}
                    className="relative w-full h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800/80 cursor-pointer group mb-2.5"
                    title="Click to view image"
                  >
                    <img
                      src={tpl.header_content}
                      alt={tpl.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-[10px] text-white font-medium bg-slate-900/90 px-2.5 py-1 rounded-full border border-slate-700 flex items-center gap-1 shadow-md">
                        <Eye className="w-3 h-3 text-emerald-400" /> View Image
                      </span>
                    </div>
                  </div>
                )}

                {tpl.header_type === 'VIDEO' && tpl.header_content && (
                  <div
                    onClick={() => setPreviewModalMedia({ type: 'VIDEO', url: tpl.header_content, title: tpl.name })}
                    className="relative w-full h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800/80 cursor-pointer group mb-2.5 flex items-center justify-center"
                    title="Click to play video"
                  >
                    <video
                      src={tpl.header_content}
                      className="w-full h-full object-cover opacity-75"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center group-hover:bg-slate-950/20 transition-all">
                      <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] text-slate-300 font-medium">
                      Video Header
                    </div>
                  </div>
                )}

                <p className="text-slate-400 text-xs mt-1 line-clamp-3 leading-relaxed">
                  {tpl.body_text}
                </p>
              </div>

              {/* Bottom bar with discreet actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="capitalize">{tpl.header_type === 'NONE' ? 'Text Only' : `${tpl.header_type.toLowerCase()} header`}</span>

                <div className="flex items-center gap-2">
                  {/* Send test message to personal phone button */}
                  {isApproved && (
                    <button
                      type="button"
                      onClick={() => handleOpenTestModal(tpl)}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-medium transition-colors"
                      title="Send test message to your phone"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Test on Phone</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="hover:text-rose-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Media Lightbox Modal */}
      {previewModalMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalMedia(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800">
              <span className="text-xs font-semibold text-white truncate max-w-md">
                {previewModalMedia.title} (Media Preview)
              </span>
              <button
                onClick={() => setPreviewModalMedia(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center bg-slate-950">
              {previewModalMedia.type === 'IMAGE' ? (
                <img
                  src={previewModalMedia.url}
                  alt={previewModalMedia.title}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
                />
              ) : (
                <video
                  src={previewModalMedia.url}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full rounded-lg"
                />
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <a
                href={previewModalMedia.url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <ExternalLink className="w-3 h-3" /> Open original media link
              </a>
              <button
                onClick={() => setPreviewModalMedia(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test on Personal Phone Modal */}
      {testModalTemplate && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setTestModalTemplate(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Test on Your WhatsApp</h3>
              </div>
              <button 
                onClick={() => setTestModalTemplate(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Selected Template:</span>
              <span className="text-xs font-medium text-emerald-400 truncate block">{testModalTemplate.name}</span>
            </div>

            <form onSubmit={handleSendTest} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Your WhatsApp Phone Number (with Country Code)
                </label>
                <input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="e.g. +919876543210 or +12025550123"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono"
                  required
                  autoFocus
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Must include '+' and country code (e.g. +91 for India, +1 for USA/Canada).
                </span>
              </div>

              {/* Dynamic Variable Inputs */}
              {Object.keys(testVariables).length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] text-slate-400 font-medium">Sample Variables for this Message:</span>
                  <div className="space-y-1.5">
                    {Object.keys(testVariables).map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">{`{{${key}}}`}</span>
                        <input
                          type="text"
                          value={testVariables[key]}
                          onChange={(e) => setTestVariables({ ...testVariables, [key]: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                          placeholder={`Value for {{${key}}}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Meta notice */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                <p className="text-emerald-400/90 leading-relaxed">
                  <strong>Live Meta WhatsApp API:</strong> This dispatches an official test template message directly to your phone via Meta Cloud API using your configured credentials.
                </p>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded-xl border text-xs flex flex-col gap-2 ${
                  testResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                    <span className="leading-relaxed">{testResult.message}</span>
                  </div>
                  {!testResult.success && (testResult.message.includes('Authentication Error') || testResult.message.includes('access token') || testResult.message.includes('decrypted') || testResult.message.includes('expired')) && (
                    <div className="p-2 bg-slate-950/80 rounded-lg border border-rose-500/30 text-[11px] text-slate-300 space-y-1 mt-0.5">
                      <div className="font-semibold text-amber-400 flex items-center gap-1">
                        <span>⚠️ Access Token Issue Detected</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        Your Meta Access Token in Settings is expired or corrupted. Switch to the <strong>Settings</strong> tab, click <strong>Clear</strong>, paste your fresh token, and verify it with <strong>Test Meta Connection</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingTest || !testPhoneNumber.trim()}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending WhatsApp Message...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
