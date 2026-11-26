import { apiFetch } from './api';

/** Общие типы вкладки «Доска» (клиент + UI). */

export type BoardPermission = 'read' | 'write';
export type BoardBackground = 'dots' | 'lines' | 'squares' | 'plain';
export type BoardFontPreset = 'classic' | 'modern';

export interface BoardSummary {
  id: string;
  name: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  background: BoardBackground;
  gridSize: number;
  /** Пресет шрифтов доски (кириллица + латиница) */
  fontPreset?: BoardFontPreset;
  /** Цвет фона холста ('' = цвет темы) */
  bgColor?: string;
  /** Может ли текущий пользователь переименовать/удалить/настроить доску */
  canEdit?: boolean;
  /** Право текущего пользователя на эту доску */
  permission: BoardPermission | null;
  /** Матрица доступа (только для Мастера) */
  access?: Array<{ userId: number; permission: BoardPermission }>;
}

export interface BoardMember {
  id: number;
  username: string;
  displayName: string;
  role: 'dm' | 'player';
  avatarUrl?: string | null;
}

export type BoardAccessMap = Record<number, BoardPermission | 'none'>;

export interface BoardAccessEntry {
  userId: number;
  displayName: string;
  username: string;
  role: 'dm' | 'player';
  permission: BoardPermission;
}

export interface BoardTemplateRecord {
  id: string;
  boardId: string | null;
  name: string;
  /** TLContent, сериализованный в JSON (выделение, сохранённое Мастером) */
  content: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  canDelete: boolean;
}

export interface BoardAccessPatch {
  userId: number;
  permission: BoardPermission | null;
}

export async function listBoards(): Promise<{
  boards: BoardSummary[];
  members: BoardMember[];
  canManage: boolean;
}> {
  return apiFetch('/api/boards');
}

export async function createBoard(input: {
  name: string;
  background?: BoardBackground;
  fontPreset?: BoardFontPreset;
  bgColor?: string;
  access?: BoardAccessPatch[];
}): Promise<{ board: BoardSummary; access: BoardAccessEntry[] }> {
  return apiFetch('/api/boards', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateBoard(
  boardId: string,
  input: {
    name?: string;
    background?: BoardBackground;
    fontPreset?: BoardFontPreset;
    bgColor?: string;
    access?: BoardAccessPatch[];
  }
): Promise<{ board: BoardSummary | null; access: BoardAccessEntry[] }> {
  return apiFetch(`/api/boards/${encodeURIComponent(boardId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteBoard(boardId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/boards/${encodeURIComponent(boardId)}`, { method: 'DELETE' });
}

export async function fetchBoardTemplates(
  boardId: string
): Promise<{ templates: BoardTemplateRecord[] }> {
  return apiFetch(`/api/boards/${encodeURIComponent(boardId)}/templates`);
}

export async function saveBoardTemplate(
  boardId: string,
  input: { name: string; content: string; scope?: 'global' | 'board' }
): Promise<{ template: BoardTemplateRecord }> {
  return apiFetch(`/api/boards/${encodeURIComponent(boardId)}/templates`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteBoardTemplate(boardId: string, templateId: string): Promise<{ ok: boolean }> {
  return apiFetch(
    `/api/boards/${encodeURIComponent(boardId)}/templates/${encodeURIComponent(templateId)}`,
    { method: 'DELETE' }
  );
}

/** Загрузка файла на холст: Worker кладёт объект в R2 (или в D1-фолбэк) и отдаёт ссылку. */
export async function uploadBoardFile(boardId: string, file: File): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/api/boards/${encodeURIComponent(boardId)}/upload`, {
    method: 'POST',
    body: form,
    timeoutMs: 60000,
  });
}
