export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

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
