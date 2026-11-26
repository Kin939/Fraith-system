import React from 'react';
import { Award, Calendar, Edit3, MapPin, ShieldAlert, Star, UserCheck } from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import { questEmblemUrl, questTileCssVars, resolveQuestAccent } from '../../lib/questStyle';
import type { Quest } from '../../lib/types';
import { FormattedText } from '../common/FormattedText';
import { QuestNotes } from './QuestNotes';

interface QuestDetailProps {
  quest: Quest | null;
  isDm: boolean;
  onEditQuest?: (quest: Quest) => void;
  onToggleImportant?: (quest: Quest) => void;
}

export const QuestDetail: React.FC<QuestDetailProps> = ({
  quest,
  isDm,
  onEditQuest,
  onToggleImportant,
}) => {
  if (!quest) {
    return (
      <div className="glass-panel hud-cut p-8 h-full flex items-center justify-center text-center text-muted text-sm">
        Выберите квест слева, чтобы прочитать описание и награду
      </div>
    );
  }

  const ratio = Math.min(1, Math.max(0, quest.progressCurrent / Math.max(1, quest.progressTarget)));
  const pct = Math.round(ratio * 100);
  const segmentCount = 10;
  const filledSegments = Math.round(ratio * segmentCount);
  const bannerUrl = resolveImageUrl(quest.imageKey, 'blades');
  const accent = resolveQuestAccent(quest);
  const emblem = questEmblemUrl(quest.tileStyle?.emblem);
  const important = Boolean(quest.tileStyle?.isImportant);

  return (
    <div
      className="glass-panel hud-cut overflow-hidden flex flex-col relative"
      style={questTileCssVars(quest)}
    >
      {quest.tileStyle?.pattern && quest.tileStyle.pattern !== 'none' && (
        <span
          aria-hidden
          className={`quest-tile__pattern quest-pattern--${quest.tileStyle.pattern} pointer-events-none`}
        />
      )}

      {/* Banner blended into surface */}
      <div className="relative h-52 w-full bg-deep overflow-hidden border-b border-border">
        <img
          src={bannerUrl}
          alt={quest.title}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
        <div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
          aria-hidden
        />

        <div className="absolute top-4 right-4 flex items-center gap-2">
          {important && (
            <span
              className="h-8 px-2.5 text-[11px] inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm border"
              style={{ borderColor: `${accent}99`, color: accent }}
            >
              <Star className="w-3 h-3" strokeWidth={2} fill="currentColor" />
              <span className="tracking-wide">ВАЖНЫЙ КВЕСТ</span>
            </span>
          )}
          {isDm && onToggleImportant && (
            <button
              type="button"
              onClick={() => onToggleImportant(quest)}
              className="h-8 w-8 inline-flex items-center justify-center bg-black/40 backdrop-blur-sm border border-border hover:border-text/40 transition-colors"
              title={important ? 'Снять метку важного' : 'Отметить важным квестом'}
            >
              <Star
                className="w-4 h-4"
                strokeWidth={1.6}
                style={{ color: important ? accent : undefined }}
                fill={important ? 'currentColor' : 'none'}
              />
            </button>
          )}
          {isDm && onEditQuest && (
            <button
              type="button"
              onClick={() => onEditQuest(quest)}
              className="h-8 px-3 hud-btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              <span>Изменить</span>
            </button>
          )}
        </div>

        <div className="absolute bottom-4 left-6 right-6 space-y-1">
          <div className="text-xs text-secondary flex items-center gap-2">
            {emblem && (
              <img
                src={emblem}
                alt=""
                draggable={false}
                className="w-5 h-5 object-contain quest-tile__emblem"
              />
            )}
            <span>Квест #{quest.id}</span>
          </div>
          <h2 className="font-medium text-xl sm:text-2xl text-text">
            {quest.title}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Progress Block */}
        <div
          className="p-4 bg-bg border space-y-3 relative z-10"
          style={{ borderColor: `${accent}40` }}
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-secondary">{quest.shortDesc}</span>
            <span className="font-mono text-text tabular-nums shrink-0">
              {quest.progressCurrent} из {quest.progressTarget} ({pct}%)
            </span>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: segmentCount }, (_, idx) => {
              const lit = idx < filledSegments;
              return (
                <span
                  key={idx}
                  className={`h-2 transition-colors ${lit ? 'quest-tile__progress-lit' : 'bg-raised'}`}
                />
              );
            })}
          </div>
        </div>

        {/* Full Description */}
        <div className="space-y-2">
          <div className="text-xs text-muted">Описание</div>
          <FormattedText text={quest.fullDesc} className="text-sm text-secondary" />
        </div>

        {/* Reward */}
        {quest.reward && (
          <div
            className="p-4 bg-bg border border-border border-l-2 flex items-start gap-3"
            style={{ borderLeftColor: accent }}
          >
            <Award className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} style={{ color: accent }} />
            <div>
              <div className="text-xs text-muted">Награда</div>
              <div className="text-sm font-medium text-text mt-0.5">{quest.reward}</div>
            </div>
          </div>
        )}

        {/* Quest Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quest.parameters.location && (
            <div className="p-3 bg-bg border border-border flex items-center gap-3 text-xs">
              <MapPin className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} />
              <div>
                <div className="text-muted">Локация</div>
                <div className="font-medium text-text mt-0.5">{quest.parameters.location}</div>
              </div>
            </div>
          )}
          {quest.parameters.giver && (
            <div className="p-3 bg-bg border border-border flex items-center gap-3 text-xs">
              <UserCheck className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} />
              <div>
                <div className="text-muted">Заказчик</div>
                <div className="font-medium text-text mt-0.5">{quest.parameters.giver}</div>
              </div>
            </div>
          )}
          {quest.parameters.difficulty && (
            <div className="p-3 bg-bg border border-border flex items-center gap-3 text-xs">
              <ShieldAlert className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} />
              <div>
                <div className="text-muted">Сложность</div>
                <div className="font-medium text-text mt-0.5">{quest.parameters.difficulty}</div>
              </div>
            </div>
          )}
          {quest.parameters.deadline && (
            <div className="p-3 bg-bg border border-border flex items-center gap-3 text-xs">
              <Calendar className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} />
              <div>
                <div className="text-muted">Срок</div>
                <div className="font-medium text-text mt-0.5">{quest.parameters.deadline}</div>
              </div>
            </div>
          )}
        </div>

        {/* Party notes — everyone writes in their own name, everyone reads them */}
        <div className="pt-4 border-t border-border">
          <QuestNotes questId={quest.id} />
        </div>
      </div>
    </div>
  );
};
