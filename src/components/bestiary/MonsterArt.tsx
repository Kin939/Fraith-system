import React, { useEffect, useMemo, useState } from 'react';
import { resolveImageUrl } from '../../lib/artwork';
import type { BestiaryCreature } from '../../lib/types';

interface MonsterArtProps {
  creature: Pick<BestiaryCreature, 'name' | 'imageKey' | 'imageUrl' | 'imageFullUrl'>;
  /** Tiles use the thumbnail, the detail view prefers the full-size scan */
  variant?: 'thumb' | 'full';
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}

function fileName(url: string): string {
  const clean = url.split('?')[0];
  return clean.split('/').pop() || '';
}

/**
 * Bestiary artwork with a graceful fallback chain:
 * DM-uploaded portrait → edge-cached dnd.su scan (same-origin proxy) →
 * direct dnd.su URL → static placeholder art.
 */
export const MonsterArt: React.FC<MonsterArtProps> = ({
  creature,
  variant = 'thumb',
  className = '',
  imgClassName = '',
  eager = false,
}) => {
  const sources = useMemo(() => {
    const list: string[] = [];

    if (creature.imageKey) {
      // A manually uploaded portrait always wins
      list.push(resolveImageUrl(creature.imageKey, 'dragon'));
    } else {
      const remote =
        variant === 'full'
          ? creature.imageFullUrl || creature.imageUrl
          : creature.imageUrl || creature.imageFullUrl;
      const file = remote ? fileName(remote) : '';
      if (file) list.push(`/api/media/dndsu/${encodeURIComponent(file)}`);
      if (remote) list.push(remote);
    }

    list.push(resolveImageUrl(null, 'dragon'));
    return Array.from(new Set(list));
  }, [creature.imageKey, creature.imageFullUrl, creature.imageUrl, variant]);

  const signature = sources.join('|');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  const src = sources[Math.min(index, sources.length - 1)];

  return (
    <span className={`block overflow-hidden ${className}`}>
      <img
        src={src}
        alt={creature.name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setIndex((prev) => Math.min(prev + 1, sources.length - 1))}
        className={imgClassName}
      />
    </span>
  );
};
