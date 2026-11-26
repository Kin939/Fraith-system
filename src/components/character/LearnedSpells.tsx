import React, { useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { HudIcon } from '../common/HudIcon';
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
    <div className="glass-panel hud-corners hud-cut p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-primary/25 pb-3">
        <div className="flex items-center gap-2.5">
          <HudIcon asset="spark" size="md" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              MEMORY BANK // SPELL CHIPS
            </div>
            <h3 className="font-anime font-bold text-base uppercase">Изученные заклинания</h3>
          </div>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 bg-primary/12 border border-primary/50 text-primary font-bold tabular-nums">
          {learnedSpells.length} / {maxSpells}
        </span>
      </div>

      {learnedSpells.length === 0 ? (
        <div className="p-4 bg-[#070B14]/70 border border-primary/25 text-xs text-muted text-center space-y-2">
          <p>Пока не изучено ни одного заклинания.</p>
          <button
            type="button"
            onClick={() => useCampaignStore.getState().setActiveTab('spells')}
            className="text-primary underline font-semibold uppercase tracking-wider font-mono text-[11px]"
          >
            Открыть каталог заклинаний (dnd.su) →
          </button>
        </div>
      ) : (
        /* Compact Neon-Bordered Spell Chips */
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
                className="group inline-flex items-center gap-2 px-2.5 py-1.5 bg-[#070B14]/85 border border-primary/45 hover:border-primary hover:shadow-rim hud-cut-sm transition-all duration-200 cursor-pointer max-w-full"
              >
                <span className="font-mono text-[11px] font-bold text-primary tabular-nums shrink-0">
                  L{spell.level}
                </span>
                <span
                  className="w-4 h-4 flex items-center justify-center shrink-0"
                  title={MAGIC_SCHOOL_LABELS_RU[spell.school] || spell.school}
                >
                  <HudIcon glyph={school.glyph} size="xs" />
                </span>
                <span className="text-xs font-semibold text-text truncate max-w-[180px] sm:max-w-[240px] group-hover:text-primary transition-colors">
                  {spell.name}
                </span>
                {castBadge && (
                  <span
                    className={`px-1.5 py-0.2 border font-mono text-[10px] font-bold shrink-0 ${castBadge.className}`}
                  >
                    {castBadge.text}
                  </span>
                )}
                {spell.concentration && (
                  <span className="px-1 py-0.2 bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold">
                    К
                  </span>
                )}
                {spell.ritual && (
                  <span className="px-1 py-0.2 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-[10px] font-bold">
                    Р
                  </span>
                )}
                <span className="font-mono text-[10px] text-muted hidden sm:inline">
                  {compBadge}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    jumpToSpellInCatalog(spell.id);
                  }}
                  title="Перейти к заклинанию во вкладке «Заклинания»"
                  className="p-0.5 text-muted hover:text-primary transition-colors"
                >
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {previewSpell && (
        <div
          onClick={() => setPreviewSpell(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
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
                className="glass-panel px-4 py-2 text-xs font-semibold text-primary hover:border-primary inline-flex items-center gap-1.5"
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
