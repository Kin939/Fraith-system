import React, { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { QuestDetail } from '../components/quests/QuestDetail';
import { QuestTile } from '../components/quests/QuestTile';
import { useCampaignStore } from '../lib/store';
import type { Quest } from '../lib/types';

export const QuestsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const quests = useCampaignStore((s) => s.quests);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);

  const [selectedId, setSelectedId] = useState<number | null>(quests[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (quests.length > 0 && (selectedId === null || !quests.some((q) => q.id === selectedId))) {
      setSelectedId(quests[0].id);
    }
  }, [quests, selectedId]);

  const filteredQuests =
    statusFilter === 'all' ? quests : quests.filter((q) => q.status === statusFilter);

  const selectedQuest: Quest | null =
    quests.find((q) => q.id === selectedId) ?? filteredQuests[0] ?? null;

  const isDm = user?.role === 'dm';

  return (
    <div className="space-y-6">
      {/* Quiet Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-medium text-2xl text-text">Квесты</h1>
          <p className="text-sm text-secondary mt-1">
            Активные поручения отряда и ход их выполнения
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-surface border border-border p-1 gap-1">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'active', label: 'Активные' },
                { id: 'completed', label: 'Завершённые' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`h-8 px-3 text-xs transition-colors ${
                  statusFilter === f.id
                    ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-secondary hover:text-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isDm && (
            <button
              type="button"
              onClick={() => setActiveTab('dm')}
              className="hud-btn-secondary h-10 px-4 text-xs inline-flex items-center gap-2"
            >
              <Crown className="w-4 h-4 text-muted" strokeWidth={1.5} />
              <span>Управление</span>
            </button>
          )}
        </div>
      </div>

      {/* Split View: Stack on mobile, 5/7 split on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {filteredQuests.length === 0 ? (
            <div className="glass-panel hud-cut p-6 text-center text-sm text-muted">
              Квестов с выбранным статусом нет
            </div>
          ) : (
            filteredQuests.map((quest) => (
              <QuestTile
                key={quest.id}
                quest={quest}
                selected={selectedQuest?.id === quest.id}
                onSelect={() => setSelectedId(quest.id)}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-7 lg:sticky lg:top-6">
          <QuestDetail
            quest={selectedQuest}
            isDm={Boolean(isDm)}
            onEditQuest={() => setActiveTab('dm')}
          />
        </div>
      </div>
    </div>
  );
};
