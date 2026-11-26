import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import type { BoardTimerAction, BoardTimerState } from '../../lib/boardProtocol';
import { formatClock, timerRemaining } from '../../lib/boardProtocol';

interface SessionTimerProps {
  timer: BoardTimerState | null;
  canControl: boolean;
  onAction: (action: BoardTimerAction, durationMs?: number) => void;
}

const PRESETS = [5, 10, 15, 25];

/** Общий таймер сессии: состояние живёт в DO, поэтому у всех одинаковое время. */
export const SessionTimer: React.FC<SessionTimerProps> = ({ timer, canControl, onAction }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  const remaining = timerRemaining(timer, now);
  const progress = useMemo(() => {
    if (!timer || timer.durationMs <= 0) return 0;
    return Math.max(0, Math.min(1, remaining / timer.durationMs));
  }, [remaining, timer]);

  const low = remaining <= 60_000;

  return (
    <div className="flex items-center gap-2 h-8 pl-2 pr-1 border border-border bg-surface">
      <Timer className={`w-3.5 h-3.5 ${low ? 'text-negative' : 'text-muted'}`} strokeWidth={1.5} />
      <span
        className={`font-mono text-xs tabular-nums ${low ? 'text-negative' : 'text-text'}`}
        title="Общий таймер сессии"
      >
        {formatClock(remaining)}
      </span>

      <div className="w-16 h-1 bg-raised overflow-hidden">
        <div
          className={`h-full ${low ? 'bg-negative' : 'bg-primary'}`}
          style={{ width: `${Math.round(progress * 100)}%`, boxShadow: '0 0 8px currentColor' }}
        />
      </div>

      {canControl && (
        <div className="flex items-center gap-0.5 ml-1">
          {timer?.running ? (
            <button
              type="button"
              onClick={() => onAction('pause')}
              className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-text transition-colors"
              title="Пауза"
            >
              <Pause className="w-3 h-3" strokeWidth={1.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAction('start')}
              className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-text transition-colors"
              title="Старт"
            >
              <Play className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction('reset')}
            className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-text transition-colors"
            title="Сброс"
          >
            <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <select
            value=""
            onChange={(event) => {
              const minutes = Number(event.target.value);
              if (minutes) onAction('set', minutes * 60_000);
            }}
            className="h-6 bg-surface border border-border text-[10px] text-muted font-mono px-1 outline-none"
            title="Длительность"
          >
            <option value="">мин</option>
            {PRESETS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
