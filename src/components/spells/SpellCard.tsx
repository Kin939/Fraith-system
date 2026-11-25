import React from 'react';
import { Sparkles } from 'lucide-react';
import { MAGIC_SCHOOL_LABELS_RU } from '../../lib/lss';
import type { CharacterProfile, Spell } from '../../lib/types';
import { LearnButton } from './LearnButton';

interface SpellCardProps {
  spell: Spell;
  highlighted: boolean;
  playerProfile: CharacterProfile | null;
  isLearned: boolean;
  learnedCount: number;
}

export const SpellCard: React.FC<SpellCardProps> = ({
  spell,
  highlighted,
  playerProfile,
  isLearned,
  learnedCount,
}) => {
  return (
    <div
      id={`spell-card-${spell.id}`}
      className={`glass-panel rounded-3xl p-5 flex flex-col justify-between gap-4 transition-all ${
        highlighted ? 'neon-border ring-2 ring-accent' : 'hover:border-primary/50'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-anime font-extrabold px-2.5 py-0.5 rounded-lg bg-primary/20 text-primary border border-primary/30">
                {spell.level === 0 ? 'Заговор' : `${spell.level} круг`}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-bg/70 border border-border text-muted">
                {MAGIC_SCHOOL_LABELS_RU[spell.school] || spell.school}
              </span>
              {spell.isHomebrew && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-accent/20 text-accent border border-accent/40">
                  <Sparkles className="w-3 h-3" />
                  Homebrew
                </span>
              )}
            </div>
            <h3 className="font-anime font-bold text-lg mt-1.5 leading-snug">{spell.name}</h3>
          </div>

          <LearnButton
            spell={spell}
            playerProfile={playerProfile}
            isLearned={isLearned}
            learnedCount={learnedCount}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs bg-bg/55 p-3 rounded-2xl border border-border/70">
          <div>
            <span className="text-muted">Время:</span> {spell.castingTime}
          </div>
          <div>
            <span className="text-muted">Дистанция:</span> {spell.spellRange}
          </div>
          <div>
            <span className="text-muted">Компоненты:</span> {spell.components}
          </div>
          <div>
            <span className="text-muted">Длительность:</span> {spell.duration}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-text/90 leading-relaxed">{spell.description}</p>
      </div>

      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap gap-1">
          {spell.classes.map((cls) => (
            <span
              key={cls}
              className="px-2 py-0.5 rounded-md bg-surface border border-border text-muted"
            >
              {cls}
            </span>
          ))}
        </div>
        <span className="text-muted">{spell.source}</span>
      </div>
    </div>
  );
};
