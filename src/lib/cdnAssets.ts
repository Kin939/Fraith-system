const GITHUB_REPO = 'Kin939/Fraith-system';

const PUBLIC_CDN_MIRRORS = [
  `https://gcore.jsdelivr.net/gh/${GITHUB_REPO}@main/public`,
  `https://fastly.jsdelivr.net/gh/${GITHUB_REPO}@main/public`,
  `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public`,
];

export function isLocalOrSandboxHost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.endsWith('.e2b.app') ||
    h.endsWith('.local')
  );
}

/**
 * Offloads static icons/images from Cloudflare workers.dev onto G-Core jsDelivr CDN
 * in production so Russian ISPs' 16 KB Cloudflare TCP cap does not stall connections.
 */
export function resolvePublicAssetUrl(localPath: string): string {
  const clean = localPath.startsWith('/') ? localPath : `/${localPath}`;
  if (isLocalOrSandboxHost()) {
    return clean;
  }
  return `${PUBLIC_CDN_MIRRORS[0]}${clean}`;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads static JSON datasets (such as dnd.su spell catalogs) from Russia-accessible
 * non-Cloudflare CDNs first in production, with automatic multi-mirror + same-origin fallback.
 */
export async function fetchStaticJsonWithFallback<T>(
  localPath: string,
  errorMessage: string
): Promise<T> {
  const clean = localPath.startsWith('/') ? localPath : `/${localPath}`;

  if (isLocalOrSandboxHost()) {
    return fetchJsonWithTimeout<T>(clean, 20000);
  }

  const candidates = [
    ...PUBLIC_CDN_MIRRORS.map((base) => `${base}${clean}`),
    clean,
  ];

  let lastErr: unknown = null;
  for (const url of candidates) {
    try {
      return await fetchJsonWithTimeout<T>(url, 14000);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(errorMessage);
}
