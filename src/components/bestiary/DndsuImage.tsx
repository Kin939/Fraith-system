import React, { useEffect, useMemo, useState } from 'react';

interface DndsuImageProps {
  /** dnd.su thumbnail URL (`_s` variant) */
  thumbUrl?: string;
  /** Full-size dnd.su scan */
  fullUrl?: string;
  variant?: 'thumb' | 'full';
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  /** Shown when every source failed (or when there is no artwork at all). */
  fallback?: React.ReactNode;
}

function fileName(url: string): string {
  const clean = url.split('?')[0];
  return clean.split('/').pop() || '';
}

/** Same-origin, edge-cached Worker copy of a dnd.su artwork file. */
export function dndsuProxyUrl(url: string): string {
  const file = fileName(url);
  return file ? `/api/media/dndsu/${encodeURIComponent(file)}` : '';
}

/**
 * dnd.su artwork with a resilient source chain:
 * the original file straight from dnd.su first (the browser usually reaches it
 * even when the Worker cannot), then our edge-cached proxy, then the other
 * resolution (full ↔ thumbnail) and only then the caller's fallback.
 */
export const DndsuImage: React.FC<DndsuImageProps> = ({
  thumbUrl = '',
  fullUrl = '',
  variant = 'thumb',
  alt,
  className = '',
  imgClassName = '',
  eager = false,
  fallback = null,
}) => {
  const sources = useMemo(() => {
    const primary = variant === 'full' ? fullUrl || thumbUrl : thumbUrl || fullUrl;
    const secondary = variant === 'full' ? thumbUrl : fullUrl;
    const list: string[] = [];

    const push = (url: string) => {
      if (!url) return;
      list.push(url);
      const proxy = dndsuProxyUrl(url);
      if (proxy) list.push(proxy);
    };

    push(primary);
    if (secondary && secondary !== primary) push(secondary);

    return Array.from(new Set(list));
  }, [fullUrl, thumbUrl, variant]);

  const signature = sources.join('|');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  if (!sources.length || index >= sources.length) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={sources[index]}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      className={`${className} ${imgClassName}`.trim()}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );
};
