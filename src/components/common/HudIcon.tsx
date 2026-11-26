import React from 'react';
import { getHudAssetUrl, glyphToHudAssetKey, type HudAssetKey } from '../../lib/hudIcons';

interface HudIconProps {
  asset?: HudAssetKey | string;
  glyph?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<HudIconProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

export const HudIcon: React.FC<HudIconProps> = ({
  asset,
  glyph,
  alt = '',
  size = 'sm',
  className = '',
}) => {
  const key = glyphToHudAssetKey(asset ?? glyph);
  return (
    <img
      src={getHudAssetUrl(key)}
      alt={alt}
      draggable={false}
      className={`inline-block object-cover select-none shrink-0 mix-blend-lighten ${SIZE_CLASSES[size]} ${className}`}
    />
  );
};
