const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const ALLOWED_FOLDERS = new Set(['quests', 'bestiary', 'talents', 'avatars']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadImageToR2(
  bucket: R2Bucket,
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

  const baseSlug = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'asset';

  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const key = `${safeFolder}/${Date.now()}-${baseSlug}-${randomSuffix}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  await bucket.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return {
    key,
    url: `/api/r2/${encodeURIComponent(key)}`,
  };
}

export async function getImageFromR2(bucket: R2Bucket, key: string): Promise<Response> {
  const object = await bucket.get(key);
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=86400');
  }
  return new Response(object.body, { headers });
}
