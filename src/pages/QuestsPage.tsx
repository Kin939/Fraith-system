import React, { useEffect, useState } from 'react';
import { Crown, ScrollText } from 'lucide-react';
import { HudFrame } from '../components/common/HudFrame';
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
      <HudFrame
        code="OPS.LOG // MISSION DIRECTIVES"
        title="Доска квестов и поручений"
        subtitle="Двухпанельный тактический журнал заданий отряда с синхронизацией в реальном времени"
        rightSlot={
          <>
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
                className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border transition-all duration-200 ${
                  statusFilter === f.id
                    ? 'bg-primary text-[#040810] border-primary font-bold shadow-rim'
                    : 'bg-[#070B14]/80 border-primary/30 text-muted hover:text-text hover:border-primary/60'
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
                <span>Управление (DM)</span>
              </button>
            )}
          </>
        }
      >
        <div className="hidden" aria-hidden="true">
          <ScrollText className="w-4 h-4" />
        </div>
      </HudFrame>

      {/* Responsive Split View: Stack on mobile, 5/7 split on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
          {filteredQuests.length === 0 ? (
            <div className="glass-panel hud-corners hud-cut p-6 text-center font-mono text-xs uppercase tracking-wider text-muted">
              NO DIRECTIVES // Квестов с выбранным статусом пока нет
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
