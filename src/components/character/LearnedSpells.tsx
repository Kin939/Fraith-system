import React, { useState } from 'react';
import { ArrowUpRight, BookOpen, Sparkles, X } from 'lucide-react';
import { MAGIC_SCHOOL_LABELS_RU } from '../../lib/lss';
import { useCampaignStore } from '../../lib/store';
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
          {learnedSpells.length} / {maxSpells} слотов памяти
        </span>
      </div>

      {learnedSpells.length === 0 ? (
        <div className="p-4 rounded-2xl bg-bg/50 border border-border/70 text-xs text-muted text-center space-y-2">
          <p>Персонаж ещё не изучил ни одного заклинания на вкладке «Заклинания».</p>
          <button
            type="button"
            onClick={() => useCampaignStore.getState().setActiveTab('spells')}
            className="text-accent underline font-medium"
          >
            Открыть каталог заклинаний →
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {learnedSpells.map(({ spell }) => (
            <div
              key={spell.id}
              onClick={() => setPreviewSpell(spell)}
              className="group p-3 rounded-2xl bg-bg/60 border border-border hover:border-primary/60 transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/20 text-primary shrink-0">
                    {spell.level === 0 ? 'Заговор' : `${spell.level} ур.`}
                  </span>
                  <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {spell.name}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-0.5 truncate">
                  {MAGIC_SCHOOL_LABELS_RU[spell.school] || spell.school} • {spell.castingTime} •{' '}
                  {spell.spellRange}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  jumpToSpellInCatalog(spell.id);
                }}
                title="Перейти к заклинанию во вкладке «Заклинания»"
                className="p-1.5 rounded-xl border border-border text-muted hover:text-accent hover:border-accent/50 shrink-0"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Read-only Spell Quick-View Modal */}
      {previewSpell && (
        <div
          onClick={() => setPreviewSpell(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel neon-border rounded-3xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-primary/20 text-primary">
                    {previewSpell.level === 0 ? 'Заговор' : `${previewSpell.level}-й уровень`}
                  </span>
                  <span className="text-xs text-accent">
                    {MAGIC_SCHOOL_LABELS_RU[previewSpell.school] || previewSpell.school}
                  </span>
                </div>
                <h4 className="font-anime font-extrabold text-xl mt-1">{previewSpell.name}</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSpell(null)}
                className="p-1.5 rounded-xl border border-border text-muted hover:text-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-bg/60 p-3 rounded-2xl border border-border">
              <div>
                <span className="text-muted">Накладывание:</span>{' '}
                <strong className="text-text">{previewSpell.castingTime}</strong>
              </div>
              <div>
                <span className="text-muted">Дистанция:</span>{' '}
                <strong className="text-text">{previewSpell.spellRange}</strong>
              </div>
              <div>
                <span className="text-muted">Компоненты:</span>{' '}
                <strong className="text-text">{previewSpell.components}</strong>
              </div>
              <div>
                <span className="text-muted">Длительность:</span>{' '}
                <strong className="text-text">{previewSpell.duration}</strong>
              </div>
            </div>

            <p className="text-sm text-text/90 leading-relaxed whitespace-pre-line">
              {previewSpell.description}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted">Источник: {previewSpell.source}</span>
              <button
                type="button"
                onClick={() => {
                  const id = previewSpell.id;
                  setPreviewSpell(null);
                  jumpToSpellInCatalog(id);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Открыть в каталоге заклинаний
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
