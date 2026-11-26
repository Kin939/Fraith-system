import React from 'react';
import { resolveImageUrl } from '../../lib/artwork';
import type { BestiaryCreature } from '../../lib/types';
import { DndsuImage } from './DndsuImage';

interface MonsterArtProps {
  creature: Pick<BestiaryCreature, 'name' | 'imageKey' | 'imageUrl' | 'imageFullUrl'>;
  /** Tiles use the thumbnail, the detail view prefers the full-size scan */
  variant?: 'thumb' | 'full';
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  /** Rendered when no artwork can be loaded at all */
  fallback?: React.ReactNode;
}

/**
 * Bestiary artwork: a portrait uploaded by the DM wins, otherwise the dnd.su
 * gallery art is used (with the proxy/direct fallback chain inside DndsuImage)
 * and finally the caller-provided placeholder.
 */
export const MonsterArt: React.FC<MonsterArtProps> = ({
  creature,
  variant = 'thumb',
  className = '',
  imgClassName = '',
  eager = false,
  fallback = null,
}) => {
  const placeholder = fallback ?? (
    <img
      src={resolveImageUrl(null, 'dragon')}
      alt={creature.name}
      className={`${className} ${imgClassName}`.trim()}
    />
  );

  if (creature.imageKey) {
    return (
      <img
        src={resolveImageUrl(creature.imageKey, 'dragon')}
        alt={creature.name}
        loading={eager ? 'eager' : 'lazy'}
        className={`${className} ${imgClassName}`.trim()}
        onError={(e) => {
          // Broken upload — fall back to the shared placeholder art
          const target = e.currentTarget;
          target.onerror = null;
          target.src = resolveImageUrl(null, 'dragon');
        }}
      />
    );
  }

  if (!creature.imageUrl && !creature.imageFullUrl) {
    return <>{placeholder}</>;
  }

  return (
    <DndsuImage
      thumbUrl={creature.imageUrl}
      fullUrl={creature.imageFullUrl}
      variant={variant}
      alt={creature.name}
      className={className}
      imgClassName={imgClassName}
      eager={eager}
      fallback={placeholder}
    />
  );
};
