import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import type { BoardTimerAction, BoardTimerState } from '../../lib/boardProtocol';
import { formatClock, timerRemaining } from '../../lib/boardProtocol';

interface SessionTimerProps {
  timer: BoardTimerState | null;
  canControl: boolean;
  onAction: (action: BoardTimerAction, durationMs?: number) => void;
}

const clampMinutes = (raw: number): number => Math.min(Math.max(raw, 0.1), 360);

/**
 * Общий таймер сессии.
 * По умолчанию скрыт: в шапке только маленькая кнопка-иконка, по клику выезжает
 * панель с ручным вводом минут (можно дробные: 2.5) и управлением.
 */
export const SessionTimer: React.FC<SessionTimerProps> = ({ timer, canControl, onAction }) => {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [minutes, setMinutes] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    const closeOnOutside = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      clearInterval(tick);
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [open]);

  const remaining = timerRemaining(timer, now);
  const running = Boolean(timer?.running);
  const low = remaining > 0 && remaining <= 60_000;

  const progress = useMemo(() => {
    if (!timer || timer.durationMs <= 0) return 0;
    return Math.max(0, Math.min(1, remaining / timer.durationMs));
  }, [remaining, timer]);

  const applyMinutes = () => {
    const parsed = Number.parseFloat(minutes.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onAction('set', clampMinutes(parsed) * 60_000);
    setMinutes('');
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-8 flex items-center gap-1.5 px-2 border transition-colors ${
          running
            ? low
              ? 'border-negative/60 text-negative bg-negative/10'
              : 'border-primary/60 text-primary bg-primary/10'
            : 'border-border text-muted hover:text-text hover:border-primary/40'
        }`}
        title="Таймер сессии"
      >
        <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
        {running || remaining > 0 ? (
          <span className="font-mono text-[11px] tabular-nums">{formatClock(remaining)}</span>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-wide hidden sm:inline">таймер</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[300] w-60 border border-border bg-deep/98 p-3 space-y-2 shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Таймер сессии</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-text"
              title="Скрыть"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="text-center font-mono text-2xl tabular-nums text-text py-1">
            {formatClock(remaining)}
          </div>

          <div className="h-1 bg-raised overflow-hidden">
            <div
              className={`h-full transition-[width] duration-500 ${low ? 'bg-negative' : 'bg-primary'}`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          {canControl ? (
            <>
              <div className="flex items-center gap-1">
                <input
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyMinutes();
                  }}
                  inputMode="decimal"
                  placeholder="минуты"
                  className="flex-1 h-8 bg-surface border border-border px-2 text-xs text-text outline-none focus:border-primary/60 font-mono"
                  title="Введите длительность в минутах"
                />
                <button
                  type="button"
                  onClick={applyMinutes}
                  className="h-8 px-2 text-[10px] font-mono uppercase border border-border text-muted hover:text-text hover:border-primary/50"
                  title="Применить длительность"
                >
                  ок
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAction(running ? 'pause' : 'start')}
                  className="flex-1 h-8 flex items-center justify-center gap-1.5 anime-btn-primary text-[11px]"
                >
                  {running ? (
                    <>
                      <Pause className="w-3.5 h-3.5" strokeWidth={1.5} /> пауза
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" strokeWidth={1.5} /> старт
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onAction('reset')}
                  className="h-8 w-9 flex items-center justify-center border border-border text-muted hover:text-text"
                  title="Сброс"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {[5, 10, 15, 25, 45].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onAction('set', preset * 60_000)}
                    className={`flex-1 h-6 text-[10px] font-mono border transition-colors ${
                      timer && Math.round(timer.durationMs / 60_000) === preset
                        ? 'border-primary/60 text-primary'
                        : 'border-border text-muted hover:text-text'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-muted leading-relaxed">
              Управляет таймером автор доски или участник с правом записи.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
