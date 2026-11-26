import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  ChevronDown,
  Crown,
  HelpCircle,
  LayoutGrid,
  List,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { PlayerSwitcher } from '../components/dm/PlayerSwitcher';
import { DndsuMultiSelect } from '../components/spells/DndsuMultiSelect';
import { SpellCard } from '../components/spells/SpellCard';
import {
  countActiveFilterBadges,
  DndsuActiveFilters,
  filterAndSortDndsuSpells,
  getSchoolMeta,
  getSpellDisplayBadge,
  INITIAL_DNDSU_FILTERS,
  loadDndsuFilters,
  loadHomebrewDndsuSpells,
  loadOfficialDndsuSpells,
  SCHOOL_META_LIST,
  SpellCategoryMode,
  SpellSortMode,
} from '../lib/dndsuSpells';
import {
  CANONICAL_TO_DNDSU_CLASS_ID,
  DND_HOMEBREW_CLASS_BY_KEY,
  extractPlayerCanonicalClasses,
  formatCharacterClassesRu,
  MAGIC_SCHOOL_LABELS_RU,
} from '../lib/lss';
import { useCampaignStore } from '../lib/store';
import type {
  DndsuCategoryFilters,
  DndsuFilterGroup,
  DndsuFiltersPayload,
  LearnedSpellRecord,
  Spell,
} from '../lib/types';

const EMPTY_LEARNED_RECORDS: LearnedSpellRecord[] = [];

function mergeFilterGroups(a: DndsuFilterGroup[] = [], b: DndsuFilterGroup[] = []): DndsuFilterGroup[] {
  const byTitle = new Map<string, Map<string, { title: string; value: number | string }>>();
  for (const src of [a, b]) {
    for (const g of src) {
      const key = g.title || '';
      if (!byTitle.has(key)) byTitle.set(key, new Map());
      const itemMap = byTitle.get(key)!;
      for (const it of g.list) {
        itemMap.set(String(it.value), it);
      }
    }
  }
  return Array.from(byTitle.entries()).map(([title, itemMap]) => ({
    title,
    list: Array.from(itemMap.values()),
  }));
}

