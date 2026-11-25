import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
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
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'grid'>('split');
  const [selectedSpellId, setSelectedSpellId] = useState<number | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(600);

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

  // Load official spells + filters immediately, then prefetch homebrew catalog right after
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

        // Load all 2,084 homebrew spells from static asset
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

  // Reset pagination cap when switching category or filters
  useEffect(() => {
    setVisibleLimit(category === 'official' ? 600 : 500);
  }, [category, filters]);

  const allSpellsMap = useMemo(() => {
    const map = new Map<number, Spell>();
    for (const s of officialSpells) map.set(s.id, s);
    for (const s of homebrewSpells) map.set(s.id, s);
    for (const s of customDmSpells) map.set(s.id, s);
    return map;
  }, [officialSpells, homebrewSpells, customDmSpells]);

  // Handle jumpToSpellInCatalog(spellId) from Tab 1 CharacterPage or internal card links
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
    () => filterAndSortDndsuSpells(baseSpells, filters),
    [baseSpells, filters]
  );

  const displayedSpells = useMemo(
    () => filteredSpells.slice(0, viewMode === 'grid' ? Math.min(visibleLimit, 60) : visibleLimit),
    [filteredSpells, visibleLimit, viewMode]
  );

  // Group displayed spells just like dnd.su (Alphabetical А..Я / Level 0..9 / School)
  const groupedSpells = useMemo(() => {
    const groups: Array<{ key: string; title: string; items: Spell[] }> = [];
    const map = new Map<string, { key: string; title: string; items: Spell[] }>();

    for (const sp of displayedSpells) {
      let key: string;
      let title: string;
      if (filters.sortBy === 'level') {
        key = `lvl-${sp.level}`;
        title = sp.level === 0 ? 'Заговоры (0 уровень)' : `${sp.level} уровень`;
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

  // Keep selectedSpellId pointing to a valid spell
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
    <div className="space-y-4">
      {/* Top dnd.su Header + Category Tabs (Официальные / Homebrew / Все / Изученные) */}
      <div className="relative z-30 glass-panel rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-anime font-extrabold text-lg sm:text-xl flex items-center gap-2 flex-wrap">
                <span>Заклинания D&amp;D 5e</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-lg bg-bg/70 border border-border text-muted">
                  База dnd.su • {officialCombined.length + homebrewCombined.length} заклинаний
                </span>
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Полный каталог официальных заклинаний и Homebrew с dnd.su с оригинальной разметкой и фильтрами
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isPlayer && playerProfile?.characterName ? (
              <div className="px-3.5 py-2 rounded-2xl bg-bg/75 border border-primary/40 text-xs flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span>Класс:</span>
                  <strong className="text-accent">
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
                        title={`Открыть Homebrew-класс «${hb.labelRu}» на dnd.su`}
                        className="px-1.5 py-0.2 rounded bg-purple-500/25 border border-purple-400/40 text-purple-200 text-[10px] font-bold hover:bg-purple-500/35"
                      >
                        HB ↗
                      </a>
                    );
                  })}
                </span>
                <span className="text-border">•</span>
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
                  Добавить заклинание (DM)
                </button>
              )
            )}
          </div>
        </div>

        {/* dnd.su Section Switcher Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setCategory('official')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 ${
                category === 'official'
                  ? 'anime-btn-primary'
                  : 'bg-bg/70 border border-border text-muted hover:text-text hover:border-primary/40'
              }`}
            >
              <span>Официальные</span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/25 text-[11px] font-mono">
                {loadingOfficial ? '…' : officialCombined.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategory('homebrew')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 ${
                category === 'homebrew'
                  ? 'anime-btn-primary'
                  : 'bg-bg/70 border border-border text-muted hover:text-text hover:border-primary/40'
              }`}
            >
              <span>Homebrew</span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/25 text-[11px] font-mono">
                {loadingHomebrew ? '…' : homebrewCombined.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 ${
                category === 'all'
                  ? 'anime-btn-primary'
                  : 'bg-bg/70 border border-border text-muted hover:text-text hover:border-primary/40'
              }`}
            >
              <span>Все</span>
              <span className="px-1.5 py-0.5 rounded-md bg-black/25 text-[11px] font-mono">
                {loadingOfficial || loadingHomebrew
                  ? '…'
                  : officialCombined.length + homebrewCombined.length}
              </span>
            </button>

            {isPlayer && (
              <button
                type="button"
                onClick={() => setCategory('learned')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 ${
                  category === 'learned'
                    ? 'anime-btn-primary'
                    : 'bg-bg/70 border border-border text-muted hover:text-text hover:border-accent/50'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span>Изученные</span>
                <span className="px-1.5 py-0.5 rounded-md bg-black/25 text-[11px] font-mono">
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
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                  isMyClassActive
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-bg/70 border-border text-muted hover:text-text hover:border-accent/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Только мой класс
              </button>
            )}

            <button
              type="button"
              onClick={() => setLegendOpen((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border text-xs inline-flex items-center gap-1.5 transition-colors ${
                legendOpen
                  ? 'bg-primary/20 border-primary/50 text-text'
                  : 'bg-bg/70 border-border text-muted hover:text-text'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              Обозначения
            </button>

            <div className="inline-flex rounded-xl border border-border bg-bg/70 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 transition-colors ${
                  viewMode === 'split' ? 'bg-primary/25 text-text font-semibold' : 'text-muted hover:text-text'
                }`}
                title="Режим справочника dnd.su (список + карточка)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Справочник</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 transition-colors ${
                  viewMode === 'grid' ? 'bg-primary/25 text-text font-semibold' : 'text-muted hover:text-text'
                }`}
                title="Сетка полных карточек"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Карточки</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible dnd.su Legend */}
        {legendOpen && (
          <div className="p-3.5 rounded-2xl bg-bg/70 border border-border space-y-2.5 text-xs">
            <div className="font-bold text-text/90">Условные обозначения (как на dnd.su):</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-muted">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/15">
                  [2]
                </span>
                <span>— уровень заклинания ([0] — заговор)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-text px-1.5 py-0.5 rounded bg-surface border border-border">
                  ВСМ
                </span>
                <span>— Вербальный, Соматический, Материальный («.» — не нужен)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  К
                </span>
                <span>— требуется Концентрация</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  Р
                </span>
                <span>— можно сотворить как Ритуал</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
              <span className="text-muted">Школы магии:</span>
              {SCHOOL_META_LIST.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium"
                  style={{ backgroundColor: s.bg, color: s.color }}
                >
                  <span>{s.glyph}</span>
                  <span>{s.ru}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* dnd.su Filter Controls */}
        <div className="space-y-2.5 pt-1 border-t border-border/60">
          {/* Primary Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            <div className="lg:col-span-4 relative flex items-center">
              <Search className="w-4 h-4 text-muted absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Поиск по разделу (рус. / англ. название)..."
                className="w-full bg-bg/75 border border-border focus:border-primary rounded-xl pl-9 pr-24 py-2 text-xs text-text focus:outline-none"
              />
              <label
                className="absolute right-2.5 inline-flex items-center gap-1 text-[10px] text-muted hover:text-text cursor-pointer select-none"
                title="Искать также внутри текста описания заклинаний"
              >
                <input
                  type="checkbox"
                  checked={filters.searchInText}
                  onChange={(e) => setFilters((f) => ({ ...f, searchInText: e.target.checked }))}
                  className="accent-purple-500 rounded"
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
                className={`flex-1 px-2.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                  moreFiltersOpen || activeFilterCount > 0
                    ? 'bg-primary/15 border-primary/50 text-text'
                    : 'bg-bg/75 border-border text-muted hover:text-text'
                }`}
                title="Больше фильтров (Подкласс, Источник, Компоненты, Время, Урон, TCE)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                <span>Фильтры</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${moreFiltersOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Сбросить все фильтры"
                  className="p-2 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Advanced dnd.su Filter Row */}
          {moreFiltersOpen && activeCategoryFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-border/50">
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg/75 border border-border hover:border-primary/40 text-xs cursor-pointer select-none"
                title="Исключить из выборки заклинания, добавленные классам в Tasha's Cauldron of Everything"
              >
                <input
                  type="checkbox"
                  checked={filters.disableTasha}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, disableTasha: e.target.checked }))
                  }
                  className="accent-purple-500 rounded"
                />
                <span className="text-muted hover:text-text">Исключить TCE</span>
              </label>
            </div>
          )}

          {/* Status & Sort Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Найдено: <strong className="text-text">{filteredSpells.length}</strong>
                {filteredSpells.length !== baseSpells.length && ` из ${baseSpells.length}`}
              </span>
              {loadingHomebrew && (category === 'homebrew' || category === 'all') && (
                <span className="inline-flex items-center gap-1 text-accent">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Загрузка Homebrew...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    filters.sortBy === opt.id
                      ? 'bg-primary/20 text-primary font-bold border border-primary/40'
                      : 'hover:text-text'
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
        <div className="glass-panel rounded-3xl p-8 text-center text-sm text-rose-300">
          {loadError}
        </div>
      ) : isCurrentCategoryLoading ? (
        <div className="glass-panel rounded-3xl p-12 flex flex-col items-center justify-center gap-3 text-sm text-muted">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <span>Загрузка справочника заклинаний dnd.su...</span>
        </div>
      ) : filteredSpells.length === 0 ? (
        <div className="glass-panel rounded-3xl p-8 text-center space-y-3">
          <div className="text-sm text-muted">Нет совпадений по выбранным фильтрам.</div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="anime-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Full Cards Grid Mode */
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
                className="anime-btn-primary px-5 py-2.5 text-xs"
              >
                Загрузить ещё (показано {displayedSpells.length} из {filteredSpells.length})
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Authentic dnd.su Reference Split View: Alphabetical Index List + Sticky Spell Card */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Alphabetical / Level / School Grouped Index List */}
          <div className="lg:col-span-5 xl:col-span-5 glass-panel rounded-3xl overflow-hidden flex flex-col">
            {/* Quick Group Jump Strip (А Б В Г...) */}
            {groupedSpells.length > 1 && (
              <div className="px-3 py-2 bg-bg/65 border-b border-border flex items-center gap-1 overflow-x-auto">
                {groupedSpells.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`spell-group-${g.key}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold text-muted hover:text-primary hover:bg-primary/15 shrink-0 transition-colors"
                  >
                    {filters.sortBy === 'level' ? g.key.replace('lvl-', '') : g.title}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[75vh] overflow-y-auto p-3 space-y-4">
              {groupedSpells.map((group) => (
                <div key={group.key} id={`spell-group-${group.key}`} className="space-y-1">
                  <div className="sticky top-0 z-10 px-2.5 py-1 rounded-lg bg-bg/90 backdrop-blur border-l-2 border-primary font-anime font-extrabold text-xs text-primary flex items-center justify-between">
                    <span>{group.title}</span>
                    <span className="text-[10px] font-mono text-muted">{group.items.length}</span>
                  </div>

                  <div className="divide-y divide-border/40">
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
                          className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-primary/20 text-text font-semibold ring-1 ring-primary/50'
                              : 'hover:bg-bg/65 text-text/90'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span
                              className="font-mono text-[11px] font-bold text-primary w-6 shrink-0"
                              title={sp.level === 0 ? 'Заговор' : `${sp.level} уровень`}
                            >
                              [{sp.level}]
                            </span>
                            <span
                              className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                              style={{ backgroundColor: school.bg, color: school.color }}
                              title={school.ru}
                            >
                              {school.glyph}
                            </span>
                            <span className="text-xs sm:text-[13px] truncate">{sp.name}</span>
                            {isLearned && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                title="Изучено персонажем"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {sp.isHomebrew && category === 'all' && (
                              <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                                HB
                              </span>
                            )}
                            {sp.concentration && (
                              <span
                                className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold"
                                title="Требуется концентрация"
                              >
                                К
                              </span>
                            )}
                            {sp.ritual && (
                              <span
                                className="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold"
                                title="Ритуал"
                              >
                                Р
                              </span>
                            )}
                            <span
                              className="font-mono text-[11px] text-muted w-7 text-right tracking-tight"
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
                <div className="pt-2 pb-1 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((v) => v + 500)}
                    className="anime-btn-primary px-4 py-2 text-xs"
                  >
                    Загрузить больше (+500)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleLimit(filteredSpells.length)}
                    className="px-3.5 py-2 rounded-xl border border-border bg-bg/70 text-xs text-muted hover:text-text"
                  >
                    Полный список ({filteredSpells.length})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Sticky dnd.su Spell Card Reader (Desktop) */}
          <div className="hidden lg:block lg:col-span-7 xl:col-span-7 lg:sticky lg:top-20 max-h-[82vh] overflow-y-auto pr-1">
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
              <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted">
                Выберите заклинание из списка слева, чтобы открыть его карточку.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Slide-Up Spell Card Modal (< lg) */}
      {mobileDrawerOpen && selectedSpell && viewMode === 'split' && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4"
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
