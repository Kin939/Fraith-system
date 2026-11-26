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
 * Architectural Sci-Fi Anime HUD panel wrapper with L-shaped corner brackets,
 * angular chamfered polygon corners, and optional telemetry header strip.
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
      className={`hud-panel hud-corners relative ${cutClass} ${
        activeRim ? 'rim-card--active' : ''
      } ${neonTopLine ? 'hud-neon-top' : ''} ${className}`}
    >
      {(code || title || rightSlot) && (
        <header className="px-4 py-3 border-b border-primary/25 bg-[#070B14]/70 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {code && (
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/90 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 bg-primary shadow-[0_0_8px_var(--primary)]" />
                <span>{code}</span>
              </div>
            )}
            {title && (
              <h2 className="font-anime font-bold text-base sm:text-lg tracking-wider uppercase text-text truncate">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {rightSlot && <div className="flex items-center gap-2 flex-wrap">{rightSlot}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
};
