import React from 'react';
import { Grid2x2, Grid3x3, LayoutGrid, Square } from 'lucide-react';
import {
  TILE_SIZES,
  TILE_SIZE_META,
  useTileSize,
  type TileSize,
} from '../../lib/tileSize';

const SIZE_ICON: Record<TileSize, React.ReactNode> = {
  compact: <Grid3x3 className="w-3.5 h-3.5" strokeWidth={1.5} />,
  normal: <Grid2x2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
  large: <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />,
  huge: <Square className="w-3.5 h-3.5" strokeWidth={1.5} />,
};

interface TileSizeControlProps {
  scope: string;
  label?: string;
  className?: string;
  fallback?: TileSize;
}

/**
 * Segmented S / M / L / XL density switch shared by quests and talents.
 * The choice is stored per user in localStorage.
 */
export const TileSizeControl: React.FC<TileSizeControlProps> = ({
  scope,
  label = 'Размер плиток',
  className = '',
  fallback = 'normal',
}) => {
  const [size, setSize] = useTileSize(scope, fallback);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && (
        <span className="text-[11px] text-muted hidden sm:inline whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="inline-flex items-center bg-surface border border-border p-0.5 gap-0.5">
        {TILE_SIZES.map((option) => {
          const meta = TILE_SIZE_META[option];
          const active = size === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setSize(option)}
              title={`${meta.label} — ${meta.hint}`}
              aria-pressed={active}
              className={`h-7 min-w-7 px-1.5 inline-flex items-center justify-center gap-1 text-[11px] transition-colors ${
                active
                  ? 'bg-raised text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-secondary hover:text-text'
              }`}
            >
              {SIZE_ICON[option]}
              <span className="font-mono leading-none">{meta.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
