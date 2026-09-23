import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { TemplateStudio } from './components/TemplateStudio/TemplateStudio';
import { BroadcastStudio } from './components/Broadcast/BroadcastStudio';
import { QueryInbox } from './components/QueryInbox/QueryInbox';
import { ContactsView } from './components/Contacts/ContactsView';
import { SettingsView } from './components/Settings/SettingsView';
import { Template, Campaign, Conversation, AppSettings } from './types';
import { api } from './api';

export function App() {
  const [activeTab, setActiveTab] = useState('templates');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [optedOutCount, setOptedOutCount] = useState(0);

  // Initial load
  const loadData = async () => {
    try {
      const [sets, tpls, camps, convs, conts] = await Promise.all([
        api.getSettings(),
        api.getTemplates(),
        api.getCampaigns(),
        api.getConversations(),
        api.getContacts({ limit: 1 }),
      ]);
      if (sets) setSettings(sets);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setCampaigns(Array.isArray(camps) ? camps : []);
      setConversations(Array.isArray(convs) ? convs : []);
      setContactCount(typeof conts?.total === 'number' ? conts.total : 0);
      setOptedOutCount(typeof conts?.optedOutCount === 'number' ? conts.optedOutCount : 0);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Setup Server-Sent Events (SSE) for real-time live updates
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('template_update', () => {
      api.getTemplates().then(setTemplates);
    });

    eventSource.addEventListener('campaign_progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.campaignId) {
          setCampaigns((prev) =>
            prev.map((c) =>
              c.id === data.campaignId
                ? {
                    ...c,
                    sent_count: data.sent_count ?? c.sent_count,
                    delivered_count: data.delivered_count ?? c.delivered_count,
                    read_count: data.read_count ?? c.read_count,
                    failed_count: data.failed_count ?? c.failed_count,
                    suppressed_count: data.suppressed_count ?? c.suppressed_count,
                  }
                : c
            )
          );
        }
      } catch {
        // Silent catch
      }
    });

    eventSource.addEventListener('campaign_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.id && data.status) {
          setCampaigns((prev) =>
            prev.map((c) => (c.id === data.id ? { ...c, status: data.status } : c))
          );
        }
      } catch {
        api.getCampaigns().then((res) => setCampaigns(Array.isArray(res) ? res : []));
      }
    });

    eventSource.addEventListener('new_chat_message', () => {
      api.getConversations().then((res) => setConversations(Array.isArray(res) ? res : []));
    });

    eventSource.addEventListener('chat_status_update', () => {
      api.getConversations().then((res) => setConversations(Array.isArray(res) ? res : []));
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const totalUnreadQueries = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const isSimulationMode = settings?.mode === 'SIMULATION';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        unreadQueries={totalUnreadQueries}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
        {activeTab === 'templates' && (
          <TemplateStudio
            templates={templates}
            onTemplatesChange={() => api.getTemplates().then(setTemplates)}
            isSimulationMode={isSimulationMode}
          />
        )}

        {activeTab === 'broadcast' && (
          <BroadcastStudio
            templates={templates}
            campaigns={campaigns}
            onCampaignsChange={() => api.getCampaigns().then(setCampaigns)}
            contactCount={contactCount}
            optedOutCount={optedOutCount}
            onRefreshContacts={loadData}
          />
        )}

        {activeTab === 'inbox' && (
          <QueryInbox
            conversations={conversations}
            onRefreshConversations={() => api.getConversations().then(setConversations)}
            isSimulationMode={isSimulationMode}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsView onContactsChange={loadData} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSettingsUpdate={loadData}
          />
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900/60 py-4 text-center text-xs text-slate-600">
        <span>IntelliGreen CRM</span>
      </footer>
    </div>
  );
}

export default App;
