import React, { useEffect, useState } from 'react';
import { Crown, ScrollText } from 'lucide-react';
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
    <div className="space-y-5">
      {/* Page Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-anime font-extrabold text-xl">Доска квестов и поручений</h1>
            <p className="text-xs text-muted">
              Двухпанельный журнал заданий отряда с отслеживанием прогресса в реальном времени
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                statusFilter === f.id
                  ? 'bg-primary/20 border-primary text-text'
                  : 'bg-bg/60 border-border text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}

          {isDm && (
            <button
              type="button"
              onClick={() => setActiveTab('dm')}
              className="anime-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              Управление квестами (DM)
            </button>
          )}
        </div>
      </div>

      {/* Split View: Left = Grid of Tiles, Right = Selected Quest Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
          {filteredQuests.length === 0 ? (
            <div className="glass-panel rounded-3xl p-6 text-center text-xs text-muted">
              Квестов с выбранным статусом пока нет.
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

        <div className="lg:col-span-7 lg:sticky lg:top-5">
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
