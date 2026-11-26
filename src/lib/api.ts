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
  folder: 'quests' | 'bestiary' | 'talents' | 'avatars'
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
