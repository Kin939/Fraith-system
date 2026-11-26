import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { BestiaryDetail } from '../components/bestiary/BestiaryDetail';
import { BestiaryTile } from '../components/bestiary/BestiaryTile';
import { apiFetch } from '../lib/api';
import {
  DNDSU_CATALOG_TOTAL,
  fetchBestiaryImportStatus,
  importDndsuBestiary,
  type BestiaryImportProgress,
} from '../lib/bestiaryImport';
import { useCampaignStore } from '../lib/store';
import type { BestiaryCreature, BestiaryImportStatus } from '../lib/types';

const PAGE_SIZE = 48;

type CrBucket = 'all' | '0' | 'low' | 'mid' | 'high' | 'very-high' | 'legendary';
type RevealFilter = 'all' | 'revealed' | 'hidden';

const CR_BUCKETS: Array<{ id: CrBucket; label: string; test: (cr: number) => boolean }> = [
  { id: 'all', label: 'Любая опасность', test: () => true },
  { id: '0', label: 'CR 0 / —', test: (cr) => cr <= 0 },
  { id: 'low', label: 'CR 1/8 – 1', test: (cr) => cr > 0 && cr <= 1 },
  { id: 'mid', label: 'CR 2 – 4', test: (cr) => cr > 1 && cr <= 4 },
  { id: 'high', label: 'CR 5 – 8', test: (cr) => cr > 4 && cr <= 8 },
  { id: 'very-high', label: 'CR 9 – 16', test: (cr) => cr > 8 && cr <= 16 },
  { id: 'legendary', label: 'CR 17+', test: (cr) => cr > 16 },
];

function baseType(creature: BestiaryCreature): string {
  return creature.creatureType.split(' (')[0].trim();
}

