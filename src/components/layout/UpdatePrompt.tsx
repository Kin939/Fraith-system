import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CDN_MANIFEST_URLS = [
  'https://gcore.jsdelivr.net/gh/Kin939/Fraith-system@gh-pages/cdn-manifest.json',
  'https://fastly.jsdelivr.net/gh/Kin939/Fraith-system@gh-pages/cdn-manifest.json',
];

const isLocalHost = (): boolean => {
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.slice(-8) === '.e2b.app' ||
    host.slice(-6) === '.local'
  );
};

/** Текущая сборка (подставляется Vite при сборке). */
export const BUILD_SHA = typeof __FRAITH_BUILD_SHA__ === 'string' ? __FRAITH_BUILD_SHA__ : '';
export const BUILD_AT = typeof __FRAITH_BUILD_AT__ === 'string' ? __FRAITH_BUILD_AT__ : '';

/** Коммит и время сборки, которые сейчас опубликованы в CDN-манифесте. */
async function fetchCdnBuild(): Promise<{ commit: string; builtAt: number } | null> {
  for (const base of CDN_MANIFEST_URLS) {
    try {
      const res = await fetch(`${base}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = (await res.json()) as { commit?: string; builtAt?: string };
      if (!data?.commit) continue;
      return {
        commit: data.commit,
        builtAt: data.builtAt ? Date.parse(data.builtAt) : 0,
      };
    } catch {
      // зеркало недоступно — пробуем следующий хост
    }
  }
  return null;
}

/** HEAD ветки main по GitHub API: не кэшируется CDN-зеркалами. */
async function fetchMainHead(): Promise<{ commit: string; at: number } | null> {
  try {
    const res = await fetch('https://api.github.com/repos/Kin939/Fraith-system/commits/main', {
      cache: 'no-store',
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sha?: string; commit?: { committer?: { date?: string } } };
    if (!data?.sha) return null;
    return { commit: data.sha.slice(0, 12), at: data.commit?.committer?.date ? Date.parse(data.commit.committer.date) : 0 };
  } catch {
    return null;
  }
}

/**
 * Подсказка об обновлении.
 *
 * В РФ портал грузит бандл с CDN-зеркала, поэтому браузер может держать старый
 * index.html и «не видеть» деплой. Сверяем коммит сборки с манифестом на CDN и
 * предлагаем перезагрузиться, как только там появится более новая версия.
 */
export const UpdatePrompt: React.FC = () => {
  const [remote, setRemote] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isLocalHost() || !BUILD_SHA) return;

    let cancelled = false;
    const builtAt = BUILD_AT ? Date.parse(BUILD_AT) : 0;
    const check = async () => {
      const [cdn, head] = await Promise.all([fetchCdnBuild(), fetchMainHead()]);
      if (cancelled) return;
      // Сравниваем со сборкой по времени: устаревший кэш jsDelivr (gh-pages)
      // отдаёт манифест старше нашего — это не обновление.
      const candidates = [cdn?.commit, head?.commit].filter(
        (value): value is string => Boolean(value) && !BUILD_SHA.startsWith(value!)
      );
      const isNewer =
        Boolean(cdn && cdn.builtAt > builtAt + 30_000) ||
        Boolean(head && head.at > builtAt + 30_000 && !BUILD_SHA.startsWith(head.commit));
      setRemote(isNewer && candidates.length > 0 ? candidates[0] : null);
    };

    void check();
    const interval = window.setInterval(() => void check(), 5 * 60 * 1000);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!remote || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 border border-primary/50 bg-deep/97 backdrop-blur-sm shadow-glass">
      <span className="text-[11px] text-text">
        Доступно обновление <span className="font-mono text-primary">{remote?.slice(0, 7)}</span>
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="anime-btn-primary px-2.5 py-1 text-[11px] flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" strokeWidth={1.75} /> Обновить
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="px-1.5 py-1 text-[10px] font-mono uppercase text-muted hover:text-text"
        title="Скрыть до следующего визита"
      >
        позже
      </button>
    </div>
  );
};

export default UpdatePrompt;
