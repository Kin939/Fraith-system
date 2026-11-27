import { parseVisibleUserIds } from './db';
import type { LiteratureFile, LiteratureKind } from './types';

/**
 * Серверная часть вкладки «Литература»: таблица literature_files + проверки
 * видимости. Файлы лежат в R2, а без R2 — чанками в media_blobs (см. r2.ts).
 */

export interface LiteratureRow {
  id: number;
  title: string;
  description: string;
  file_key: string;
  file_name: string;
  mime_type: string;
  file_ext: string;
  file_size: number;
  kind: LiteratureKind;
  visible_user_ids: string;
  uploaded_by: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

/** Человекочитаемые расширения, которые умеем показывать прямо в браузере. */
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log', 'tsv', 'rtf']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp']);

export function detectLiteratureKind(ext: string, mime: string): LiteratureKind {
  const normalizedExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedMime = mime.toLowerCase();
  if (normalizedExt === 'pdf' || normalizedMime === 'application/pdf') return 'pdf';
  if (normalizedExt === 'docx' || normalizedMime.includes('wordprocessingml')) return 'docx';
  if (normalizedExt === 'doc' || normalizedMime === 'application/msword') return 'doc';
  if (IMAGE_EXTENSIONS.has(normalizedExt) || normalizedMime.startsWith('image/')) return 'image';
  if (TEXT_EXTENSIONS.has(normalizedExt) || normalizedMime.startsWith('text/')) return 'text';
  return 'other';
}

/** Валидация и нормализация списка id игроков из тела запроса. */
export function normalizeVisibleUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((value) => (typeof value === 'number' ? value : Number.parseInt(String(value), 10)))
    .filter((value) => Number.isFinite(value) && value > 0);
  return Array.from(new Set(ids)).sort((a, b) => a - b).slice(0, 50);
}

export function serializeVisibleUserIds(ids: number[]): string {
  return JSON.stringify(normalizeVisibleUserIds(ids));
}

function mapRow(row: LiteratureRow, canManage: boolean): LiteratureFile {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileExt: row.file_ext,
    fileSize: Number(row.file_size ?? 0),
    kind: row.kind,
    visibleUserIds: parseVisibleUserIds(row.visible_user_ids),
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    url: `/api/literature/${row.id}/file`,
    canManage,
  };
}

export async function listLiteratureFiles(
  db: D1Database,
  viewer: { userId: number; isDm: boolean }
): Promise<LiteratureFile[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM literature_files
       ORDER BY sort_order ASC, created_at DESC, id DESC`
    )
    .all<LiteratureRow>();

  const files = (results ?? []).map((row) => mapRow(row, viewer.isDm));
  if (viewer.isDm) return files;
  return files.filter(
    (file) => file.visibleUserIds.length === 0 || file.visibleUserIds.includes(viewer.userId)
  );
}

export async function getLiteratureRow(db: D1Database, id: number): Promise<LiteratureRow | null> {
  return (
    (await db
      .prepare(`SELECT * FROM literature_files WHERE id = ?`)
      .bind(id)
      .first<LiteratureRow>()) ?? null
  );
}

export async function canViewLiterature(
  db: D1Database,
  row: LiteratureRow,
  viewer: { userId: number; isDm: boolean }
): Promise<boolean> {
  if (viewer.isDm) return true;
  const visible = parseVisibleUserIds(row.visible_user_ids);
  return visible.length === 0 || visible.includes(viewer.userId);
}

export interface CreateLiteratureInput {
  title: string;
  description: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileExt: string;
  fileSize: number;
  kind: LiteratureKind;
  visibleUserIds: number[];
  uploadedBy: number;
}

export async function createLiteratureFile(
  db: D1Database,
  input: CreateLiteratureInput
): Promise<LiteratureFile> {
  const inserted = await db
    .prepare(
      `INSERT INTO literature_files
         (title, description, file_key, file_name, mime_type, file_ext, file_size, kind,
          visible_user_ids, uploaded_by, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    )
    .bind(
      input.title,
      input.description,
      input.fileKey,
      input.fileName,
      input.mimeType,
      input.fileExt,
      input.fileSize,
      input.kind,
      serializeVisibleUserIds(input.visibleUserIds),
      input.uploadedBy
    )
    .run();

  const id = Number(inserted.meta?.last_row_id ?? 0);
  const row = id ? await getLiteratureRow(db, id) : null;
  if (!row) throw new Error('Не удалось сохранить файл литературы');
  return mapRow(row, true);
}

export async function updateLiteratureFile(
  db: D1Database,
  id: number,
  patch: { title?: string; description?: string; visibleUserIds?: number[] }
): Promise<LiteratureFile | null> {
  const row = await getLiteratureRow(db, id);
  if (!row) return null;

  const title = patch.title !== undefined ? patch.title.trim().slice(0, 140) : row.title;
  const description =
    patch.description !== undefined ? patch.description.slice(0, 2000) : row.description;
  const visible =
    patch.visibleUserIds !== undefined
      ? serializeVisibleUserIds(patch.visibleUserIds)
      : row.visible_user_ids;

  await db
    .prepare(
      `UPDATE literature_files
         SET title = ?, description = ?, visible_user_ids = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(title, description, visible, id)
    .run();

  const updated = await getLiteratureRow(db, id);
  return updated ? mapRow(updated, true) : null;
}

export async function deleteLiteratureFile(db: D1Database, id: number): Promise<LiteratureRow | null> {
  const row = await getLiteratureRow(db, id);
  if (!row) return null;
  await db.prepare(`DELETE FROM literature_files WHERE id = ?`).bind(id).run();
  return row;
}

/** Размер в байтах для UI (1.4 МБ). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
