export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const timeoutMs = init?.timeoutMs ?? 15000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      credentials: 'include',
      signal: init?.signal ?? ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        'Превышено время ожидания ответа сервера Cloudflare. Если вы в РФ без VPN/Zapret, провайдер может ограничивать соединение с Cloudflare (16 КБ ТСПУ).',
        408
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) message = errBody.error;
    } catch {
      // fallback message
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export async function uploadImageAsset(
  file: File,
  folder: 'quests' | 'bestiary' | 'talents' | 'avatars' | 'npcs'
): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);

  return apiFetch<{ key: string; url: string }>('/api/dm/upload', {
    method: 'POST',
    body: fd,
  });
}

export async function uploadChatAttachment(
  file: File
): Promise<{
  attachment: import('./types').ChatAttachment;
}> {
  const fd = new FormData();
  fd.append('file', file);

  return apiFetch<{ attachment: import('./types').ChatAttachment }>('/api/chat/upload', {
    method: 'POST',
    body: fd,
    timeoutMs: 30000,
  });
}

export async function uploadPlayerAvatar(
  file: File,
  playerId?: number | null
): Promise<{ avatarUrl: string; url: string; key: string; userId: number }> {
  const fd = new FormData();
  fd.append('file', file);
  if (playerId) fd.append('playerId', String(playerId));

  return apiFetch<{ avatarUrl: string; url: string; key: string; userId: number }>(
    '/api/profile/avatar',
    { method: 'POST', body: fd, timeoutMs: 30000 }
  );
}

export async function deletePlayerAvatar(
  playerId?: number | null
): Promise<{ ok: boolean; userId: number }> {
  const query = playerId ? `?playerId=${playerId}` : '';
  return apiFetch<{ ok: boolean; userId: number }>(`/api/profile/avatar${query}`, {
    method: 'DELETE',
  });
}

export async function patchQuestTile(
  questId: number,
  patch: {
    accent?: string | null;
    emblem?: string | null;
    pattern?: string | null;
    isImportant?: boolean;
  }
): Promise<import('./types').Quest[]> {
  const res = await apiFetch<{ quests: import('./types').Quest[] }>(
    `/api/dm/quests/${questId}/tile`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  return res.quests;
}

export async function uploadCustomCampaignEmoji(
  file: File,
  name: string
): Promise<{
  emoji: import('./types').CustomCampaignEmoji;
  customEmojis: import('./types').CustomCampaignEmoji[];
}> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name);

  return apiFetch<{
    emoji: import('./types').CustomCampaignEmoji;
    customEmojis: import('./types').CustomCampaignEmoji[];
  }>('/api/chat/emojis', {
    method: 'POST',
    body: fd,
    timeoutMs: 30000,
  });
}

export async function patchTalentTile(
  talentId: number,
  patch: {
    accent?: string | null;
    emblem?: string | null;
    pattern?: string | null;
    isFeatured?: boolean;
  }
): Promise<{
  inspirationPoints: number;
  nodes: import('./types').TalentNode[];
  purchases: import('./types').PurchasedTalent[];
}> {
  return apiFetch(`/api/dm/talents/${talentId}/tile`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/* -------------------------------------------------------------------------- */
/*  Видимость: личные квесты и «Литература»                                    */
/* -------------------------------------------------------------------------- */

/** Ростер партии для выбора «кому видно» (только мастер). */
export async function fetchPartyPlayers(): Promise<import('./types').PartyPlayerSummary[]> {
  const res = await apiFetch<{ players: import('./types').PartyPlayerSummary[] }>('/api/dm/players');
  return res.players ?? [];
}

export async function fetchLiterature(): Promise<{
  files: import('./types').LiteratureFile[];
  isDm: boolean;
}> {
  return apiFetch<{ files: import('./types').LiteratureFile[]; isDm: boolean }>('/api/literature');
}

export async function uploadLiteratureFile(
  file: File,
  options: { title?: string; description?: string; visibleUserIds?: number[] } = {}
): Promise<import('./types').LiteratureFile> {
  const fd = new FormData();
  fd.append('file', file);
  if (options.title) fd.append('title', options.title);
  if (options.description) fd.append('description', options.description);
  fd.append('visibleUserIds', JSON.stringify(options.visibleUserIds ?? []));

  const res = await apiFetch<{ file: import('./types').LiteratureFile }>('/api/dm/literature', {
    method: 'POST',
    body: fd,
    timeoutMs: 120000,
  });
  return res.file;
}

export async function patchLiteratureFile(
  id: number,
  patch: { title?: string; description?: string; visibleUserIds?: number[] }
): Promise<import('./types').LiteratureFile> {
  const res = await apiFetch<{ file: import('./types').LiteratureFile }>(
    `/api/dm/literature/${id}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  return res.file;
}

export async function deleteLiteratureFile(id: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/dm/literature/${id}`, { method: 'DELETE' });
}

/** Прямая ссылка на файл литературы (права проверяет сервер). */
export function literatureFileUrl(id: number, download = false): string {
  return `/api/literature/${id}/file${download ? '?download=1' : ''}`;
}
