import React from 'react';
import {
  Crown,
  Dices,
  Flame,
  Orbit,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { glyphToHudAssetKey, type HudAssetKey } from '../../lib/hudIcons';

interface HudIconProps {
  asset?: HudAssetKey | string;
  glyph?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const LINE_ICONS: Record<HudAssetKey, LucideIcon> = {
  dice: Dices,
  bolt: Zap,
  spark: Sparkles,
  blades: Swords,
  crown: Crown,
  dragon: Flame,
  skull: Skull,
  orb: Orbit,
  flame: Flame,
  shield: Shield,
};

const SIZE_CLASSES: Record<NonNullable<HudIconProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
};

/**
 * Unslop Pass 3: Renders a single consistent 1.5-stroke line-icon set in currentColor
 * across UI chrome, labels, keycaps, and controls — zero emoji and zero colorful PNG noise.
 */
export const HudIcon: React.FC<HudIconProps> = ({
  asset,
  glyph,
  alt,
  size = 'sm',
  className = '',
}) => {
  const key = glyphToHudAssetKey(asset ?? glyph);
  const Icon = LINE_ICONS[key] ?? Sparkles;
  return (
    <Icon
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      strokeWidth={1.5}
      className={`inline-block shrink-0 ${SIZE_CLASSES[size]} ${className}`}
    />
  );
};
