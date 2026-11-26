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
      <div className="glass-panel hud-corners hud-cut p-8 h-full flex items-center justify-center text-center text-muted font-mono text-xs uppercase tracking-widest">
        SELECT DIRECTIVE // Выберите квест слева для чтения досье и награды
      </div>
    );
  }

  const ratio = Math.min(1, Math.max(0, quest.progressCurrent / Math.max(1, quest.progressTarget)));
  const pct = Math.round(ratio * 100);
  const segmentCount = 10;
  const filledSegments = Math.round(ratio * segmentCount);
  const bannerUrl = resolveImageUrl(quest.imageKey, 'blades');

  return (
    <div className="glass-panel hud-corners hud-cut overflow-hidden flex flex-col">
      {/* HUD Banner Image */}
      <div className="relative h-56 w-full bg-[#070B14] overflow-hidden border-b border-primary/35">
        <img
          src={bannerUrl}
          alt={quest.title}
          className="w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/45 to-transparent" />

        {isDm && onEditQuest && (
          <button
            type="button"
            onClick={() => onEditQuest(quest)}
            className="absolute top-3 right-3 px-3 py-1.5 glass-panel border-primary/50 text-xs font-mono uppercase font-bold text-text hover:border-primary inline-flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-primary" />
            <span>EDIT // DM</span>
          </button>
        )}

        <div className="absolute bottom-3.5 left-5 right-5 space-y-1">
          <div className="font-mono text-[11px] text-primary font-bold uppercase tracking-[0.2em]">
            DIRECTIVE #{String(quest.id).padStart(2, '0')} // TACTICAL RECORD
          </div>
          <h2 className="font-anime font-extrabold text-xl sm:text-2xl uppercase tracking-wider text-text">
            <span className="text-primary">QUEST //</span> {quest.title}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {/* Decorative HUD Technical Divider */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="w-2 h-2 bg-primary shadow-[0_0_8px_var(--primary)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary shrink-0">
            TELEMETRY // COMPLETION
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-primary/60 via-accent/40 to-transparent" />
          <span className="font-mono text-xs font-bold text-primary tabular-nums">
            {quest.progressCurrent}/{quest.progressTarget} [{pct}%]
          </span>
        </div>

        {/* Segmented Progress Meter */}
        <div className="p-4 bg-[#070B14]/80 border border-primary/30 space-y-2.5">
          <div className="text-xs text-muted">{quest.shortDesc}</div>
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: segmentCount }, (_, idx) => {
              const lit = idx < filledSegments;
              return (
                <span
                  key={idx}
                  className={`h-2.5 border transition-all duration-200 ${
                    lit
                      ? 'bg-primary border-primary shadow-[0_0_10px_var(--glow)]'
                      : 'bg-[#0F172A] border-primary/20'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Decorative Section Divider */}
        <div className="flex items-center gap-3 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted shrink-0">
            // ОПИСАНИЕ ПОРУЧЕНИЯ
          </span>
          <div className="h-px flex-1 bg-primary/25" />
        </div>

        <FormattedText text={quest.fullDesc} className="text-sm text-text/95" />

        {/* Reward Box */}
        {quest.reward && (
          <div className="p-4 bg-primary/10 border border-primary/45 border-l-2 border-l-primary flex items-start gap-3">
            <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                REWARD // НАГРАДА ЗА ВЫПОЛНЕНИЕ
              </div>
              <div className="text-sm font-semibold text-text mt-0.5">{quest.reward}</div>
            </div>
          </div>
        )}

        {/* Quest Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {quest.parameters.location && (
            <div className="p-3 bg-[#070B14]/75 border border-primary/25 flex items-center gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <div>
                <div className="font-mono text-[10px] uppercase text-muted">Локация</div>
                <div className="font-semibold text-text">{quest.parameters.location}</div>
              </div>
            </div>
          )}
          {quest.parameters.giver && (
            <div className="p-3 bg-[#070B14]/75 border border-primary/25 flex items-center gap-2.5 text-xs">
              <UserCheck className="w-4 h-4 text-primary shrink-0" />
              <div>
                <div className="font-mono text-[10px] uppercase text-muted">Заказчик</div>
                <div className="font-semibold text-text">{quest.parameters.giver}</div>
              </div>
            </div>
          )}
          {quest.parameters.difficulty && (
            <div className="p-3 bg-[#070B14]/75 border border-primary/25 flex items-center gap-2.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="font-mono text-[10px] uppercase text-muted">Сложность</div>
                <div className="font-semibold text-text">{quest.parameters.difficulty}</div>
              </div>
            </div>
          )}
          {quest.parameters.deadline && (
            <div className="p-3 bg-[#070B14]/75 border border-primary/25 flex items-center gap-2.5 text-xs">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-mono text-[10px] uppercase text-muted">Срок</div>
                <div className="font-semibold text-text">{quest.parameters.deadline}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
