import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  ScrollText,
  Shield,
  Skull,
  Swords,
  X,
} from 'lucide-react';
import { loadCombatHistory, loadCombatLog, type CombatHistoryEntry } from '../../lib/combat';
import type { CombatLogEntry } from '../../lib/combatProtocol';

interface CombatHistoryModalProps {
  onClose: () => void;
}

const LOG_LABELS: Record<string, string> = {
  combat_started: 'бой начат',
  combat_paused: 'пауза',
  combat_finished: 'бой завершён',
  combat_reset: 'сброс',
  round_start: 'новый раунд',
  turn_start: 'ход начат',
  turn_end: 'ход завершён',
  damage: 'урон',
  heal: 'лечение',
  hp_set: 'HP изменены',
  temp_hp: 'временные HP',
  death_save: 'спасбросок от смерти',
  stabilized: 'стабилизация',
  exhaustion_changed: 'истощение',
  effect_added: 'эффект добавлен',
  effect_removed: 'эффект снят',
  participant_added: 'участник добавлен',
  participant_removed: 'участник убран',
  participant_updated: 'участник изменён',
  timer_configured: 'таймер настроен',
  timer_paused: 'таймер на паузе',
  timer_restarted: 'таймер перезапущен',
  timer_extended: 'таймер продлён',
};

function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: number, end: number): string {
  const diff = Math.max(0, end - start);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'меньше минуты';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

/**
 * Архив боёв: список завершённых сражений и их журнал в режиме чтения.
 * Журнал живого боя сервер по-прежнему отдаёт только мастеру.
 */
export const CombatHistoryModal: React.FC<CombatHistoryModalProps> = ({ onClose }) => {
  const [combats, setCombats] = useState<CombatHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [log, setLog] = useState<CombatLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await loadCombatHistory();
        if (!alive) return;
        setCombats(data.combats);
        if (data.combats.length > 0) setSelectedId(data.combats[0].id);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Не удалось загрузить архив');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setLog([]);
      return;
    }
    let alive = true;
    setLogLoading(true);
    setLogError(null);
    void loadCombatLog(selectedId)
      .then((data) => {
        if (alive) setLog(data.log);
      })
      .catch((err: unknown) => {
        if (alive) setLogError(err instanceof Error ? err.message : 'Журнал недоступен');
      })
      .finally(() => {
        if (alive) setLogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const selected = useMemo(
    () => combats.find((combat) => combat.id === selectedId) ?? null,
    [combats, selectedId]
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/75 p-3 sm:p-6">
      <div className="glass-panel hud-cut w-full max-w-5xl">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Swords className="w-5 h-5 text-primary shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-medium text-text">История боёв</h3>
            <p className="text-[11px] font-mono uppercase tracking-wide text-secondary">
              завершённых сражений: {combats.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center border border-border text-secondary hover:text-text hover:border-negative/60 transition-colors"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> Загружаем архив…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-secondary">
            <AlertTriangle className="w-6 h-6 text-warning" strokeWidth={1.5} />
            {error}
          </div>
        ) : combats.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ScrollText className="w-7 h-7 text-muted" strokeWidth={1.25} />
            <p className="text-sm text-secondary">
              Завершённых боёв пока нет. Нажмите «Завершить» в трекере — бой переедет сюда.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:divide-x divide-border">
            <ul className="md:col-span-5 max-h-[60vh] overflow-y-auto divide-y divide-border">
              {combats.map((combat) => {
                const active = combat.id === selectedId;
                return (
                  <li key={combat.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(combat.id)}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-2.5 ${
                        active ? 'bg-raised' : 'hover:bg-raised/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm truncate ${active ? 'text-text font-medium' : 'text-secondary'}`}
                            title={combat.name}
                          >
                            {combat.name}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-muted flex flex-wrap gap-x-2 gap-y-0.5">
                          <span>{formatDateTime(combat.finishedAt)}</span>
                          <span className="text-border">·</span>
                          <span>раундов: {combat.roundNumber}</span>
                          <span className="text-border">·</span>
                          <span>{formatDuration(combat.startedAt, combat.finishedAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-secondary">
                          <span className="inline-flex items-center gap-1">
                            <Shield className="w-3 h-3" strokeWidth={1.75} />
                            {combat.participantCount - combat.defeatedCount}
                          </span>
                          <span className="inline-flex items-center gap-1 text-negative/80">
                            <Skull className="w-3 h-3" strokeWidth={1.75} />
                            {combat.defeatedCount}
                          </span>
                          <span className="text-muted">событий: {combat.eventCount}</span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 mt-1 shrink-0 ${active ? 'text-primary' : 'text-muted'}`}
                        strokeWidth={1.75}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="md:col-span-7 max-h-[60vh] overflow-y-auto px-4 py-3 space-y-3">
              {selected ? (
                <>
                  <div>
                    <h4 className="text-sm font-medium text-text">{selected.name}</h4>
                    <p className="text-[11px] font-mono text-muted">
                      {formatDateTime(selected.startedAt)} → {formatDateTime(selected.finishedAt)} ·
                      раундов {selected.roundNumber}
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wide text-secondary mb-1.5">
                      Участники
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.participants.map((participant) => (
                        <span
                          key={participant.id}
                          className={`h-7 px-2 inline-flex items-center gap-1.5 border text-[11px] ${
                            participant.isDefeated
                              ? 'border-negative/40 text-negative/80 line-through'
                              : 'border-border text-secondary'
                          }`}
                          title={`${participant.type === 'monster' ? 'существо' : 'персонаж'}${
                            participant.maxHp ? ` · ${participant.currentHp ?? 0}/${participant.maxHp} HP` : ''
                          }`}
                        >
                          {participant.type === 'monster' ? (
                            <Skull className="w-3 h-3" strokeWidth={1.75} />
                          ) : (
                            <Shield className="w-3 h-3" strokeWidth={1.75} />
                          )}
                          {participant.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wide text-secondary mb-1.5">
                      Журнал
                    </div>
                    {logLoading ? (
                      <div className="flex items-center gap-2 text-[11px] text-muted py-6">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                        Читаем журнал…
                      </div>
                    ) : logError ? (
                      <p className="text-[11px] text-warning py-4">{logError}</p>
                    ) : log.length === 0 ? (
                      <p className="text-[11px] text-muted py-4">Журнал пуст.</p>
                    ) : (
                      <ol className="space-y-1">
                        {[...log].reverse().map((entry) => (
                          <li
                            key={entry.id}
                            className="text-[11px] font-mono text-secondary flex gap-2 border-b border-border/40 pb-1"
                          >
                            <span className="text-muted shrink-0 tabular-nums">
                              {new Date(entry.createdAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="min-w-0 break-words">
                              {LOG_LABELS[entry.eventType] ?? entry.eventType}
                              {typeof entry.payload.name === 'string' ? ` · ${entry.payload.name}` : ''}
                              {typeof entry.payload.delta === 'number' ? ` · ${entry.payload.delta}` : ''}
                              {typeof entry.payload.hp === 'number' ? ` → ${entry.payload.hp}` : ''}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted py-10 text-center">Выберите бой из списка.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
