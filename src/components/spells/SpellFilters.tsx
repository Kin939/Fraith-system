import React from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { DND_CLASS_LABELS_RU, MAGIC_SCHOOL_LABELS_RU } from '../../lib/lss';

export interface SpellFilterState {
  search: string;
  level: string; // 'all' | '0'..'9'
  school: string; // 'all' | MagicSchool
  dndClass: string; // 'all' | DndClass
  onlyHomebrew: boolean;
  sortBy: 'level' | 'name';
}

interface SpellFiltersProps {
  filters: SpellFilterState;
  onChange: (next: SpellFilterState) => void;
}

const SCHOOLS = Object.keys(MAGIC_SCHOOL_LABELS_RU);
const CLASSES = ['Wizard', 'Cleric', 'Sorcerer', 'Warlock', 'Bard', 'Druid', 'Paladin', 'Ranger'];

export const SpellFilters: React.FC<SpellFiltersProps> = ({ filters, onChange }) => {
  const reset = () =>
    onChange({
      search: '',
      level: 'all',
      school: 'all',
      dndClass: 'all',
      onlyHomebrew: false,
      sortBy: 'level',
    });

  return (
    <div className="glass-panel rounded-3xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider">
          <Filter className="w-4 h-4 text-primary" />
          Фильтры и сортировка гримуара
        </div>

        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Сбросить
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Поиск по названию или тексту..."
            className="anime-input w-full pl-9 text-sm"
          />
        </div>

        <select
          value={filters.level}
          onChange={(e) => onChange({ ...filters, level: e.target.value })}
          className="anime-input text-sm"
        >
          <option value="all">Все уровни (0–9)</option>
          <option value="0">0 — Заговор (Cantrip)</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
            <option key={lvl} value={String(lvl)}>
              {lvl}-й уровень
            </option>
          ))}
        </select>

        <select
          value={filters.school}
          onChange={(e) => onChange({ ...filters, school: e.target.value })}
          className="anime-input text-sm"
        >
          <option value="all">Все школы магии</option>
          {SCHOOLS.map((sch) => (
            <option key={sch} value={sch}>
              {MAGIC_SCHOOL_LABELS_RU[sch]}
            </option>
          ))}
        </select>

        <select
          value={filters.dndClass}
          onChange={(e) => onChange({ ...filters, dndClass: e.target.value })}
          className="anime-input text-sm"
        >
          <option value="all">Все классы</option>
          {CLASSES.map((cl) => (
            <option key={cl} value={cl}>
              {DND_CLASS_LABELS_RU[cl] || cl}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onlyHomebrew}
            onChange={(e) => onChange({ ...filters, onlyHomebrew: e.target.checked })}
            className="w-4 h-4 accent-purple-500"
          />
          <span>Показать только Homebrew-заклинания Мастера</span>
        </label>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Сортировка:</span>
          <button
            type="button"
            onClick={() => onChange({ ...filters, sortBy: 'level' })}
            className={`px-2.5 py-1 rounded-lg border ${
              filters.sortBy === 'level'
                ? 'border-primary bg-primary/20 text-primary font-semibold'
                : 'border-border text-muted'
            }`}
          >
            По уровню
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filters, sortBy: 'name' })}
            className={`px-2.5 py-1 rounded-lg border ${
              filters.sortBy === 'name'
                ? 'border-primary bg-primary/20 text-primary font-semibold'
                : 'border-border text-muted'
            }`}
          >
            По алфавиту
          </button>
        </div>
      </div>
    </div>
  );
};
