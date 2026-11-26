import { apiFetch } from './api';
import type { BestiaryImportStatus } from './types';

/** Shape of one record in /data/dndsu-bestiary.json (mirror of dnd.su) */
export interface DndsuCreatureRecord {
  key: string;
  dndsuId: number;
  name: string;
  nameEn: string;
  sourceTitle: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  hp: string;
  hpNum: number;
  speed: string;
  senses: string;
  languages: string;
  cr: string;
  crNumeric: number;
  xp: number;
  environment: string;
  statblock: string;
  url: string;
  imageUrl: string;
  imageFullUrl: string;
  gallery?: Array<{ u: string; t: string }>;
}

const CHUNK_SIZE = 120;

/** Size of the shipped dnd.su catalog (public/data/dndsu-bestiary.json) */
export const DNDSU_CATALOG_TOTAL = 2984;

let cachedRecords: DndsuCreatureRecord[] | null = null;

export async function loadDndsuBestiary(force = false): Promise<DndsuCreatureRecord[]> {
  if (cachedRecords && !force) return cachedRecords;
  const res = await fetch('/data/dndsu-bestiary.json', { credentials: 'omit' });
  if (!res.ok) throw new Error('Не удалось загрузить каталог бестиария dnd.su');
  const records = (await res.json()) as DndsuCreatureRecord[];
  cachedRecords = records;
  return records;
}

function toImportItem(record: DndsuCreatureRecord) {
  return {
    importKey: record.key,
    name: record.name,
    nameEn: record.nameEn,
    cr: record.cr,
    crNumeric: record.crNumeric,
    creatureType: record.type,
    size: record.size,
    alignment: record.alignment,
    ac: record.ac,
    hp: record.hp,
    xp: record.xp,
    imageUrl: record.imageUrl,
    imageFullUrl: record.imageFullUrl,
    gallery: (record.gallery ?? []).map((image) => ({ full: image.u, thumb: image.t })),
    speed: record.speed,
    senses: record.senses,
    languages: record.languages,
    sourceTitle: record.sourceTitle,
    sourceUrl: record.url,
    description: record.statblock,
  };
}

export async function fetchBestiaryImportStatus(): Promise<BestiaryImportStatus> {
  const res = await apiFetch<{ status: BestiaryImportStatus }>(
    '/api/dm/bestiary/import-status'
  );
  return res.status;
}

export interface BestiaryImportProgress {
  done: number;
  total: number;
  imported: number;
}

/**
 * Streams the whole dnd.su compendium into D1 in small batches. Every monster
 * lands hidden (`is_revealed = 0`) — the DM reveals them one by one later.
 * The endpoint is idempotent, so an interrupted import can simply be re-run.
 */
export async function importDndsuBestiary(
  onProgress?: (progress: BestiaryImportProgress) => void,
  signal?: AbortSignal
): Promise<{ imported: number; total: number }> {
  const records = await loadDndsuBestiary();
  let imported = 0;

  for (let offset = 0; offset < records.length; offset += CHUNK_SIZE) {
    if (signal?.aborted) break;
    const chunk = records.slice(offset, offset + CHUNK_SIZE).map(toImportItem);
    const res = await apiFetch<{ imported: number; status: BestiaryImportStatus }>(
      '/api/dm/bestiary/import',
      {
        method: 'POST',
        timeoutMs: 120000,
        signal,
        body: JSON.stringify({ items: chunk }),
      }
    );
    imported += res.imported;
    onProgress?.({
      done: Math.min(offset + chunk.length, records.length),
      total: records.length,
      imported,
    });
  }

  return { imported, total: records.length };
}
