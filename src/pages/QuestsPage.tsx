import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Star } from 'lucide-react';
import { QuestDetail } from '../components/quests/QuestDetail';
import { QuestTile } from '../components/quests/QuestTile';
import { patchQuestTile } from '../lib/api';
import { useCampaignStore } from '../lib/store';
import type { Quest } from '../lib/types';

type QuestStatusFilter = 'all' | 'active' | 'completed' | 'important';

export const QuestsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const quests = useCampaignStore((s) => s.quests);
  const setQuests = useCampaignStore((s) => s.setQuests);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const focusQuestInDm = useCampaignStore((s) => s.focusQuestInDm);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [selectedId, setSelectedId] = useState<number | null>(quests[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<QuestStatusFilter>('all');

  useEffect(() => {
    if (quests.length > 0 && (selectedId === null || !quests.some((q) => q.id === selectedId))) {
      setSelectedId(quests[0].id);
    }
  }, [quests, selectedId]);

  const filteredQuests = useMemo(() => {
    if (statusFilter === 'all') return quests;
    if (statusFilter === 'important') return quests.filter((q) => q.tileStyle?.isImportant);
    return quests.filter((q) => q.status === statusFilter);
  }, [quests, statusFilter]);

  const importantCount = useMemo(
    () => quests.filter((q) => q.tileStyle?.isImportant).length,
    [quests]
  );

  const selectedQuest: Quest | null =
    quests.find((q) => q.id === selectedId) ?? filteredQuests[0] ?? null;

  const isDm = user?.role === 'dm';

  const handleToggleImportant = async (quest: Quest) => {
    try {
      const updated = await patchQuestTile(quest.id, {
        isImportant: !quest.tileStyle?.isImportant,
      });
      setQuests(updated);
      pushToast({
        title: quest.tileStyle?.isImportant ? 'Метка снята' : 'Квест отмечен важным',
        message: quest.title,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось обновить плитку',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    }
  };

  const handleEditStyle = (quest: Quest) => {
    focusQuestInDm(quest.id);
  };

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
                {
                  id: 'important',
                  label: importantCount > 0 ? `★ Важные · ${importantCount}` : '★ Важные',
                },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`h-8 px-3 text-xs transition-colors inline-flex items-center gap-1 ${
                  statusFilter === f.id
                    ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-secondary hover:text-text'
                } ${f.id === 'important' && importantCount > 0 ? 'text-[#f59e0b]' : ''}`}
              >
                {f.id === 'important' && <Star className="w-3 h-3" strokeWidth={1.8} fill="currentColor" />}
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
                canToggleImportant={Boolean(isDm)}
                onToggleImportant={(q) => void handleToggleImportant(q)}
                onEditStyle={isDm ? (q) => handleEditStyle(q) : undefined}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-7 lg:sticky lg:top-6">
          <QuestDetail
            quest={selectedQuest}
            isDm={Boolean(isDm)}
            onEditQuest={() => setActiveTab('dm')}
            onToggleImportant={isDm ? (q) => void handleToggleImportant(q) : undefined}
          />
        </div>
      </div>
    </div>
  );
};
