import React, { useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { getSchoolMeta, getSpellDisplayBadge } from '../../lib/dndsuSpells';
import { MAGIC_SCHOOL_LABELS_RU } from '../../lib/lss';
import { formatSpellCastBadge } from '../../lib/spellCasting';
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
    <div className="glass-panel hud-cut p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-muted" strokeWidth={1.5} />
          <h3 className="font-medium text-base text-text">Изученные заклинания</h3>
        </div>
        <span className="font-mono text-xs text-secondary tabular-nums">
          {learnedSpells.length} из {maxSpells}
        </span>
      </div>

      {learnedSpells.length === 0 ? (
        <div className="p-4 bg-bg border border-border text-xs text-secondary text-center space-y-2">
          <p>Пока не изучено ни одного заклинания</p>
          <button
            type="button"
            onClick={() => useCampaignStore.getState().setActiveTab('spells')}
            className="text-primary hover:underline font-medium text-xs"
          >
            Открыть справочник заклинаний
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {learnedSpells.map((rec) => {
            const { spell } = rec;
            const school = getSchoolMeta(spell.school);
            const compBadge = getSpellDisplayBadge(spell);
            const castBadge =
              rec.castMode && rec.castMode !== 'slot'
                ? formatSpellCastBadge(rec.castMode, spell.level, rec.castMaxUses, rec.castNote)
                : null;
            return (
              <div
                key={spell.id}
                onClick={() => setPreviewSpell(spell)}
                className="group h-9 inline-flex items-center gap-2 px-3 bg-bg border border-border hover:bg-raised hover:border-text/20 hud-cut-sm transition-colors cursor-pointer max-w-full"
              >
                <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                  [{spell.level}]
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: school.color }}
                  title={MAGIC_SCHOOL_LABELS_RU[spell.school] || spell.school}
                />
                <span className="text-xs font-medium text-text truncate max-w-[180px] sm:max-w-[240px]">
                  {spell.name}
                </span>
                {castBadge && (
                  <span
                    className={`px-1.5 py-0.5 border font-mono text-[11px] shrink-0 ${castBadge.className}`}
                  >
                    {castBadge.text}
                  </span>
                )}
                {spell.concentration && (
                  <span className="font-mono text-[11px] text-muted" title="Концентрация">
                    К
                  </span>
                )}
                {spell.ritual && (
                  <span className="font-mono text-[11px] text-muted" title="Ритуал">
                    Р
                  </span>
                )}
                <span className="font-mono text-[11px] text-muted hidden sm:inline">
                  {compBadge}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    jumpToSpellInCatalog(spell.id);
                  }}
                  title="Перейти к заклинанию во вкладке «Заклинания»"
                  className="p-0.5 text-muted hover:text-text transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {previewSpell && (
        <div
          onClick={() => setPreviewSpell(null)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
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
                className="hud-btn-secondary h-9 px-4 text-xs inline-flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" strokeWidth={1.5} />
                <span>Открыть в справочнике</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
