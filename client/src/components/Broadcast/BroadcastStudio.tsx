import React, { useState, useEffect } from 'react';
import { 
  Send, Play, Pause, Square, Users, CheckCircle2, 
  RefreshCw, ChevronRight, AlertCircle
} from 'lucide-react';
import { Template, Campaign } from '../../types';
import { api } from '../../api';

interface BroadcastStudioProps {
  templates: Template[];
  campaigns: Campaign[];
  onCampaignsChange: () => void;
  contactCount: number;
  optedOutCount: number;
  onRefreshContacts: () => void;
}

export const BroadcastStudio: React.FC<BroadcastStudioProps> = ({
  templates,
  campaigns,
  onCampaignsChange,
  contactCount,
  optedOutCount,
  onRefreshContacts
}) => {
  const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(approvedTemplates[0]?.id || '');
  const [speedSetting, setSpeedSetting] = useState<number>(5);
  const [targetTag, setTargetTag] = useState<string>('ALL');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [targetCount, setTargetCount] = useState<number>(Math.max(0, contactCount - optedOutCount));
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<any>(null);

  useEffect(() => {
    if (!selectedTemplateId && approvedTemplates.length > 0) {
      setSelectedTemplateId(approvedTemplates[0].id);
    }
  }, [approvedTemplates]);

  useEffect(() => {
    api.getTags().then(setAvailableTags);
  }, []);

  // Update target count when tag or contact count changes
  useEffect(() => {
    if (targetTag === 'ALL') {
      setTargetCount(Math.max(0, contactCount - optedOutCount));
    } else {
      api.getContacts({ tag: targetTag, optedOut: false, limit: 1 }).then((res) => {
        setTargetCount(res.filteredTotal ?? res.total);
      });
    }
  }, [targetTag, contactCount, optedOutCount]);

  useEffect(() => {
    if (selectedCampaignId) {
      api.getCampaignDetails(selectedCampaignId).then(setCampaignDetails);
    }
  }, [selectedCampaignId]);

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !selectedTemplateId) return;

    setIsCreating(true);
    try {
      const result = await api.createCampaign({
        name: campaignName.trim(),
        template_id: selectedTemplateId,
        messages_per_second: speedSetting,
        target_tags: targetTag,
      });

      setCampaignName('');
      onCampaignsChange();
      setSelectedCampaignId(result.id);
      await api.startCampaign(result.id);
      onCampaignsChange();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Broadcast</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Send approved message templates to your contact list at a safe delivery speed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Create Broadcast Card */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">New Broadcast</h2>

          {approvedTemplates.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300">No approved templates found.</p>
              <p className="text-[11px] text-slate-500">Create a template first and wait for approval.</p>
            </div>
          ) : (
            <form onSubmit={handleCreateBroadcast} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Campaign Title</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. October Customer Update"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
                >
                  {approvedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Audience Tag Selection */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Audience</label>
                <select
                  value={targetTag}
                  onChange={(e) => setTargetTag(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
                >
                  <option value="ALL">All Audiences ({Math.max(0, contactCount - optedOutCount)} contacts)</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audience Preview */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Recipients</span>
                  <span className="font-semibold text-white">{targetCount} contacts</span>
                </div>
                {optedOutCount > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Unsubscribed contacts are automatically excluded.
                  </p>
                )}
              </div>

              {/* Delivery Speed Selector (Simplified, clean) */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Sending Pace</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSpeedSetting(5)}
                    className={`py-2 px-3 rounded-xl border text-xs text-left transition-all ${
                      speedSetting === 5
                        ? 'bg-slate-800 border-slate-700 text-emerald-400 font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-semibold">Safe Pace</span>
                    <span className="text-[10px] text-slate-500">5 msgs/sec (Recommended)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpeedSetting(10)}
                    className={`py-2 px-3 rounded-xl border text-xs text-left transition-all ${
                      speedSetting === 10
                        ? 'bg-slate-800 border-slate-700 text-emerald-400 font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-semibold">Fast Pace</span>
                    <span className="text-[10px] text-slate-500">10 msgs/sec</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating || targetCount === 0}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all disabled:opacity-50 mt-1 flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Broadcast ({targetCount})</span>
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Campaigns List & Progress */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Broadcast History</h2>

            {campaigns.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No broadcasts sent yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {campaigns.map((camp) => {
                  const percent = camp.total_contacts > 0
                    ? Math.round(((camp.delivered_count + camp.failed_count) / camp.total_contacts) * 100)
                    : 0;
                  const isRunning = camp.status === 'RUNNING';
                  const isPaused = camp.status === 'PAUSED';
                  const isCompleted = camp.status === 'COMPLETED';

                  return (
                    <div key={camp.id} className="py-3.5 space-y-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-xs text-white">{camp.name}</h3>
                          <span className="text-[11px] text-slate-400">
                            {camp.template_name} · {camp.total_contacts} contacts
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isRunning && (
                            <button
                              onClick={() => api.pauseCampaign(camp.id).then(onCampaignsChange)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                              title="Pause"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isPaused && (
                            <button
                              onClick={() => api.startCampaign(camp.id).then(onCampaignsChange)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs"
                              title="Resume"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Minimalist Progress Line */}
                      <div>
                        <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                          <span>{percent}% sent</span>
                          <div className="flex items-center gap-3">
                            <span>Sent: {camp.sent_count}</span>
                            <span className="text-slate-400">Delivered: {camp.delivered_count}</span>
                            {camp.read_count > 0 && <span className="text-emerald-400">Read: {camp.read_count}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