export const SpellsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const customDmSpells = useCampaignStore((s) => s.spells);
  const charactersById = useCampaignStore((s) => s.charactersById);
  const learnedSpellsById = useCampaignStore((s) => s.learnedSpellsById);
  const highlightedSpellId = useCampaignStore((s) => s.highlightedSpellId);
  const clearHighlightedSpell = useCampaignStore((s) => s.clearHighlightedSpell);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);

  const [officialSpells, setOfficialSpells] = useState<Spell[]>([]);
  const [homebrewSpells, setHomebrewSpells] = useState<Spell[]>([]);
  const [filterMeta, setFilterMeta] = useState<DndsuFiltersPayload | null>(null);
  const [loadingOfficial, setLoadingOfficial] = useState(true);
  const [loadingHomebrew, setLoadingHomebrew] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [category, setCategory] = useState<SpellCategoryMode>('official');
  const [filters, setFilters] = useState<DndsuActiveFilters>(INITIAL_DNDSU_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'grid'>('split');
  const [selectedSpellId, setSelectedSpellId] = useState<number | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(240);

  const isPlayer = user?.role === 'player' && user.playerId !== null;
  const dmSelectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const inspectedPlayerId =
    user?.role === 'dm' ? dmSelectedPlayerId : (user?.playerId ?? null);
  const playerProfile = inspectedPlayerId
    ? (charactersById[inspectedPlayerId] ?? null)
    : null;
  const learnedRecords = inspectedPlayerId
    ? (learnedSpellsById[inspectedPlayerId] ?? EMPTY_LEARNED_RECORDS)
    : EMPTY_LEARNED_RECORDS;
  const learnedIdsSet = useMemo(
    () => new Set(learnedRecords.map((r) => r.spellId)),
    [learnedRecords]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingOfficial(true);

    Promise.all([loadOfficialDndsuSpells(), loadDndsuFilters()])
      .then(([off, fMeta]) => {
        if (cancelled) return;
        setOfficialSpells(off);
        setFilterMeta(fMeta);
        setLoadingOfficial(false);
        if (off.length > 0) {
          setSelectedSpellId((prev) => prev ?? off[0].id);
        }

        return loadHomebrewDndsuSpells().then((hb) => {
          if (cancelled) return;
          setHomebrewSpells(hb);
          setLoadingHomebrew(false);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки базы dnd.su');
        setLoadingOfficial(false);
        setLoadingHomebrew(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVisibleLimit(240);
  }, [category, deferredFilters]);

  const allSpellsMap = useMemo(() => {
    const map = new Map<number, Spell>();
    for (const s of officialSpells) map.set(s.id, s);
    for (const s of homebrewSpells) map.set(s.id, s);
    for (const s of customDmSpells) map.set(s.id, s);
    return map;
  }, [officialSpells, homebrewSpells, customDmSpells]);

  const selectAndRevealSpell = useCallback(
    (targetId: number) => {
      const target = allSpellsMap.get(targetId);
      if (target) {
        if (category === 'official' && target.isHomebrew) {
          setCategory('homebrew');
        } else if (category === 'homebrew' && !target.isHomebrew) {
          setCategory('official');
        }
      }
      setSelectedSpellId(targetId);
      if (window.innerWidth < 1024) {
        setMobileDrawerOpen(true);
      }
      window.setTimeout(() => {
        const rowEl = document.getElementById(`spell-row-${targetId}`);
        rowEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    },
    [allSpellsMap, category]
  );

  useEffect(() => {
    if (!highlightedSpellId) return;
    if (allSpellsMap.size === 0) return;
    selectAndRevealSpell(highlightedSpellId);
    const timer = window.setTimeout(() => {
      clearHighlightedSpell();
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [highlightedSpellId, allSpellsMap, selectAndRevealSpell, clearHighlightedSpell]);

  const activeCategoryFilters: DndsuCategoryFilters | null = useMemo(() => {
    if (!filterMeta) return null;
    if (category === 'official') return filterMeta.official;
    if (category === 'homebrew') return filterMeta.homebrew;
    const merged: DndsuCategoryFilters = {};
    for (const key of Object.keys(filterMeta.official)) {
      merged[key] = mergeFilterGroups(filterMeta.official[key], filterMeta.homebrew[key]);
    }
    return merged;
  }, [filterMeta, category]);

  const officialCombined = useMemo(() => {
    const customOff = customDmSpells.filter((s) => !s.isHomebrew);
    return customOff.length ? [...officialSpells, ...customOff] : officialSpells;
  }, [officialSpells, customDmSpells]);

  const homebrewCombined = useMemo(() => {
    const customHb = customDmSpells.filter((s) => s.isHomebrew);
    return customHb.length ? [...homebrewSpells, ...customHb] : homebrewSpells;
  }, [homebrewSpells, customDmSpells]);

  const baseSpells = useMemo(() => {
    if (category === 'official') return officialCombined;
    if (category === 'homebrew') return homebrewCombined;
    if (category === 'learned') {
      return learnedRecords.map((r) => allSpellsMap.get(r.spellId) ?? r.spell);
    }
    return [...officialCombined, ...homebrewCombined];
  }, [category, officialCombined, homebrewCombined, learnedRecords, allSpellsMap]);

  const filteredSpells = useMemo(
    () => filterAndSortDndsuSpells(baseSpells, deferredFilters),
    [baseSpells, deferredFilters]
  );

  const displayedSpells = useMemo(
    () => filteredSpells.slice(0, viewMode === 'grid' ? Math.min(visibleLimit, 60) : visibleLimit),
    [filteredSpells, visibleLimit, viewMode]
  );

  const groupedSpells = useMemo(() => {
    const groups: Array<{ key: string; title: string; items: Spell[] }> = [];
    const map = new Map<string, { key: string; title: string; items: Spell[] }>();

    for (const sp of displayedSpells) {
      let key: string;
      let title: string;
      if (filters.sortBy === 'level') {
        key = `lvl-${sp.level}`;
        title = sp.level === 0 ? 'Заговоры · 0 круг' : `${sp.level} круг`;
      } else if (filters.sortBy === 'school') {
        const sRu = MAGIC_SCHOOL_LABELS_RU[sp.school] || sp.school;
        key = `sch-${sRu}`;
        title = sRu;
      } else {
        const firstChar = (sp.name.trim()[0] || '#').toUpperCase().replace('Ё', 'Е');
        key = `ch-${firstChar}`;
        title = firstChar;
      }

      let grp = map.get(key);
      if (!grp) {
        grp = { key, title, items: [] };
        map.set(key, grp);
        groups.push(grp);
      }
      grp.items.push(sp);
    }
    return groups;
  }, [displayedSpells, filters.sortBy]);

  const selectedSpell: Spell | null = useMemo(() => {
    if (selectedSpellId !== null) {
      const exact = allSpellsMap.get(selectedSpellId);
      if (exact) return exact;
    }
    return filteredSpells[0] ?? null;
  }, [selectedSpellId, allSpellsMap, filteredSpells]);

  const playerClassIds = useMemo(() => {
    if (!playerProfile?.charClass) return [];
    return extractPlayerCanonicalClasses(playerProfile.charClass)
      .map((c) => CANONICAL_TO_DNDSU_CLASS_ID[c])
      .filter((n): n is number => Boolean(n));
  }, [playerProfile]);

  const activeFilterCount = useMemo(() => countActiveFilterBadges(filters), [filters]);

  const isMyClassActive =
    playerClassIds.length > 0 &&
    playerClassIds.every((id) => filters.classes.includes(id)) &&
    filters.classes.length === playerClassIds.length;

  const toggleMyClassFilter = () => {
    if (playerClassIds.length === 0) return;
    setFilters((f) => ({
      ...f,
      classes: isMyClassActive ? [] : playerClassIds,
    }));
  };

  const resetFilters = () => {
    setFilters((prev) => ({
      ...INITIAL_DNDSU_FILTERS,
      sortBy: prev.sortBy,
    }));
  };

  const isCurrentCategoryLoading =
    (category === 'official' && loadingOfficial) ||
    ((category === 'homebrew' || category === 'all') && loadingHomebrew && homebrewSpells.length === 0);

  return (
    <div className="space-y-6">
      {user?.role === 'dm' && <PlayerSwitcher />}

      {/* Quiet Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-medium text-2xl text-text">Заклинания</h1>
            <span className="font-mono text-xs text-muted tabular-nums">
              {officialCombined.length + homebrewCombined.length} в базе dnd.su
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            Официальные заклинания D&amp;D 5e и авторский каталог Homebrew
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isPlayer && playerProfile?.characterName ? (
            <div className="h-10 px-3.5 bg-surface border border-border text-xs flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-secondary">
                <span>Класс:</span>
                <strong className="font-medium text-text">
                  {formatCharacterClassesRu(playerProfile.charClass) || playerProfile.charClass}
                </strong>
                {extractPlayerCanonicalClasses(playerProfile.charClass).map((c) => {
                  const hb = DND_HOMEBREW_CLASS_BY_KEY[c];
                  if (!hb) return null;
                  return (
                    <a
                      key={hb.key}
                      href={hb.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`Открыть класс «${hb.labelRu}» на dnd.su`}
                      className="hud-keycap"
                    >
                      HB
                    </a>
                  );
                })}
              </span>
              <span className="text-muted">·</span>
              <span className="text-secondary">
                Изучено:{' '}
                <strong className="font-mono font-medium text-text tabular-nums">
                  {learnedRecords.length} из {playerProfile.maxSpells}
                </strong>
              </span>
            </div>
          ) : (
            user?.role === 'dm' && (
              <button
                type="button"
                onClick={() => setActiveTab('dm')}
                className="hud-btn-secondary h-10 px-4 text-xs inline-flex items-center gap-2"
              >
                <Crown className="w-4 h-4 text-muted" strokeWidth={1.5} />
                <span>Добавить заклинание</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <div className="relative z-30 glass-panel hud-cut p-4 space-y-4">
        {/* Category Switcher + View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 flex-wrap bg-bg border border-border p-1">
            <button
              type="button"
              onClick={() => setCategory('official')}
              className={`h-8 px-3 text-xs transition-colors inline-flex items-center gap-2 ${
                category === 'official'
                  ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-secondary hover:text-text'
              }`}
            >
              <span>Официальные</span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {loadingOfficial ? '…' : officialCombined.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategory('homebrew')}
              className={`h-8 px-3 text-xs transition-colors inline-flex items-center gap-2 ${
                category === 'homebrew'
                  ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-secondary hover:text-text'
              }`}
            >
              <span>Homebrew</span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {loadingHomebrew ? '…' : homebrewCombined.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`h-8 px-3 text-xs transition-colors inline-flex items-center gap-2 ${
                category === 'all'
                  ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-secondary hover:text-text'
              }`}
            >
              <span>Все</span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {loadingOfficial || loadingHomebrew
                  ? '…'
                  : officialCombined.length + homebrewCombined.length}
              </span>
            </button>

            {(isPlayer || user?.role === 'dm') && (
              <button
                type="button"
                onClick={() => setCategory('learned')}
                className={`h-8 px-3 text-xs transition-colors inline-flex items-center gap-2 ${
                  category === 'learned'
                    ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-secondary hover:text-text'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                <span>{user?.role === 'dm' ? `Изученные (игрок ${dmSelectedPlayerId})` : 'Изученные'}</span>
                <span className="font-mono text-xs text-muted tabular-nums">
                  {learnedRecords.length}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {playerClassIds.length > 0 && (
              <button
                type="button"
                onClick={toggleMyClassFilter}
                className={`h-8 px-3 border text-xs inline-flex items-center gap-1.5 transition-colors ${
                  isMyClassActive
                    ? 'bg-raised border-primary/50 text-text font-medium'
                    : 'bg-bg border-border text-secondary hover:text-text'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                <span>Только мой класс</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLegendOpen((v) => !v)}
              className={`h-8 px-3 border text-xs inline-flex items-center gap-1.5 transition-colors ${
                legendOpen
                  ? 'bg-raised border-primary/50 text-text font-medium'
                  : 'bg-bg border-border text-secondary hover:text-text'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              <span>Обозначения</span>
            </button>

            <div className="inline-flex border border-border bg-bg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`h-7 px-2.5 text-xs inline-flex items-center gap-1.5 transition-colors ${
                  viewMode === 'split' ? 'bg-raised text-text font-medium' : 'text-muted hover:text-text'
                }`}
                title="Список + карточка"
              >
                <List className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Справочник</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`h-7 px-2.5 text-xs inline-flex items-center gap-1.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-raised text-text font-medium' : 'text-muted hover:text-text'
                }`}
                title="Сетка карточек"
              >
                <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Карточки</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Legend */}
        {legendOpen && (
          <div className="p-4 bg-bg border border-border space-y-3 text-xs">
            <div className="font-medium text-text">Условные обозначения:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-secondary">
              <div className="flex items-center gap-2">
                <span className="hud-keycap">[2]</span>
                <span>круг заклинания ([0] — заговор)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hud-keycap">ВСМ</span>
                <span>Вербальный, Соматический, Материальный</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hud-keycap">К</span>
                <span>требуется Концентрация</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hud-keycap">Р</span>
                <span>можно накладывать как Ритуал</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <span className="text-muted">Школы магии:</span>
              {SCHOOL_META_LIST.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs text-secondary bg-surface border border-border"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.ru}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            <div className="lg:col-span-4 relative flex items-center">
              <Search
                className="w-4 h-4 text-muted absolute left-3 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Поиск по названию"
                className="w-full h-9 bg-bg border border-border focus:border-primary/60 pl-9 pr-24 text-xs text-text focus:outline-none"
              />
              <label
                className="absolute right-2.5 inline-flex items-center gap-1.5 text-xs text-muted hover:text-text cursor-pointer select-none"
                title="Искать также внутри текста описания"
              >
                <input
                  type="checkbox"
                  checked={filters.searchInText}
                  onChange={(e) => setFilters((f) => ({ ...f, searchInText: e.target.checked }))}
                />
                <span>в тексте</span>
              </label>
            </div>

            <div className="lg:col-span-2">
              <DndsuMultiSelect<number>
                placeholder="Уровень"
                groups={activeCategoryFilters?.level || []}
                selected={filters.levels}
                onChange={(levels) => setFilters((f) => ({ ...f, levels }))}
                allowSelectAll
              />
            </div>

            <div className="lg:col-span-2">
              <DndsuMultiSelect<number>
                placeholder="Класс"
                groups={activeCategoryFilters?.class || []}
                selected={filters.classes}
                onChange={(classes) => setFilters((f) => ({ ...f, classes }))}
                allowSelectAll
              />
            </div>

            <div className="lg:col-span-2">
              <DndsuMultiSelect<number>
                placeholder="Школа"
                groups={activeCategoryFilters?.school || []}
                selected={filters.schools}
                onChange={(schools) => setFilters((f) => ({ ...f, schools }))}
                allowSelectAll
              />
            </div>

            <div className="lg:col-span-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMoreFiltersOpen((v) => !v)}
                className={`flex-1 h-9 px-2.5 border text-xs inline-flex items-center justify-center gap-1.5 transition-colors ${
                  moreFiltersOpen || activeFilterCount > 0
                    ? 'bg-raised border-primary/50 text-text font-medium'
                    : 'bg-bg border-border text-secondary hover:text-text'
                }`}
                title="Больше фильтров"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                <span>Фильтры</span>
                {activeFilterCount > 0 && (
                  <span className="hud-keycap">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted transition-transform ${moreFiltersOpen ? 'rotate-180' : ''}`}
                  strokeWidth={1.5}
                />
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Сбросить все фильтры"
                  className="w-9 h-9 border border-border bg-bg text-muted hover:text-negative flex items-center justify-center transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Advanced Filter Row */}
          {moreFiltersOpen && activeCategoryFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-border">
              <DndsuMultiSelect<number>
                placeholder="Подкласс"
                groups={activeCategoryFilters.archetype || []}
                selected={filters.archetypes}
                onChange={(archetypes) => setFilters((f) => ({ ...f, archetypes }))}
                allowSelectAll
              />

              <DndsuMultiSelect<number>
                placeholder="Источник"
                groups={activeCategoryFilters.source || []}
                selected={filters.sources}
                onChange={(sources) => setFilters((f) => ({ ...f, sources }))}
                allowSelectAll
              />

              <DndsuMultiSelect<number>
                placeholder="Концентрация"
                groups={activeCategoryFilters.concentration || []}
                selected={filters.concentration !== null ? [filters.concentration] : []}
                onChange={(vals) =>
                  setFilters((f) => ({ ...f, concentration: vals[0] ?? null }))
                }
                single
              />

              <DndsuMultiSelect<number>
                placeholder="Ритуал"
                groups={activeCategoryFilters.ritual || []}
                selected={filters.ritual !== null ? [filters.ritual] : []}
                onChange={(vals) => setFilters((f) => ({ ...f, ritual: vals[0] ?? null }))}
                single
              />

              <DndsuMultiSelect<string>
                placeholder="Компоненты"
                groups={activeCategoryFilters.components || []}
                selected={filters.components}
                onChange={(components) => setFilters((f) => ({ ...f, components }))}
              />

              <DndsuMultiSelect<string>
                placeholder="Время накладывания"
                groups={activeCategoryFilters.casttime || []}
                selected={filters.casttime !== null ? [filters.casttime] : []}
                onChange={(vals) => setFilters((f) => ({ ...f, casttime: vals[0] ?? null }))}
                single
              />

              <DndsuMultiSelect<number>
                placeholder="Наносимый урон"
                groups={activeCategoryFilters.damtype || []}
                selected={filters.damtypes}
                onChange={(damtypes) => setFilters((f) => ({ ...f, damtypes }))}
                allowSelectAll
              />

              <label
                className="h-9 flex items-center gap-2 px-3 bg-bg border border-border hover:border-text/20 text-xs cursor-pointer select-none"
                title="Исключить из выборки заклинания, добавленные классам в Tasha's Cauldron of Everything"
              >
                <input
                  type="checkbox"
                  checked={filters.disableTasha}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, disableTasha: e.target.checked }))
                  }
                />
                <span className="text-secondary hover:text-text">Исключить TCE</span>
              </label>
            </div>
          )}

          {/* Quick Level Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-xs text-muted mr-1">Круг:</span>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, levels: [] }))}
              className={`h-8 px-2.5 font-mono text-xs border transition-colors ${
                filters.levels.length === 0
                  ? 'bg-raised border-primary/60 text-text font-medium'
                  : 'bg-bg border-border text-secondary hover:text-text'
              }`}
            >
              Все
            </button>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
              const active = filters.levels.includes(lvl);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      levels: active
                        ? f.levels.filter((x) => x !== lvl)
                        : [...f.levels, lvl],
                    }))
                  }
                  className={`w-8 h-8 font-mono text-xs tabular-nums border transition-colors ${
                    active
                      ? 'bg-raised border-primary/60 text-text font-medium'
                      : 'bg-bg border-border text-secondary hover:text-text'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* Status & Sort Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs text-muted">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Найдено: <strong className="font-mono font-medium text-text tabular-nums">{filteredSpells.length}</strong>
                {filteredSpells.length !== baseSpells.length && ` из ${baseSpells.length}`}
              </span>
              {loadingHomebrew && (category === 'homebrew' || category === 'all') && (
                <span className="inline-flex items-center gap-1.5 text-secondary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                  <span>Загрузка Homebrew…</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span>Сортировка:</span>
              {(
                [
                  { id: 'title', label: 'Название' },
                  { id: 'level', label: 'Уровень' },
                  { id: 'school', label: 'Школа' },
                ] as Array<{ id: SpellSortMode; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, sortBy: opt.id }))}
                  className={`h-7 px-2.5 text-xs border transition-colors ${
                    filters.sortBy === opt.id
                      ? 'bg-raised text-text font-medium border-primary/50'
                      : 'border-transparent text-secondary hover:text-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loadError ? (
        <div className="glass-panel hud-cut p-8 text-center text-sm text-negative">
          {loadError}
        </div>
      ) : isCurrentCategoryLoading ? (
        <div className="glass-panel hud-cut p-12 flex flex-col items-center justify-center gap-3 text-sm text-muted">
          <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.5} />
          <span>Загрузка справочника заклинаний…</span>
        </div>
      ) : filteredSpells.length === 0 ? (
        <div className="glass-panel hud-cut p-8 text-center space-y-3">
          <div className="text-sm text-secondary">По выбранным фильтрам заклинаний не найдено</div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="hud-btn-secondary h-9 px-4 text-xs inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Сбросить фильтры</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {displayedSpells.map((sp) => (
              <SpellCard
                key={sp.id}
                spell={sp}
                highlighted={highlightedSpellId === sp.id}
                playerProfile={playerProfile}
                isLearned={learnedIdsSet.has(sp.id)}
                learnedCount={learnedRecords.length}
                onSelectSpellId={selectAndRevealSpell}
              />
            ))}
          </div>

          {displayedSpells.length < filteredSpells.length && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 60)}
                className="anime-btn-primary h-10 px-5 text-xs"
              >
                Загрузить ещё (показано {displayedSpells.length} из {filteredSpells.length})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Alphabetical / Level / School Grouped Index List */}
          <div className="lg:col-span-5 xl:col-span-5 glass-panel hud-cut overflow-hidden flex flex-col">
            {groupedSpells.length > 1 && (
              <div className="px-3 py-2 bg-deep border-b border-border flex items-center gap-1 overflow-x-auto">
                {groupedSpells.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`spell-group-${g.key}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className="h-7 px-2 text-xs font-mono text-secondary hover:text-text hover:bg-raised shrink-0 transition-colors"
                  >
                    {filters.sortBy === 'level' ? g.key.replace('lvl-', '') : g.title}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[75vh] overflow-y-auto divide-y divide-border">
              {groupedSpells.map((group) => (
                <div key={group.key} id={`spell-group-${group.key}`}>
                  <div className="sticky top-0 z-10 px-4 py-2 bg-deep border-b border-border text-xs font-medium text-secondary flex items-center justify-between">
                    <span>{group.title}</span>
                    <span className="font-mono text-xs text-muted tabular-nums">{group.items.length}</span>
                  </div>

                  <div className="divide-y divide-border">
                    {group.items.map((sp) => {
                      const school = getSchoolMeta(sp.school);
                      const compBadge = getSpellDisplayBadge(sp);
                      const isSelected = selectedSpell?.id === sp.id;
                      const isLearned = learnedIdsSet.has(sp.id);

                      return (
                        <button
                          key={sp.id}
                          id={`spell-row-${sp.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedSpellId(sp.id);
                            if (window.innerWidth < 1024) {
                              setMobileDrawerOpen(true);
                            }
                          }}
                          className={`w-full px-4 py-2 text-left flex items-center justify-between gap-2 transition-colors border-l-2 ${
                            isSelected
                              ? 'bg-raised text-text font-medium border-l-primary'
                              : 'hover:bg-raised/60 text-text border-l-transparent'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className="font-mono text-xs text-muted w-6 shrink-0 tabular-nums"
                              title={sp.level === 0 ? 'Заговор' : `${sp.level} круг`}
                            >
                              [{sp.level}]
                            </span>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: school.color }}
                              title={school.ru}
                            />
                            <span className="text-sm truncate">{sp.name}</span>
                            {isLearned && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-positive shrink-0"
                                title="Изучено героем"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-mono text-xs text-muted">
                            {sp.isHomebrew && category === 'all' && (
                              <span className="text-secondary">HB</span>
                            )}
                            {sp.concentration && (
                              <span title="Концентрация">К</span>
                            )}
                            {sp.ritual && (
                              <span title="Ритуал">Р</span>
                            )}
                            <span
                              className="w-8 text-right"
                              title={`Компоненты: ${sp.components || 'нет'}`}
                            >
                              {compBadge}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {displayedSpells.length < filteredSpells.length && (
                <div className="p-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((v) => v + 500)}
                    className="anime-btn-primary h-9 px-4 text-xs"
                  >
                    Загрузить ещё (+500)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleLimit(filteredSpells.length)}
                    className="hud-btn-secondary h-9 px-4 text-xs"
                  >
                    Полный список ({filteredSpells.length})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Sticky Spell Card Reader (Desktop) */}
          <div className="hidden lg:block lg:col-span-7 xl:col-span-7 lg:sticky lg:top-6 max-h-[84vh] overflow-y-auto pr-1">
            {selectedSpell ? (
              <SpellCard
                spell={selectedSpell}
                highlighted={highlightedSpellId === selectedSpell.id}
                playerProfile={playerProfile}
                isLearned={learnedIdsSet.has(selectedSpell.id)}
                learnedCount={learnedRecords.length}
                onSelectSpellId={selectAndRevealSpell}
              />
            ) : (
              <div className="glass-panel hud-cut p-8 text-center text-sm text-muted">
                Выберите заклинание из списка слева
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Spell Card Modal (< lg) */}
      {mobileDrawerOpen && selectedSpell && viewMode === 'split' && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[88vh] overflow-y-auto"
          >
            <SpellCard
              spell={selectedSpell}
              highlighted={highlightedSpellId === selectedSpell.id}
              playerProfile={playerProfile}
              isLearned={learnedIdsSet.has(selectedSpell.id)}
              learnedCount={learnedRecords.length}
              onSelectSpellId={selectAndRevealSpell}
              onClose={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
