import React from 'react';
import {
  BookOpen,
  Crown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Network,
  ScrollText,
  Skull,
  Sparkles,
  Swords,
  User,
  Users,
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
  const unreadChatCount = useCampaignStore((s) => s.unreadChatCount);

  if (!user) return null;
  const isDm = user.role === 'dm';

  const tabs: Array<{
    id: CampaignTabId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'character',
      label: isDm ? 'Персонажи' : 'Мой персонаж',
      icon: isDm ? (
        <Users className="w-4 h-4" strokeWidth={1.5} />
      ) : (
        <User className="w-4 h-4" strokeWidth={1.5} />
      ),
    },
    { id: 'quests', label: 'Квесты', icon: <ScrollText className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'bestiary', label: 'Бестиарий', icon: <Skull className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'spells', label: 'Заклинания', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'connections', label: 'Связи', icon: <Network className="w-4 h-4" strokeWidth={1.5} /> },
    // «Бой» — строго после «Связей» и перед «Мастером»
    { id: 'combat', label: 'Бой', icon: <Swords className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'talents', label: 'Дерево талантов', icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} /> },
    {
      id: 'chat',
      label: 'Мессенджер',
      icon: <MessageSquare className="w-4 h-4" strokeWidth={1.5} />,
      badge: unreadChatCount > 0 ? unreadChatCount : undefined,
    },
  ];

  // «Доска» — строго после «Мессенджера» и перед «Мастером»
  tabs.push({
    id: 'board',
    label: 'Доска',
    icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />,
  });

  if (isDm) {
    tabs.push({ id: 'dm', label: 'Мастер', icon: <Crown className="w-4 h-4" strokeWidth={1.5} /> });
  }

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-deep border-b border-border px-4 py-2 space-y-2">
      <div className="flex items-center justify-between h-9">
        <div className="flex items-center gap-2">
          <img
            src={resolvePublicAssetUrl('/favicon-64.png')}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith('/favicon.svg')) {
                e.currentTarget.src = '/favicon.svg';
              }
            }}
            alt="Fraith"
            className="w-5 h-5 object-cover"
          />
          <span className="font-medium text-sm text-text">Fraith</span>
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected ? 'bg-positive' : 'bg-warning'
            }`}
            title={wsConnected ? 'В сети' : 'Связь…'}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary truncate max-w-[140px]">
            {user.displayName}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="w-8 h-8 flex items-center justify-center border border-border bg-surface text-muted hover:text-text transition-colors"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 flex items-center gap-2 px-3 text-xs whitespace-nowrap transition-colors border-b-2 ${
                active
                  ? 'bg-raised text-text font-medium border-b-primary'
                  : 'text-secondary hover:text-text border-b-transparent'
              }`}
            >
              <span className={active ? 'text-primary' : 'text-muted'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="hud-keycap text-primary border-primary/40 font-mono tabular-nums">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </header>
  );
};
