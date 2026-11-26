import React from 'react';
import { Pause, Play, RotateCcw, Timer as TimerIcon, PlusCircle } from 'lucide-react';
import { formatSeconds } from '../../lib/combatProtocol';

interface TurnTimerProps {
  /** Длительность хода в секундах (null — таймер выключен) */
  totalSeconds: number | null;
  remainingMs: number;
  running: boolean;
  paused: boolean;
  expired: boolean;
  canControl: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onExtend?: () => void;
}

/**
 * Крупный HUD-индикатор хода.
 * По истечении времени ничего не переключается автоматически — пульсирующий
 * индикатор лишь сигнализирует мастеру и игрокам (правила оставляют решение мастеру).
 */
export const TurnTimer: React.FC<TurnTimerProps> = ({
  totalSeconds,
  remainingMs,
  running,
  paused,
  expired,
  canControl,
  onStart,
  onPause,
  onReset,
  onExtend,
}) => {
  if (!totalSeconds) return null;

  const totalMs = totalSeconds * 1000;
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const tone = expired ? 'negative' : ratio > 0.5 ? 'primary' : ratio > 0.2 ? 'warning' : 'negative';
  const colorMap: Record<string, string> = {
    primary: '#22d3ee',
    warning: '#f59e0b',
    negative: '#f43f5e',
  };
  const color = colorMap[tone];

  return (
    <div
      className={`relative px-3 py-2 border hud-cut bg-deep/80 backdrop-blur-sm flex items-center gap-3 ${
        expired ? 'border-negative/70 animate-pulse' : 'border-border'
      }`}
      style={{ boxShadow: expired ? `0 0 18px ${color}66` : `0 0 12px ${color}22` }}
      title={expired ? 'Время хода истекло — решение за мастером' : 'Таймер хода'}
    >
      <TimerIcon className="w-4 h-4 shrink-0" strokeWidth={1.5} style={{ color }} />
      <div className="min-w-0">
        <div
          className="font-mono text-xl tabular-nums leading-none"
          style={{ color, textShadow: `0 0 12px ${color}66` }}
        >
          {formatSeconds(remainingMs)}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-wide text-muted mt-0.5">
          {paused ? 'пауза' : expired ? 'время вышло' : `ход · ${totalSeconds} с`}
        </div>
      </div>

      <div className="w-24 sm:w-40 self-center">
        <div className="h-1.5 bg-raised overflow-hidden">
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {canControl && (
        <div className="flex items-center gap-1 ml-auto">
          {paused || !running ? (
            <button
              type="button"
              onClick={onStart}
              className="w-7 h-7 flex items-center justify-center border border-border text-muted hover:text-primary hover:border-primary/60"
              title="Запустить отсчёт"
            >
              <Play className="w-3 h-3" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="w-7 h-7 flex items-center justify-center border border-border text-muted hover:text-warning hover:border-warning/60"
              title="Пауза"
            >
              <Pause className="w-3 h-3" strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="w-7 h-7 flex items-center justify-center border border-border text-muted hover:text-text"
            title="Сбросить и запустить заново"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onExtend}
            className="h-7 px-1.5 flex items-center gap-1 border border-border text-[9px] font-mono uppercase text-muted hover:text-primary hover:border-primary/60"
            title="Продлить на 30 секунд"
          >
            <PlusCircle className="w-3 h-3" strokeWidth={1.75} /> 30с
          </button>
        </div>
      )}
    </div>
  );
};
