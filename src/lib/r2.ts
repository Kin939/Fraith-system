import type { ChatAttachment, ChatAttachmentKind } from './types';

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const ALLOWED_CHAT_MIME_TYPES: Record<string, { ext: string; kind: ChatAttachmentKind }> = {
  'image/png': { ext: 'png', kind: 'image' },
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'algorithm/webp': { ext: 'webp', kind: 'image' },
  'application/pdf': { ext: 'pdf', kind: 'file' },
  'application/json': { ext: 'json', kind: 'file' },
  'text/plain': { ext: 'txt', kind: 'file' },
  'text/markdown': { ext: 'md', kind: 'file' },
  'text/csv': { ext: 'csv', kind: 'file' },
  'application/zip': { ext: 'zip', kind: 'file' },
  'application/x-zip-compressed': { ext: 'zip', kind: 'file' },
  'application/vnd.rar': { ext: 'rar', kind: 'file' },
  'application/x-7z-compressed': { ext: '7z', kind: 'file' },
  'application/msword': { ext: 'doc', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    kind: 'file',
  },
  'application/vnd.ms-excel': { ext: 'xls', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: 'xlsx',
    kind: 'file',
  },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
  'audio/mp3': { ext: 'mp3', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
  'audio/wav': { ext: 'wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', kind: 'audio' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
};

const EXTENSION_FALLBACK_MAP: Record<
  string,
  { mime: string; ext: string; kind: ChatAttachmentKind }
> = {
  png: { mime: 'image/png', ext: 'png', kind: 'image' },
  jpg: { mime: 'image/jpeg', ext: 'jpg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg', kind: 'image' },
  webp: { mime: 'image/webp', ext: 'webp', kind: 'image' },
  gif: { mime: 'image/gif', ext: 'gif', kind: 'image' },
  pdf: { mime: 'application/pdf', ext: 'pdf', kind: 'file' },
  json: { mime: 'application/json', ext: 'json', kind: 'file' },
  txt: { mime: 'text/plain; charset=utf-8', ext: 'txt', kind: 'file' },
  md: { mime: 'text/markdown; charset=utf-8', ext: 'md', kind: 'file' },
  csv: { mime: 'text/csv; charset=utf-8', ext: 'csv', kind: 'file' },
  zip: { mime: 'application/zip', ext: 'zip', kind: 'file' },
  rar: { mime: 'application/vnd.rar', ext: 'rar', kind: 'file' },
  '7z': { mime: 'application/x-7z-compressed', ext: '7z', kind: 'file' },
  doc: { mime: 'application/msword', ext: 'doc', kind: 'file' },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
    kind: 'file',
  },
  xls: { mime: 'application/vnd.ms-excel', ext: 'xls', kind: 'file' },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
    kind: 'file',
  },
  mp3: { mime: 'audio/mpeg', ext: 'mp3', kind: 'audio' },
  ogg: { mime: 'audio/ogg', ext: 'ogg', kind: 'audio' },
  wav: { mime: 'audio/wav', ext: 'wav', kind: 'audio' },
  m4a: { mime: 'audio/mp4', ext: 'm4a', kind: 'audio' },
  mp4: { mime: 'video/mp4', ext: 'mp4', kind: 'video' },
  webm: { mime: 'video/webm', ext: 'webm', kind: 'video' },
};

const BLOCKED_EXTENSIONS = new Set([
  'html',
  'htm',
  'svg',
  'js',
  'mjs',
  'cjs',
  'exe',
  'bat',
  'cmd',
  'sh',
  'msi',
  'php',
]);

const ALLOWED_FOLDERS = new Set(['quests', 'bestiary', 'talents', 'avatars', 'npcs']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB for DM artwork
const MAX_CHAT_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB for chat photos & files

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

export async function uploadChatAttachmentToR2(
  bucket: R2Bucket | undefined,
  db: D1Database,
  file: File
): Promise<ChatAttachment> {
  if (!file || file.size <= 0) {
    throw new Error('Пустой файл не может быть прикреплён');
  }
  if (file.size > MAX_CHAT_UPLOAD_BYTES) {
    throw new Error('Максимальный размер файла в чате — 8 МБ');
  }

  const rawName = (file.name || 'attachment').trim();
  const extMatch = rawName.match(/\.([a-zA-Z0-9]{1,8})$/);
  const rawExt = extMatch ? extMatch[1].toLowerCase() : '';

  if (rawExt && BLOCKED_EXTENSIONS.has(rawExt)) {
    throw new Error(`Файлы .${rawExt} запрещены из соображений безопасности`);
  }

  const normalizedMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const directMeta = ALLOWED_CHAT_MIME_TYPES[normalizedMime];
  const fallbackMeta = rawExt ? EXTENSION_FALLBACK_MAP[rawExt] : undefined;

  let finalExt = directMeta?.ext || fallbackMeta?.ext || rawExt || 'bin';
  finalExt = finalExt.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';

  const finalKind: ChatAttachmentKind =
    directMeta?.kind ||
    fallbackMeta?.kind ||
    (normalizedMime.startsWith('image/') && normalizedMime !== 'image/svg+xml'
      ? 'image'
      : normalizedMime.startsWith('audio/')
        ? 'audio'
        : normalizedMime.startsWith('video/')
          ? 'video'
          : 'file');

  const finalMime =
    directMeta
      ? normalizedMime
      : fallbackMeta?.mime || normalizedMime || 'application/octet-stream';

  const baseSlug =
    rawName
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'file';

  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const key = `chat/${Date.now()}-${baseSlug}-${randomSuffix}.${finalExt}`;
  const arrayBuffer = await file.arrayBuffer();

  if (bucket) {
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: finalMime,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  } else {
    const b64 = arrayBufferToBase64(arrayBuffer);
    await db
      .prepare(
        `INSERT OR REPLACE INTO media_blobs (key, content_type, data_base64, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(key, finalMime, b64)
      .run();
  }

  return {
    key,
    url: `/api/chat/files/${encodeURIComponent(key)}`,
    name: rawName.slice(0, 140),
    mimeType: finalMime,
    size: file.size,
    kind: finalKind,
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

export async function getChatAttachmentFromR2(
  bucket: R2Bucket | undefined,
  db: D1Database,
  key: string,
  downloadName?: string | null
): Promise<Response> {
  const res = await getImageFromR2(bucket, db, key);
  if (!res.ok) return res;

  const headers = new Headers(res.headers);
  const ct = (headers.get('Content-Type') || '').toLowerCase();
  const isInlineSafe =
    (ct.startsWith('image/') && !ct.includes('svg')) ||
    ct.startsWith('audio/') ||
    ct.startsWith('video/') ||
    ct.startsWith('application/pdf');

  headers.set('X-Content-Type-Options', 'nosniff');
  if (downloadName) {
    const encoded = encodeURIComponent(downloadName);
    headers.set(
      'Content-Disposition',
      `${isInlineSafe ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`
    );
  } else if (!isInlineSafe) {
    headers.set('Content-Disposition', 'attachment');
  }

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
