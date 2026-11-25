import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Crown } from 'lucide-react';
import { SpellCard } from '../components/spells/SpellCard';
import { SpellFilters, SpellFilterState } from '../components/spells/SpellFilters';
import { normalizeDndClass } from '../lib/lss';
import { useCampaignStore } from '../lib/store';

export const SpellsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const spells = useCampaignStore((s) => s.spells);
  const charactersById = useCampaignStore((s) => s.charactersById);
  const learnedSpellsById = useCampaignStore((s) => s.learnedSpellsById);
  const highlightedSpellId = useCampaignStore((s) => s.highlightedSpellId);
  const clearHighlightedSpell = useCampaignStore((s) => s.clearHighlightedSpell);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);

  const [filters, setFilters] = useState<SpellFilterState>({
    search: '',
    level: 'all',
    school: 'all',
    dndClass: 'all',
    onlyHomebrew: false,
    sortBy: 'level',
  });

  const isPlayer = user?.role === 'player' && user.playerId !== null;
  const playerProfile =
    isPlayer && user?.playerId ? (charactersById[user.playerId] ?? null) : null;
  const learnedRecords =
    isPlayer && user?.playerId ? (learnedSpellsById[user.playerId] ?? []) : [];
  const learnedIdsSet = useMemo(
    () => new Set(learnedRecords.map((r) => r.spellId)),
    [learnedRecords]
  );

  // Scroll smoothly when jumping to a spell from Tab 1
  useEffect(() => {
    if (!highlightedSpellId) return;
    const el = document.getElementById(`spell-card-${highlightedSpellId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const timer = window.setTimeout(() => {
      clearHighlightedSpell();
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [highlightedSpellId, clearHighlightedSpell]);

  const filteredSpells = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const list = spells.filter((sp) => {
      if (filters.level !== 'all' && String(sp.level) !== filters.level) return false;
      if (filters.school !== 'all' && sp.school !== filters.school) return false;
      if (filters.onlyHomebrew && !sp.isHomebrew) return false;
      if (filters.dndClass !== 'all') {
        const matchClass = sp.classes.some(
          (c) => (normalizeDndClass(c) ?? c).toLowerCase() === filters.dndClass.toLowerCase()
        );
        if (!matchClass) return false;
      }
      if (q) {
        const hay = `${sp.name} ${sp.description} ${sp.school} ${sp.classes.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (filters.sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ru');
      }
      return a.level - b.level || a.name.localeCompare(b.name, 'ru');
    });

    return list;
  }, [spells, filters]);

  return (
    <div className="space-y-5">
      <div className="glass-panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-anime font-extrabold text-xl">Каталог заклинаний (SRD + Homebrew)</h1>
            <p className="text-xs text-muted">
              Все заклинания открыты • Игроки изучают заклинания своего класса в пределах максимума
            </p>
          </div>
        </div>

        {playerProfile ? (
          <div className="px-4 py-2 rounded-2xl bg-bg/70 border border-primary/40 text-xs flex items-center gap-3">
            <span>
              Класс: <strong className="text-accent">{playerProfile.charClass}</strong>
            </span>
            <span>•</span>
            <span>
              Изучено:{' '}
              <strong className="text-primary">
                {learnedRecords.length} / {playerProfile.maxSpells}
              </strong>
            </span>
          </div>
        ) : (
          user?.role === 'dm' && (
            <button
              type="button"
              onClick={() => setActiveTab('dm')}
              className="anime-btn-primary px-3.5 py-2 text-xs inline-flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              Добавить Homebrew (DM)
            </button>
          )
        )}
      </div>

      <SpellFilters filters={filters} onChange={setFilters} />

      {filteredSpells.length === 0 ? (
        <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted">
          По выбранным фильтрам заклинаний не найдено.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSpells.map((spell) => (
            <SpellCard
              key={spell.id}
              spell={spell}
              highlighted={highlightedSpellId === spell.id}
              playerProfile={playerProfile}
              isLearned={learnedIdsSet.has(spell.id)}
              learnedCount={learnedRecords.length}
            />
          ))}
        </div>
      )}
    </div>
  );
};
