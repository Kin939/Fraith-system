import React from 'react';
import { Award, Calendar, Edit3, MapPin, ShieldAlert, UserCheck } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import type { Quest } from '../../lib/types';
import { FormattedText } from '../common/FormattedText';

interface QuestDetailProps {
  quest: Quest | null;
  isDm: boolean;
  onEditQuest?: (quest: Quest) => void;
}

export const QuestDetail: React.FC<QuestDetailProps> = ({ quest, isDm, onEditQuest }) => {
  if (!quest) {
    return (
      <div className="glass-panel rounded-3xl p-8 h-full flex items-center justify-center text-center text-muted text-sm">
        Выберите квест на левой панели, чтобы прочитать полное описание, условия и награду.
      </div>
    );
  }

  const pct = Math.min(
    100,
    Math.round((quest.progressCurrent / Math.max(1, quest.progressTarget)) * 100)
  );
  const bannerUrl = resolveImageUrl(quest.imageKey, '⚔');

  return (
    <div className="glass-panel rounded-3xl overflow-hidden flex flex-col">
      {/* Banner Image from R2 / Preset */}
      <div className="relative h-56 w-full bg-bg overflow-hidden border-b border-border">
        <img
          src={bannerUrl}
          alt={quest.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />

        {isDm && onEditQuest && (
          <button
            type="button"
            onClick={() => onEditQuest(quest)}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold text-text hover:border-primary inline-flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-primary" />
            Редактировать (DM)
          </button>
        )}

        <div className="absolute bottom-3 left-5 right-5">
          <div className="text-xs text-accent font-semibold uppercase tracking-wider">
            Журнал заданий Фрейта #{quest.id}
          </div>
          <h2 className="font-anime font-extrabold text-2xl text-white drop-shadow">
            {quest.title}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Progress Meter */}
        <div className="p-4 rounded-2xl bg-bg/60 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted font-medium">{quest.shortDesc}</span>
            <span className="font-anime font-extrabold text-sm text-primary">
              {quest.progressCurrent} / {quest.progressTarget}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface border border-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--accent))',
              }}
            />
          </div>
        </div>

        {/* Full Lore Description */}
        <div className="space-y-2">
          <h4 className="font-anime font-bold text-sm uppercase tracking-wider text-muted">
            Описание поручения
          </h4>
          <FormattedText text={quest.fullDesc} className="text-sm text-text/95" />
        </div>

        {/* Reward Box */}
        {quest.reward && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 flex items-start gap-3">
            <Award className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-accent">
                Награда за выполнение
              </div>
              <div className="text-sm font-semibold text-text mt-0.5">{quest.reward}</div>
            </div>
          </div>
        )}

        {/* Quest Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {quest.parameters.location && (
            <div className="p-3 rounded-2xl bg-bg/50 border border-border flex items-center gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <div>
                <div className="text-muted">Локация</div>
                <div className="font-semibold text-text">{quest.parameters.location}</div>
              </div>
            </div>
          )}
          {quest.parameters.giver && (
            <div className="p-3 rounded-2xl bg-bg/50 border border-border flex items-center gap-2.5 text-xs">
              <UserCheck className="w-4 h-4 text-accent shrink-0" />
              <div>
                <div className="text-muted">Заказчик</div>
                <div className="font-semibold text-text">{quest.parameters.giver}</div>
              </div>
            </div>
          )}
          {quest.parameters.difficulty && (
            <div className="p-3 rounded-2xl bg-bg/50 border border-border flex items-center gap-2.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-muted">Сложность</div>
                <div className="font-semibold text-text">{quest.parameters.difficulty}</div>
              </div>
            </div>
          )}
          {quest.parameters.deadline && (
            <div className="p-3 rounded-2xl bg-bg/50 border border-border flex items-center gap-2.5 text-xs">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-muted">Срок</div>
                <div className="font-semibold text-text">{quest.parameters.deadline}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