export const BestiaryPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const creatures = useCampaignStore((s) => s.bestiary);
  const setBestiary = useCampaignStore((s) => s.setBestiary);
  const refreshBestiary = useCampaignStore((s) => s.refreshBestiary);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [selectedCreature, setSelectedCreature] = useState<BestiaryCreature | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [crFilter, setCrFilter] = useState<CrBucket>('all');
  const [revealFilter, setRevealFilter] = useState<RevealFilter>('all');
  const [sortMode, setSortMode] = useState<'cr' | 'name'>('cr');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [importStatus, setImportStatus] = useState<BestiaryImportStatus | null>(null);
  const [importProgress, setImportProgress] = useState<BestiaryImportProgress | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const autoImportStartedRef = useRef(false);

  const isDm = user?.role === 'dm';
  const revealedCount = creatures.filter((c) => c.isRevealed).length;

  const runImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    setImportError(null);
    setImportProgress({ done: 0, total: DNDSU_CATALOG_TOTAL, imported: 0 });
    const controller = new AbortController();
    importAbortRef.current = controller;
    try {
      const res = await importDndsuBestiary(setImportProgress, controller.signal);
      await refreshBestiary();
      const status = await fetchBestiaryImportStatus();
      setImportStatus(status);
      pushToast({
        title: controller.signal.aborted ? 'Импорт остановлен' : 'Бестиарий dnd.su загружен',
        message: controller.signal.aborted
          ? `Успели добавить ${res.imported} существ — можно продолжить позже`
          : `${res.imported} существ добавлены и скрыты от игроков`,
        variant: controller.signal.aborted ? 'info' : 'success',
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Не удалось импортировать каталог');
      pushToast({
        title: 'Импорт бестиария прерван',
        message: 'Каталог можно догрузить кнопкой «Продолжить импорт»',
        variant: 'error',
      });
    } finally {
      importAbortRef.current = null;
      setImporting(false);
      setImportProgress(null);
    }
  }, [importing, pushToast, refreshBestiary]);

  // DM-only catalog status; the first visit seeds the whole dnd.su compendium
  useEffect(() => {
    if (!isDm) return;
    let cancelled = false;
    fetchBestiaryImportStatus()
      .then((status) => {
        if (!cancelled) setImportStatus(status);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDm]);

  useEffect(() => {
    if (!isDm || !importStatus || importing) return;
    if (importStatus.compendium > 0 || autoImportStartedRef.current) return;
    autoImportStartedRef.current = true;
    void runImport();
  }, [isDm, importStatus, importing, runImport]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, typeFilter, crFilter, revealFilter, sortMode]);

  const typeOptions = useMemo(() => {
    const unique = new Set<string>();
    creatures.forEach((c) => {
      const value = baseType(c);
      if (value) unique.add(value);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [creatures]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const bucket = CR_BUCKETS.find((b) => b.id === crFilter) ?? CR_BUCKETS[0];

    const list = creatures.filter((c) => {
      if (typeFilter !== 'all' && baseType(c) !== typeFilter) return false;
      if (!bucket.test(c.crNumeric)) return false;
      if (isDm) {
        if (revealFilter === 'revealed' && !c.isRevealed) return false;
        if (revealFilter === 'hidden' && c.isRevealed) return false;
      }
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.nameEn.toLowerCase().includes(needle) ||
        c.creatureType.toLowerCase().includes(needle) ||
        c.sourceTitle.toLowerCase().includes(needle)
      );
    });

    if (sortMode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    return list;
  }, [creatures, crFilter, isDm, query, revealFilter, sortMode, typeFilter]);

  const visible = filtered.slice(0, visibleCount);
  const filtersActive =
    Boolean(query.trim()) || typeFilter !== 'all' || crFilter !== 'all' || revealFilter !== 'all';

  const handleToggleReveal = async (creature: BestiaryCreature) => {
    if (!isDm) return;
    const nextRevealed = !creature.isRevealed;
    try {
      await apiFetch<{ id: number; isRevealed: boolean }>(
        `/api/dm/bestiary/${creature.id}/reveal`,
        { method: 'PATCH', body: JSON.stringify({ isRevealed: nextRevealed }) }
      );
      setBestiary(
        useCampaignStore
          .getState()
          .bestiary.map((c) => (c.id === creature.id ? { ...c, isRevealed: nextRevealed } : c))
      );
      setSelectedCreature((prev) =>
        prev && prev.id === creature.id ? { ...prev, isRevealed: nextRevealed } : prev
      );
      pushToast({
        title: nextRevealed ? `«${creature.name}» открыт игрокам` : `«${creature.name}» скрыт`,
        message: 'Бестиарий обновлён у всех участников за столом',
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось изменить видимость',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-medium text-2xl text-text">Бестиарий</h1>
            <span className="font-mono text-xs text-muted tabular-nums">
              Открыто {revealedCount} из {creatures.length}
            </span>
            {isDm && importStatus && (
              <span className="font-mono text-xs text-muted tabular-nums">
                · каталог dnd.su: {importStatus.compendium}
              </span>
            )}
          </div>
          <p className="text-sm text-secondary mt-1">
            {isDm
              ? 'Все существа dnd.su уже здесь — откройте игрокам тех, с кем столкнулся отряд'
              : 'Существа и противники, с которыми столкнулся отряд'}
          </p>
        </div>

        {isDm && (
          <button
            type="button"
            onClick={() => setActiveTab('dm')}
            className="hud-btn-secondary h-10 px-4 text-xs inline-flex items-center gap-2"
          >
            <Crown className="w-4 h-4 text-muted" strokeWidth={1.5} />
            <span>Редактор бестиария</span>
          </button>
        )}
      </div>

      {/* dnd.su compendium import state (DM only) */}
      {isDm &&
        (importing ||
          importError ||
          (importStatus && importStatus.compendium < DNDSU_CATALOG_TOTAL)) && (
        <div className="glass-panel hud-cut p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-text inline-flex items-center gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin text-muted" strokeWidth={1.5} />}
              <span>
                {importing
                  ? 'Загружаем бестиарий dnd.su…'
                  : importError
                    ? 'Импорт каталога dnd.su не завершён'
                    : importStatus && importStatus.compendium > 0
                      ? `Каталог dnd.su загружен не полностью (${importStatus.compendium} из ${DNDSU_CATALOG_TOTAL})`
                      : 'Каталог dnd.su ещё не загружен'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {importing ? (
                <button
                  type="button"
                  onClick={() => importAbortRef.current?.abort()}
                  className="hud-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Остановить</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void runImport()}
                  className="anime-btn-primary h-8 px-3 text-xs"
                >
                  {importStatus && importStatus.compendium > 0
                    ? 'Продолжить импорт'
                    : 'Загрузить каталог'}
                </button>
              )}
            </div>
          </div>

          {importing && importProgress && (
            <div className="space-y-1.5">
              <div className="h-1.5 bg-bg border border-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{
                    width: `${Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-muted font-mono tabular-nums">
                {importProgress.done} / {importProgress.total} · добавлено {importProgress.imported}
              </div>
            </div>
          )}

          {importError && <div className="text-xs text-negative">{importError}</div>}

          {!importing && !importError && (
            <div className="text-xs text-muted">
              Монстры попадут в бестиарий скрытыми — игроки увидят только тех, кого вы откроете.
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel hud-cut p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, типу или источнику…"
            className="anime-input w-full h-9 pl-9 text-sm"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="anime-input h-9 px-2 text-xs min-w-[150px]"
        >
          <option value="all">Все типы</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={crFilter}
          onChange={(e) => setCrFilter(e.target.value as CrBucket)}
          className="anime-input h-9 px-2 text-xs min-w-[140px]"
        >
          {CR_BUCKETS.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.label}
            </option>
          ))}
        </select>

        {isDm && (
          <select
            value={revealFilter}
            onChange={(e) => setRevealFilter(e.target.value as RevealFilter)}
            className="anime-input h-9 px-2 text-xs min-w-[130px]"
          >
            <option value="all">Все видимости</option>
            <option value="revealed">Открытые</option>
            <option value="hidden">Скрытые</option>
          </select>
        )}

        <button
          type="button"
          onClick={() => setSortMode((prev) => (prev === 'cr' ? 'name' : 'cr'))}
          className="hud-btn-secondary h-9 px-3 text-xs inline-flex items-center gap-1.5"
          title="Переключить сортировку"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
          <span>{sortMode === 'cr' ? 'По опасности' : 'По имени'}</span>
        </button>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setTypeFilter('all');
              setCrFilter('all');
              setRevealFilter('all');
            }}
            className="h-9 px-3 text-xs text-muted hover:text-text inline-flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Сбросить</span>
          </button>
        )}
      </div>

      <div className="text-xs text-muted font-mono tabular-nums">
        Найдено {filtered.length} · показано {visible.length}
      </div>

      {visible.length === 0 ? (
        <div className="glass-panel hud-cut p-8 text-center text-sm text-muted">
          {creatures.length === 0
            ? 'Бестиарий пуст. Мастер может добавить существ или загрузить каталог dnd.su.'
            : 'Ничего не найдено — попробуйте изменить фильтры.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((creature) => (
            <BestiaryTile
              key={creature.id}
              creature={creature}
              isDm={Boolean(isDm)}
              onSelect={setSelectedCreature}
              onToggleReveal={isDm ? handleToggleReveal : undefined}
            />
          ))}
        </div>
      )}

      {filtered.length > visible.length && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="hud-btn-secondary h-10 px-5 text-xs"
          >
            Показать ещё {Math.min(PAGE_SIZE, filtered.length - visible.length)}
          </button>
        </div>
      )}

      <BestiaryDetail
        creature={selectedCreature}
        isDm={Boolean(isDm)}
        onClose={() => setSelectedCreature(null)}
        onToggleReveal={isDm ? handleToggleReveal : undefined}
      />
    </div>
  );
};
