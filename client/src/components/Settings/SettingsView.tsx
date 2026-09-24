import React, { useState, useEffect } from 'react';
import { 
  Check, Calculator, Cloud, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, 
  HardDrive, Server, Eye, EyeOff, Trash2, Clipboard, KeyRound, HelpCircle, 
  ChevronDown, ChevronUp, ShieldCheck, Download, Upload 
} from 'lucide-react';
import { AppSettings } from '../../types';
import { api } from '../../api';

interface SettingsViewProps {
  settings: AppSettings | null;
  onSettingsUpdate: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSettingsUpdate }) => {
  const [mode, setMode] = useState<'SIMULATION' | 'LIVE'>('LIVE');
  const [wabaId, setWabaId] = useState(settings?.waba_id || '');
  const [phoneNumberId, setPhoneNumberId] = useState(settings?.phone_number_id || '');
  const [accessToken, setAccessToken] = useState(settings?.access_token || '');
  const [webhookToken, setWebhookToken] = useState(settings?.webhook_verify_token || 'intelligreen_secret_token_123');

  // Meta token testing and visibility states
  const [showToken, setShowToken] = useState(false);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [isTestingMeta, setIsTestingMeta] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState<{
    success: boolean;
    message: string;
    phone_info?: any;
    token_info?: any;
    expiry_desc?: string;
    error_code?: number;
    error_message?: string;
    hint?: string;
  } | null>(null);

  // Storage Provider configuration state
  const [storageProvider, setStorageProvider] = useState<'BUILTIN' | 'SUPABASE' | 'IMAGEKIT'>(
    (settings?.storage_provider as any) || 'BUILTIN'
  );
  const [publicUrl, setPublicUrl] = useState(settings?.public_url || '');

  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState(settings?.supabase_url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings?.supabase_anon_key || '');
  const [supabaseBucket, setSupabaseBucket] = useState(settings?.supabase_bucket || 'whatsapp-media');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // ImageKit state
  const [imagekitPublicKey, setImagekitPublicKey] = useState(settings?.imagekit_public_key || '');
  const [imagekitPrivateKey, setImagekitPrivateKey] = useState(settings?.imagekit_private_key || '');
  const [imagekitUrlEndpoint, setImagekitUrlEndpoint] = useState(settings?.imagekit_url_endpoint || '');
  const [isTestingImageKit, setIsTestingImageKit] = useState(false);
  const [imageKitTestResult, setImageKitTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pricing calculator state
  const [calcRecipients, setCalcRecipients] = useState(1000);
  const [calcCountry, setCalcCountry] = useState('INDIA');

  useEffect(() => {
    if (settings) {
      setMode('LIVE');
      setWabaId(settings.waba_id || '');
      setPhoneNumberId(settings.phone_number_id || '');
      setAccessToken(settings.access_token || '');
      setWebhookToken(settings.webhook_verify_token || 'intelligreen_secret_token_123');

      setStorageProvider((settings.storage_provider as any) || 'BUILTIN');
      setPublicUrl(settings.public_url || '');

      setSupabaseUrl(settings.supabase_url || '');
      setSupabaseAnonKey(settings.supabase_anon_key || '');
      setSupabaseBucket(settings.supabase_bucket || 'whatsapp-media');

      setImagekitPublicKey(settings.imagekit_public_key || '');
      setImagekitPrivateKey(settings.imagekit_private_key || '');
      setImagekitUrlEndpoint(settings.imagekit_url_endpoint || '');
    }
  }, [settings]);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestResult(null);
    try {
      const result = await api.testSupabase({
        url: supabaseUrl.trim(),
        anonKey: supabaseAnonKey.trim(),
        bucket: supabaseBucket.trim(),
      });
      setSupabaseTestResult(result);
    } catch (err: any) {
      setSupabaseTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleTestImageKit = async () => {
    setIsTestingImageKit(true);
    setImageKitTestResult(null);
    try {
      const result = await api.testImageKit({
        publicKey: imagekitPublicKey.trim(),
        privateKey: imagekitPrivateKey.trim(),
        urlEndpoint: imagekitUrlEndpoint.trim(),
      });
      setImageKitTestResult(result);
    } catch (err: any) {
      setImageKitTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setIsTestingImageKit(false);
    }
  };

  const handleTestMeta = async () => {
    setIsTestingMeta(true);
    setMetaTestResult(null);
    try {
      const result = await api.testMeta({
        accessToken: accessToken.trim(),
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
      });
      setMetaTestResult(result);
    } catch (err: any) {
      setMetaTestResult({
        success: false,
        message: err.message || 'Failed to connect to Meta API'
      });
    } finally {
      setIsTestingMeta(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateSettings({
        mode,
        waba_id: wabaId.trim(),
        phone_number_id: phoneNumberId.trim(),
        access_token: accessToken.trim(),
        webhook_verify_token: webhookToken.trim(),
        storage_provider: storageProvider,
        public_url: publicUrl.trim(),
        supabase_url: supabaseUrl.trim(),
        supabase_anon_key: supabaseAnonKey.trim(),
        supabase_bucket: supabaseBucket.trim(),
        imagekit_public_key: imagekitPublicKey.trim(),
        imagekit_private_key: imagekitPrivateKey.trim(),
        imagekit_url_endpoint: imagekitUrlEndpoint.trim(),
      });
      setSaveSuccess(true);
      onSettingsUpdate();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const countryRates: Record<string, { name: string; currency: string; marketing: number; symbol: string }> = {
    INDIA: { name: 'India', currency: 'INR', marketing: 0.80, symbol: '₹' },
    US: { name: 'United States & Canada', currency: 'USD', marketing: 0.025, symbol: '$' },
    UK: { name: 'United Kingdom', currency: 'GBP', marketing: 0.038, symbol: '£' },
    UAE: { name: 'United Arab Emirates', currency: 'USD', marketing: 0.032, symbol: '$' },
  };

  const selectedRate = countryRates[calcCountry] || countryRates.INDIA;
  const totalCost = (calcRecipients * selectedRate.marketing).toFixed(2);
  const totalCostUSD = selectedRate.currency === 'INR'
    ? (Number(totalCost) / 84).toFixed(2)
    : selectedRate.currency === 'USD'
    ? totalCost
    : (Number(totalCost) * 1.25).toFixed(2);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Settings & Pricing</h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Configure WhatsApp credentials, free 50 MB media storage, and calculate campaign costs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-5">
          {/* WhatsApp API Connection Mode */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3.5">
            <h2 className="text-sm font-semibold text-white">WhatsApp Integration</h2>

            {/* Live Meta Cloud API Banner */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Live Meta WhatsApp Cloud API</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Official Graph API connection for broadcasts, templates, and messaging.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Integration
              </span>
            </div>

            <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">WhatsApp Business Account ID</label>
                  <input
                    type="text"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    placeholder="WABA ID"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="Phone Number ID"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                {/* Meta Access Token (with Clear, Paste, Show/Hide, Test Connection, and Guide) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Meta Access Token</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {/* Character length indicator */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition-colors ${
                        !accessToken.trim()
                          ? 'bg-slate-800 text-slate-500'
                          : accessToken.length > 200
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {!accessToken.trim() ? 'Empty' : `${accessToken.length} chars`}
                      </span>

                      {/* Clear Button */}
                      {accessToken && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccessToken('');
                            setMetaTestResult(null);
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors border border-rose-500/20"
                          title="Wipe token field completely clean"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      )}

                      {/* Paste Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const clipText = await navigator.clipboard.readText();
                            if (clipText) {
                              const cleaned = clipText.replace(/^Bearer\s+/i, '').replace(/\s+/g, '').trim();
                              setAccessToken(cleaned);
                              setMetaTestResult(null);
                            }
                          } catch {
                            const pasted = prompt('Paste your Meta Access Token here:');
                            if (pasted) {
                              const cleaned = pasted.replace(/^Bearer\s+/i, '').replace(/\s+/g, '').trim();
                              setAccessToken(cleaned);
                              setMetaTestResult(null);
                            }
                          }
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors border border-emerald-500/20"
                        title="Paste clean token directly from clipboard"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>Paste</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={accessToken}
                      onChange={(e) => {
                        const val = e.target.value.replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
                        setAccessToken(val);
                        setMetaTestResult(null);
                      }}
                      placeholder="Paste your access token (starts with EA...)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono tracking-tight"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded transition-colors"
                      title={showToken ? 'Hide token text' : 'Show token text'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Test Connection Button */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleTestMeta}
                      disabled={isTestingMeta || !accessToken.trim()}
                      className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTestingMeta ? 'animate-spin' : ''}`} />
                      <span>{isTestingMeta ? 'Testing Meta API...' : 'Test Meta Connection'}</span>
                    </button>
                    <span className="text-[10px] text-slate-500">
                      Verifies token & permissions directly with Meta
                    </span>
                  </div>

                  {/* Meta Test Result Banner */}
                  {metaTestResult && (
                    <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      metaTestResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      <div className="flex items-center gap-1.5 font-medium">
                        {metaTestResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                        <span>{metaTestResult.message}</span>
                      </div>
                      {metaTestResult.hint && (
                        <p className="text-[11px] opacity-90 pl-5 text-slate-300 leading-relaxed">
                          {metaTestResult.hint}
                        </p>
                      )}
                      {metaTestResult.phone_info && (
                        <div className="pl-5 text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-emerald-500/20 mt-1.5">
                          <div>Display Number: <strong className="text-white font-mono">{metaTestResult.phone_info.display_phone_number || 'Developer Test Number'}</strong></div>
                          <div>Verified Name: <strong className="text-white">{metaTestResult.phone_info.verified_name || 'Sandbox Account'}</strong></div>
                          <div>Token Status: <strong className="text-emerald-400">{metaTestResult.expiry_desc || 'Active'}</strong></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Meta Token Guide */}
                  <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowTokenGuide(!showTokenGuide)}
                      className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Where to get your Meta Access Token (24-Hr vs Permanent)</span>
                      </span>
                      {showTokenGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showTokenGuide && (
                      <div className="p-3 border-t border-slate-800/80 text-[11px] space-y-2.5 text-slate-300">
                        <div className="space-y-1">
                          <div className="font-semibold text-emerald-400">
                            ⚡ Option 1: Quick 24-Hour Developer Token (10 Seconds)
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
                            <li>Open <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-emerald-400 underline">Meta Developer Portal</a> &rarr; select your App.</li>
                            <li>In sidebar: <strong>WhatsApp</strong> &rarr; <strong>API Setup</strong>.</li>
                            <li>Under <strong>Step 1</strong>, copy the <strong>Temporary access token</strong>.</li>
                            <li>Click <strong>Paste</strong> above, test connection, then click <strong>Save Settings</strong> below.</li>
                          </ol>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-slate-800/60">
                          <div className="font-semibold text-amber-400">
                            ♾️ Option 2: Permanent System User Token (Never Expires - Recommended)
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
                            <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="text-amber-400 underline">Meta Business Settings &rarr; System Users</a>.</li>
                            <li>Click <strong>Add System User</strong> (Name: <code>Admin</code>, Role: <code>Admin</code>).</li>
                            <li>Under <strong>Assigned Assets</strong>, assign your App with <strong>Full Control</strong>.</li>
                            <li>Click <strong>Generate New Token</strong> &rarr; check <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.</li>
                            <li>Paste the token above. This token <strong>never expires</strong>!</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Webhook Verify Token</label>
                  <input
                    type="text"
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>
              </div>
          </div>

          {/* Media Storage Provider Configuration (Supporting 50 MB Videos) */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">Media Storage (50 MB Video Support)</h2>
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                100% Free
              </span>
            </div>

            {/* Provider Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStorageProvider('BUILTIN')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all text-center flex items-center justify-center gap-1 ${
                  storageProvider === 'BUILTIN'
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Server className="w-3 h-3" />
                <span>App Storage</span>
              </button>

              <button
                type="button"
                onClick={() => setStorageProvider('SUPABASE')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all text-center flex items-center justify-center gap-1 ${
                  storageProvider === 'SUPABASE'
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cloud className="w-3 h-3" />
                <span>Supabase (50MB)</span>
              </button>

              <button
                type="button"
                onClick={() => setStorageProvider('IMAGEKIT')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all text-center flex items-center justify-center gap-1 ${
                  storageProvider === 'IMAGEKIT'
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cloud className="w-3 h-3" />
                <span>ImageKit</span>
              </button>
            </div>

            {/* Provider Detail 1: Built-in App Storage */}
            {storageProvider === 'BUILTIN' && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Recommended & 0-Setup
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Stores videos (up to <strong>50 MB</strong>) directly on your application server. When deployed to Render or a cloud host, it serves public HTTPS links with zero external accounts or API keys required.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Public App URL (Optional in local mode, set when deploying to cloud)
                  </label>
                  <input
                    type="text"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    placeholder="e.g. https://intelligreen-wa-crm.onrender.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Leave blank for local testing (uses http://localhost:5000 automatically).
                  </span>
                </div>
              </div>
            )}

            {/* Provider Detail 2: Supabase Storage */}
            {storageProvider === 'SUPABASE' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Supabase Free Tier provides 1 GB storage and supports up to <strong>50 MB per file</strong>.
                  </p>
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 flex-shrink-0"
                  >
                    <span>Free Plan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Supabase Project URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Supabase Anon / Public Key</label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Public Storage Bucket</label>
                  <input
                    type="text"
                    value={supabaseBucket}
                    onChange={(e) => setSupabaseBucket(e.target.value)}
                    placeholder="whatsapp-media"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestSupabase}
                    disabled={isTestingSupabase || !supabaseUrl || !supabaseAnonKey}
                    className="py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-200 font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingSupabase ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Testing Supabase...</span>
                      </>
                    ) : (
                      <span>Test Supabase Connection</span>
                    )}
                  </button>

                  {supabaseTestResult && (
                    <div
                      className={`flex items-center gap-1 text-[11px] ${
                        supabaseTestResult.success ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {supabaseTestResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span className="truncate max-w-[220px]">{supabaseTestResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Provider Detail 3: ImageKit */}
            {storageProvider === 'IMAGEKIT' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    ImageKit provides 20 GB free CDN storage (max 25 MB file size on free plan).
                  </p>
                  <a
                    href="https://imagekit.io"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 flex-shrink-0"
                  >
                    <span>Free Plan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Public Key</label>
                  <input
                    type="text"
                    value={imagekitPublicKey}
                    onChange={(e) => setImagekitPublicKey(e.target.value)}
                    placeholder="e.g. public_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Private Key (Server-side only)</label>
                  <input
                    type="password"
                    value={imagekitPrivateKey}
                    onChange={(e) => setImagekitPrivateKey(e.target.value)}
                    placeholder="e.g. private_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">URL Endpoint</label>
                  <input
                    type="text"
                    value={imagekitUrlEndpoint}
                    onChange={(e) => setImagekitUrlEndpoint(e.target.value)}
                    placeholder="e.g. https://ik.imagekit.io/your_id"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestImageKit}
                    disabled={isTestingImageKit || !imagekitPublicKey || !imagekitPrivateKey || !imagekitUrlEndpoint}
                    className="py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-200 font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingImageKit ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Testing connection...</span>
                      </>
                    ) : (
                      <span>Test ImageKit Connection</span>
                    )}
                  </button>

                  {imageKitTestResult && (
                    <div
                      className={`flex items-center gap-1 text-[11px] ${
                        imageKitTestResult.success ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {imageKitTestResult.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span className="truncate max-w-[200px]">{imageKitTestResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved Successfully</span>
              </>
            ) : (
              <span>Save All Settings</span>
            )}
          </button>
        </form>

        {/* Pricing Calculator Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4 h-fit">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Broadcast Cost Estimator</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Recipients</label>
              <input
                type="number"
                min="1"
                step="50"
                value={calcRecipients}
                onChange={(e) => setCalcRecipients(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Destination Country</label>
              <select
                value={calcCountry}
                onChange={(e) => setCalcCountry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
              >
                {Object.entries(countryRates).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clean Cost Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-[11px] text-slate-400">Estimated Total Cost</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {selectedRate.symbol} {totalCost}
              </span>
              <span className="text-xs text-slate-500">
                (~${totalCostUSD} USD)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Rate: {selectedRate.symbol}{selectedRate.marketing} per delivered contact.
            </p>
          </div>

          {/* Simple Clean Rates Table */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-xs font-medium text-slate-300">Standard Meta Rates:</span>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/60">
                <span className="text-slate-500 block">India</span>
                <span className="font-semibold text-white">~₹0.80 / contact</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/60">
                <span className="text-slate-500 block">USA / Canada</span>
                <span className="font-semibold text-white">~$0.025 / contact</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 space-y-1">
              <span className="font-semibold block">100% Free Platform Promise:</span>
              <p className="text-slate-400">
                IntelliGreen WA CRM charges <strong>$0 monthly fees</strong> and $0 markup. The first <strong>1,000 customer service chats each month are free</strong> directly from Meta. You pay only raw Meta delivery fees!
              </p>
            </div>

            {/* Database Backup & Restore Card */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">Permanent Data Backup & Restore</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When Supabase credentials are configured above, your database automatically syncs to the cloud across server restarts. You can also manually export or restore a full snapshot anytime:
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href="/api/backup/export"
                  download
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Backup</span>
                </a>

                <label className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Restore Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const json = JSON.parse(text);
                        const res = await fetch('/api/backup/import', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(json),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          alert('Database restored successfully! Refreshing app...');
                          window.location.reload();
                        } else {
                          alert(data.error || 'Failed to restore backup.');
                        }
                      } catch (err: any) {
                        alert('Invalid backup JSON file.');
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
