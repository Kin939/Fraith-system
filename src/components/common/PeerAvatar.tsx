import React from 'react';
import { Crown } from 'lucide-react';

/**
 * Круглый аватар участника: реальный портрет, иначе — инициалы.
 * Используется везде, где показываются люди (доска, курсоры, списки, сайдбар).
 */
export const PeerAvatar: React.FC<{
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
  active?: boolean;
  title?: string;
  crown?: boolean;
}> = ({ name, color, avatarUrl, size = 28, active = false, title, crown = false }) => {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <div
      className="relative shrink-0 overflow-hidden bg-deep"
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        boxShadow: active ? `0 0 12px ${color}88` : `0 0 6px ${color}33`,
        borderRadius: '50%',
      }}
      title={title ?? name}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-semibold"
          style={{ color, fontSize: Math.max(9, size * 0.38) }}
        >
          {initials}
        </div>
      )}
      {crown && (
        <Crown
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-warning"
          strokeWidth={2}
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9))' }}
        />
      )}
    </div>
  );
};
