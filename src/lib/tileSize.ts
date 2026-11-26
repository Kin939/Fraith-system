import { useCallback, useEffect, useState } from 'react';

export type TileSize = 'compact' | 'normal' | 'large' | 'huge';

export const TILE_SIZES: TileSize[] = ['compact', 'normal', 'large', 'huge'];

export const TILE_SIZE_META: Record<
  TileSize,
  { label: string; short: string; hint: string; nodePx: number; gridCols: string }
> = {
  compact: {
    label: 'Компактно',
    short: 'S',
    hint: 'Максимум плиток на экране',
    nodePx: 140,
    gridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3',
  },
  normal: {
    label: 'Обычно',
    short: 'M',
    hint: 'Сбалансированная плотность',
    nodePx: 176,
    gridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3',
  },
  large: {
    label: 'Крупно',
    short: 'L',
    hint: 'Больше текста и воздуха',
    nodePx: 212,
    gridCols: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2',
  },
  huge: {
    label: 'Огромно',
    short: 'XL',
    hint: 'По одной плитке в ряд',
    nodePx: 248,
    gridCols: 'grid-cols-1',
  },
};

const STORAGE_PREFIX = 'fraith.tile-size.';
const CHANGE_EVENT = 'fraith:tile-size-changed';

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

export function isTileSize(value: unknown): value is TileSize {
  return typeof value === 'string' && (TILE_SIZES as string[]).includes(value);
}

export function readTileSize(scope: string, fallback: TileSize = 'normal'): TileSize {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    return isTileSize(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function writeTileSize(scope: string, size: TileSize): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(scope), size);
  } catch {
    // storage may be unavailable (private mode) — the in-memory state still works
  }
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: { scope, size } })
  );
}

/**
 * Per-user tile density preference persisted in localStorage and synced between
 * every mounted control (quests list, talent tree, talents grid).
 */
export function useTileSize(
  scope: string,
  fallback: TileSize = 'normal'
): [TileSize, (size: TileSize) => void] {
  const [size, setSize] = useState<TileSize>(() => readTileSize(scope, fallback));

  useEffect(() => {
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ scope: string; size: TileSize }>).detail;
      if (detail?.scope === scope) setSize(detail.size);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey(scope)) return;
      setSize(isTileSize(event.newValue) ? event.newValue : fallback);
    };
    window.addEventListener(CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [scope, fallback]);

  const update = useCallback(
    (next: TileSize) => {
      setSize(next);
      writeTileSize(scope, next);
    },
    [scope]
  );

  return [size, update];
}

export function tileNodePx(size: TileSize): number {
  return TILE_SIZE_META[size].nodePx;
}

export function tileGridCols(size: TileSize): string {
  return TILE_SIZE_META[size].gridCols;
}

/** Compact tiles hide the description block to fit more cards on screen. */
export function isCompactTileSize(size: TileSize): boolean {
  return size === 'compact';
}
