import React from 'react';
import { Crown } from 'lucide-react';
import type { PlayerId, UserRole } from '../../lib/types';

export type PlayerAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<PlayerAvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

interface PlayerAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  role?: UserRole;
  playerId?: PlayerId | null;
  size?: PlayerAvatarSize;
  accentColor?: string;
  className?: string;
  /** Slight luminosity for offline members */
  dim?: boolean;
  showRoleBadge?: boolean;
  title?: string;
}

/**
 * Character portrait avatar for the messenger, roster and character header.
 * Falls back to an accent monogram (or a DM crown) when no portrait is set.
 */
export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatarUrl,
  displayName,
  role = 'player',
  playerId,
  size = 'sm',
  accentColor,
  className = '',
  dim = false,
  showRoleBadge = true,
  title,
}) => {
  const initials = (displayName || '?').trim().slice(0, 1).toUpperCase() || '?';
  const accent = accentColor || (role === 'dm' ? '#f59e0b' : '#00e5ff');
  const isDm = role === 'dm';

  return (
    <div
      title={title ?? displayName ?? undefined}
      data-player-id={playerId ?? undefined}
      className={`player-avatar relative shrink-0 select-none ${SIZE_CLASS[size]} ${className}`}
      style={{
        ['--pa-accent' as string]: accent,
        ['--pa-accent-soft' as string]: `${accent}40`,
      }}
    >
      <div
        className={`absolute inset-0 overflow-hidden hud-cut-sm bg-deep ${
          dim ? 'opacity-60' : ''
        }`}
        style={{
          boxShadow: `inset 0 0 0 1px ${accent}66, inset 0 0 18px ${accent}22`,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName || 'Портрет'}
            loading="lazy"
            draggable={false}
            className="block w-full h-full object-cover object-top"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-medium"
            style={{ color: accent }}
          >
            {isDm ? (
              <Crown
                className={size === 'xs' || size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'}
                strokeWidth={1.5}
              />
            ) : (
              initials
            )}
          </div>
        )}
      </div>

      {/* Corner accents */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-px -left-px w-1.5 h-1.5 border-t border-l"
        style={{ borderColor: accent }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-px -right-px w-1.5 h-1.5 border-b border-r"
        style={{ borderColor: accent }}
      />

      {showRoleBadge && isDm && avatarUrl && (
        <span
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface border flex items-center justify-center"
          style={{ borderColor: `${accent}88` }}
          title="Мастер"
        >
          <Crown className="w-2.5 h-2.5" strokeWidth={2} style={{ color: accent }} />
        </span>
      )}
    </div>
  );
};
