import React from 'react';

export interface HudFrameProps {
  children: React.ReactNode;
  code?: string;
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  activeRim?: boolean;
  neonTopLine?: boolean;
  cut?: 'none' | 'sm' | 'md';
  className?: string;
  bodyClassName?: string;
}

/**
 * Clean tactical panel wrapper with restrained angular corners and sentence-case header.
 */
export const HudFrame: React.FC<HudFrameProps> = ({
  children,
  code,
  title,
  subtitle,
  rightSlot,
  activeRim = false,
  neonTopLine = false,
  cut = 'md',
  className = '',
  bodyClassName = '',
}) => {
  const cutClass = cut === 'md' ? 'hud-cut' : cut === 'sm' ? 'hud-cut-sm' : '';

  return (
    <section
      className={`hud-panel relative ${cutClass} ${
        activeRim ? 'rim-card--active' : ''
      } ${neonTopLine ? 'hud-neon-top' : ''} ${className}`}
    >
      {(code || title || rightSlot) && (
        <header className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {code && (
              <div className="text-xs text-muted mb-0.5">{code}</div>
            )}
            {title && (
              <h2 className="font-anime font-medium text-lg text-text truncate">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {rightSlot && <div className="flex items-center gap-2 flex-wrap">{rightSlot}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
};
