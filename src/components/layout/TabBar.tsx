import React from 'react';
import {
  BookOpen,
  Crown,
  LogOut,
  ScrollText,
  Skull,
  Sparkles,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { resolvePublicAssetUrl } from '../../lib/cdnAssets';
import { CampaignTabId, useCampaignStore } from '../../lib/store';

interface TabBarProps {
  onLogout: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onLogout }) => {
  const user = useCampaignStore((s) => s.user);
  const activeTab = useCampaignStore((s) => s.activeTab);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const wsConnected = useCampaignStore((s) => s.wsConnected);

  if (!user) return null;
  const isDm = user.role === 'dm';

  const tabs: Array<{ id: CampaignTabId; label: string; icon: React.ReactNode }> = [
    {
      id: 'character',
      label: isDm ? 'Персонажи' : 'Мой персонаж',
      icon: isDm ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />,
    },
    { id: 'quests', label: 'Квесты', icon: <ScrollText className="w-4 h-4" /> },
    { id: 'bestiary', label: 'Бестиарий', icon: <Skull className="w-4 h-4" /> },
    { id: 'spells', label: 'Заклинания', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'talents', label: 'Дерево талантов', icon: <Sparkles className="w-4 h-4" /> },
  ];

  if (isDm) {
    tabs.push({ id: 'dm', label: 'Мастер', icon: <Crown className="w-4 h-4" /> });
  }

  return (
    <header className="lg:hidden sticky top-0 z-30 glass-panel hud-corners border-b border-primary/35 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={resolvePublicAssetUrl('/favicon-64.png')}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith('/favicon.svg')) {
                e.currentTarget.src = '/favicon.svg';
              }
            }}
            alt="FRAITH.SYS"
            className="w-6 h-6 object-cover border border-primary/50"
          />
          <span className="font-anime font-extrabold text-sm tracking-wider">
            FRAITH<span className="text-primary">.SYS</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 border ${
              wsConnected
                ? 'border-emerald-400/50 text-emerald-300 bg-emerald-500/10'
                : 'border-amber-400/50 text-amber-300 bg-amber-500/10'
            }`}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted truncate max-w-[130px]">
            {user.displayName}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 border border-primary/30 bg-[#070B14]/80 text-muted hover:text-rose-300"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-anime uppercase tracking-wider whitespace-nowrap transition-all border ${
                active
                  ? 'bg-primary/15 text-text border-primary/60 border-b-2 border-b-primary shadow-[0_8px_18px_-8px_var(--primary)] font-bold'
                  : 'bg-[#070B14]/65 text-muted border-primary/20'
              }`}
            >
              <span className={active ? 'text-primary' : 'text-muted'}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
