const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const ALLOWED_FOLDERS = new Set(['quests', 'bestiary', 'talents', 'avatars']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function uploadImageToR2(
  bucket: R2Bucket | undefined,
  db: D1Database,
  file: File,
  folder: string
): Promise<{ key: string; url: string }> {
  const safeFolder = ALLOWED_FOLDERS.has(folder) ? folder : 'quests';
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    throw new Error('Поддерживаются только изображения PNG, JPG, WEBP, GIF или SVG');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Максимальный размер изображения — 5 МБ');
  }

  const baseSlug =
    file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'asset';

  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const key = `${safeFolder}/${Date.now()}-${baseSlug}-${randomSuffix}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  if (bucket) {
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  } else {
    // Fallback to D1 media_blobs when R2 bucket binding is not yet enabled on the account
    const b64 = arrayBufferToBase64(arrayBuffer);
    await db
      .prepare(
        `INSERT OR REPLACE INTO media_blobs (key, content_type, data_base64, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(key, file.type, b64)
      .run();
  }

  return {
    key,
    url: `/api/r2/${encodeURIComponent(key)}`,
  };
}

export async function getImageFromR2(
  bucket: R2Bucket | undefined,
  db: D1Database,
  key: string
): Promise<Response> {
  if (bucket) {
    const object = await bucket.get(key);
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      if (!headers.has('cache-control')) {
        headers.set('cache-control', 'public, max-age=86400');
      }
      return new Response(object.body, { headers });
    }
  }

  const fallbackRow = await db
    .prepare(`SELECT content_type, data_base64 FROM media_blobs WHERE key = ?`)
    .bind(key)
    .first<{ content_type: string; data_base64: string }>();

  if (!fallbackRow) {
    return new Response('Not Found', { status: 404 });
  }

  const bytes = base64ToUint8Array(fallbackRow.data_base64);
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': fallbackRow.content_type,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
