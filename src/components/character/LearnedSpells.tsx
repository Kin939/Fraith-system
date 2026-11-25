import React, { useState } from 'react';
import { ArrowUpRight, BookOpen, Sparkles } from 'lucide-react';
import { getSchoolMeta, getSpellDisplayBadge } from '../../lib/dndsuSpells';
import { MAGIC_SCHOOL_LABELS_RU } from '../../lib/lss';
import { useCampaignStore } from '../../lib/store';
import { SpellCard } from '../spells/SpellCard';
import type { LearnedSpellRecord, Spell } from '../../lib/types';

interface LearnedSpellsProps {
  learnedSpells: LearnedSpellRecord[];
  maxSpells: number;
}

export const LearnedSpells: React.FC<LearnedSpellsProps> = ({ learnedSpells, maxSpells }) => {
  const jumpToSpellInCatalog = useCampaignStore((s) => s.jumpToSpellInCatalog);
  const [previewSpell, setPreviewSpell] = useState<Spell | null>(null);

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="font-anime font-bold text-base">Изученные заклинания</h3>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-xl bg-primary/15 border border-primary/30 text-primary font-semibold">
          {learnedSpells.length} / {maxSpells}
        </span>
      </div>

      {learnedSpells.length === 0 ? (
        <div className="p-4 rounded-2xl bg-bg/50 border border-border/70 text-xs text-muted text-center space-y-2">
          <p>Пока не изучено ни одного заклинания.</p>
          <button
            type="button"
            onClick={() => useCampaignStore.getState().setActiveTab('spells')}
            className="text-accent underline font-medium"
          >
            Открыть справочник заклинаний (dnd.su) →
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {learnedSpells.map(({ spell }) => {
            const school = getSchoolMeta(spell.school);
            const compBadge = getSpellDisplayBadge(spell);
            return (
              <div
                key={spell.id}
                onClick={() => setPreviewSpell(spell)}
                className="group px-3 py-2 rounded-xl bg-bg/60 border border-border hover:border-primary/60 transition-all cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-primary shrink-0">
                    [{spell.level}]
                  </span>
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                    style={{ backgroundColor: school.bg, color: school.color }}
                    title={MAGIC_SCHOOL_LABELS_RU[spell.school] || spell.school}
                  >
                    {school.glyph}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {spell.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {spell.concentration && (
                    <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      К
                    </span>
                  )}
                  {spell.ritual && (
                    <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                      Р
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-muted">{compBadge}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      jumpToSpellInCatalog(spell.id);
                    }}
                    title="Перейти к заклинанию во вкладке «Заклинания»"
                    className="p-1 rounded-lg border border-border text-muted hover:text-accent hover:border-accent/50"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewSpell && (
        <div
          onClick={() => setPreviewSpell(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full max-h-[88vh] overflow-y-auto space-y-2"
          >
            <SpellCard
              spell={previewSpell}
              playerProfile={null}
              isLearned={true}
              learnedCount={learnedSpells.length}
              onClose={() => setPreviewSpell(null)}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const id = previewSpell.id;
                  setPreviewSpell(null);
                  jumpToSpellInCatalog(id);
                }}
                className="glass-panel px-4 py-2 rounded-xl text-xs font-semibold text-accent hover:border-accent inline-flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Открыть в справочнике заклинаний
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
