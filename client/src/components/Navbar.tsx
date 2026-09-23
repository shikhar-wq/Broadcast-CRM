import React from 'react';
import { LayoutDashboard, MessageSquare, Send, Users, Settings } from 'lucide-react';
import { AppSettings } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: AppSettings | null;
  unreadQueries: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, settings, unreadQueries }) => {
  const isTestMode = settings?.mode === 'SIMULATION';

  const navItems = [
    { id: 'templates', label: 'Templates', icon: LayoutDashboard },
    { id: 'broadcast', label: 'Broadcast', icon: Send },
    { id: 'inbox', label: 'Queries', icon: MessageSquare, badge: unreadQueries },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header className="bg-slate-950/85 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="IntelliGreen Logo" 
              className="w-8 h-8 rounded-lg object-contain shrink-0 shadow-md border border-emerald-500/20" 
            />
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-100 text-sm tracking-tight">IntelliGreen</span>
              <span className="hidden sm:inline text-slate-600 text-xs">/</span>
              <span className="hidden sm:inline text-slate-400 text-xs font-medium">Broadcast CRM</span>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Status Pill */}
          <div className="flex items-center gap-2">
            {isTestMode ? (
              <span className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span className="hidden xs:inline">Test Mode</span>
                <span className="xs:hidden">Test</span>
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden xs:inline">Connected</span>
                <span className="xs:hidden">Live</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Visible only on Mobile screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-slate-950 text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5"></span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
