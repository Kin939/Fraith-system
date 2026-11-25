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
    <header className="lg:hidden sticky top-0 z-30 glass-panel border-b border-border px-3 py-2.5 space-y-2">
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
            className="w-6 h-6 rounded-lg object-cover border border-primary/40"
          />
          <span className="font-anime font-extrabold text-base tracking-wide">
            FRAITH<span className="text-primary">.SYS</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
              wsConnected
                ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
            }`}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            WS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted truncate max-w-[140px]">{user.displayName}</span>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg border border-border text-muted hover:text-rose-300"
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
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-primary/25 text-text neon-border'
                  : 'bg-bg/50 text-muted border border-border/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
