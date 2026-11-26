import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  History,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Skull,
  Swords,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCampaignStore } from '../lib/store';
import type { CombatSummary, CombatView } from '../lib/combatProtocol';
import {
  addEffect,
  addParticipants,
  createCombat,
  deleteCombat,
  deleteParticipant,
  getCombat,
  listCombats,
  loadBuilderData,
  loadCombatLog,
  nextTurn,
  patchCombat,
  patchParticipant,
  removeEffect,
  setDeathSaves,
  setExhaustion,
  timerAction,
  type CombatCreatureOption,
  type CombatPlayerOption,
} from '../lib/combat';
import { useCombatSocket } from '../hooks/useCombatSocket';
import { useCombatState } from '../hooks/useCombatState';
import { InitiativeTracker } from '../components/combat/InitiativeTracker';
import { TurnTimer } from '../components/combat/TurnTimer';
import { CombatBuilder, type CombatBuilderSubmit } from '../components/combat/CombatBuilder';
import type { ParticipantCardHandlers } from '../components/combat/ParticipantCard';
import { PeerAvatar } from '../components/common/PeerAvatar';
import type { CombatLogEntry } from '../lib/combatProtocol';

/**
 * Вкладка «Бой» — конструктор боёв и трекер инициативы.
 *
 * Мастер собирает бой из игроков кампании и существ существующего бестиария,
 * задаёт инициативу и запускает трекер. Все изменения мгновенно уходят через
 * CombatRoom (Durable Object) остальным участникам; игроки получают урезанное
 * состояние — без HP/AC/стат-блоков скрытых мобов.
 */
export const CombatPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [combats, setCombats] = useState<CombatSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<CombatView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<'create' | 'add'>('create');
  const [builderData, setBuilderData] = useState<{ players: CombatPlayerOption[]; creatures: CombatCreatureOption[] }>({
    players: [],
    creatures: [],
  });
  const [builderLoading, setBuilderLoading] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<CombatLogEntry[]>([]);

  const socket = useCombatSocket({ combatId: selectedId, enabled: Boolean(selectedId), initialState });
  const state = socket.state;
  const derived = useCombatState(state);
  const isDm = state?.isDm ?? user?.role === 'dm';
  const readOnly = state?.status === 'finished';

  const notify = useCallback(
    (title: string, message: string, variant: 'info' | 'error' | 'success' | 'warning' = 'info') => {
      pushToast({ title, message, variant });
    },
    [pushToast]
  );

  const refreshList = useCallback(async () => {
    try {
      const data = await listCombats();
      setCombats(data.combats);
      return data.combats;
    } catch (err) {
      notify('Не удалось загрузить бои', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadCombat = useCallback(
    async (combatId: string) => {
      try {
        const data = await getCombat(combatId);
        setInitialState(data.combat);
      } catch (err) {
        setInitialState(null);
        const message = err instanceof Error ? err.message : 'Попробуйте снова';
        if (!message.includes('не начат')) {
          notify('Не удалось открыть бой', message, 'error');
        }
      }
    },
    [notify]
  );

  useEffect(() => {
    void (async () => {
      const list = await refreshList();
      if (list.length > 0) {
        const preferred = list.find((combat) => combat.status === 'active') ?? list[0];
        setSelectedId((prev) => prev ?? preferred.id);
      }
    })();
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) {
      setInitialState(null);
      return;
    }
    setInitialState(null);
    void loadCombat(selectedId);
  }, [selectedId, loadCombat]);

  // Игрок не может открыть бой в подготовке, поэтому лёгкий опрос списка
  // подхватывает бой, который мастер начал уже после открытия вкладки.
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshList().then((list) => {
        if (list.length === 0) return;
        const current = list.find((combat) => combat.id === selectedId);
        if (!current) {
          const active = list.find((combat) => combat.status === 'active');
          if (active) setSelectedId(active.id);
          return;
        }
        if (current.status !== 'active') {
          const active = list.find((combat) => combat.status === 'active');
          if (active && current.status === 'finished') setSelectedId(active.id);
        }
      });
    }, 12_000);
    return () => clearInterval(interval);
  }, [refreshList, selectedId]);

  // Тост, если синхронизация отвалилась
  useEffect(() => {
    if (socket.lastError) notify('Синхронизация боя', socket.lastError, 'warning');
  }, [socket.lastError, notify]);

  const mergeCombat = useCallback((combat: CombatView | null | undefined) => {
    if (combat) socket.setState(combat);
  }, [socket]);

  const run = useCallback(
    async (fn: () => Promise<{ combat: CombatView }>, successMessage?: string) => {
      setBusy(true);
      try {
        const data = await fn();
        mergeCombat(data.combat);
        void refreshList();
        if (successMessage) notify(successMessage, 'Изменения уже у всех участников боя', 'success');
      } catch (err) {
        notify('Действие не выполнено', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
      } finally {
        setBusy(false);
      }
    },
    [mergeCombat, notify, refreshList]
  );

  /* --------------------------------------------------------------- handlers */

  const handlers: ParticipantCardHandlers = useMemo(
    () => ({
      onHpDelta: (participantId, delta) => {
        if (!selectedId) return;
        void run(() => patchParticipant(selectedId, participantId, { hpDelta: delta }));
      },
      onSetHp: (participantId, value, maxHp) => {
        if (!selectedId) return;
        void run(() => patchParticipant(selectedId, participantId, { currentHp: value, maxHp }));
      },
      onSetTempHp: (participantId, value) => {
        if (!selectedId) return;
        void run(() => patchParticipant(selectedId, participantId, { tempHp: value }));
      },
      onSetInitiative: (participantId, value) => {
        if (!selectedId) return;
        void run(() => patchParticipant(selectedId, participantId, { initiativeValue: value }));
      },
      onUpdate: (participantId, patch) => {
        if (!selectedId) return;
        void run(() => patchParticipant(selectedId, participantId, patch));
      },
      onAddEffect: (participantId, input) => {
        if (!selectedId) return;
        void run(() =>
          addEffect(selectedId, {
            participantId,
            effectName: input.effectName,
            effectType: input.effectType ?? 'condition',
            durationType: input.durationType ?? null,
            durationValue: input.durationValue ?? null,
            description: input.description,
            isVisibleToPlayers: input.isVisibleToPlayers ?? true,
          })
        );
      },
      onRemoveEffect: (effectId) => {
        if (!selectedId) return;
        void run(() => removeEffect(selectedId, effectId));
      },
      onExhaustion: (participantId, level) => {
        if (!selectedId) return;
        void run(() => setExhaustion(selectedId, participantId, level));
      },
      onDeathSave: (participantId, kind) => {
        if (!selectedId) return;
        void run(() => setDeathSaves(selectedId, { participantId, kind }));
      },
      onStabilize: (participantId, stable) => {
        if (!selectedId) return;
        void run(() => setDeathSaves(selectedId, { participantId, stable }));
      },
      onRemove: (participantId) => {
        if (!selectedId) return;
        void run(() => deleteParticipant(selectedId, participantId));
      },
    }),
    [selectedId, run]
  );

  const openBuilder = async (mode: 'create' | 'add') => {
    setBuilderMode(mode);
    setBuilderOpen(true);
    if (builderData.players.length === 0 && builderData.creatures.length === 0) {
      setBuilderLoading(true);
      try {
        const data = await loadBuilderData();
        setBuilderData(data);
      } catch (err) {
        notify('Не удалось загрузить бестиарий', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
      } finally {
        setBuilderLoading(false);
      }
    }
  };

  const submitBuilder = async (input: CombatBuilderSubmit) => {
    try {
      if (builderMode === 'create') {
        const data = await createCombat({
          name: input.name,
          turnTimerSeconds: input.turnTimerSeconds,
          settings: input.settings,
          participants: input.participants,
        });
        setBuilderOpen(false);
        if (data.combat) {
          setInitialState(data.combat);
          setSelectedId(data.combat.id);
        }
        await refreshList();
        notify('Бой создан', 'Проверьте инициативу и нажмите «Начать бой»', 'success');
      } else if (selectedId) {
        const data = await addParticipants(selectedId, input.participants);
        mergeCombat(data.combat);
        setBuilderOpen(false);
        notify('Участники добавлены', '', 'success');
      }
    } catch (err) {
      notify('Не удалось сохранить бой', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const changeStatus = (status: 'active' | 'paused' | 'finished' | 'setup') => {
    if (!selectedId) return;
    const labels: Record<string, string> = {
      active: 'Бой начался',
      paused: 'Бой приостановлен',
      finished: 'Бой завершён',
      setup: 'Бой сброшен',
    };
    void run(() => patchCombat(selectedId, { status }), labels[status]);
  };

  const onDeleteCombat = async () => {
    if (!selectedId) return;
    if (!window.confirm('Удалить бой и всю его историю?')) return;
    try {
      await deleteCombat(selectedId);
      setSelectedId(null);
      setInitialState(null);
      await refreshList();
      notify('Бой удалён', '', 'info');
    } catch (err) {
      notify('Не удалось удалить бой', err instanceof Error ? err.message : 'Попробуйте снова', 'error');
    }
  };

  const toggleLog = async () => {
    if (!selectedId) return;
    if (logOpen) {
      setLogOpen(false);
      return;
    }
    try {
      const data = await loadCombatLog(selectedId);
      setLog(data.log);
      setLogOpen(true);
    } catch {
      setLogOpen(true);
    }
  };

  const currentName = derived.current?.displayName ?? null;
  const statusLabel: Record<string, string> = {
    setup: 'подготовка',
    active: 'идёт бой',
    paused: 'пауза',
    finished: 'завершён',
  };

  if (!user) return null;

  return (
    <div className="space-y-3">
      {/* Шапка вкладки */}
      <div className="glass-panel hud-cut px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Swords className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <div className="text-sm text-text truncate">{state?.name ?? 'Бой'}</div>
            <div className="text-[10px] font-mono uppercase tracking-wide text-muted">
              {state ? `${statusLabel[state.status]} · раунд ${state.roundNumber}` : 'трекер инициативы'}
            </div>
          </div>
        </div>

        {/* Переключатель боёв */}
        {combats.length > 1 && (
          <div className="relative">
            <select
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(event.target.value || null)}
              className="h-8 max-w-[16rem] bg-deep border border-border pl-2 pr-6 text-[11px] text-text outline-none focus:border-primary/60 appearance-none"
              title="Выбрать бой"
            >
              {combats.map((combat) => (
                <option key={combat.id} value={combat.id}>
                  {combat.name} · {statusLabel[combat.status] ?? combat.status}
                  {combat.currentParticipantName ? ` · ${combat.currentParticipantName}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        <span
          className={`h-7 px-2 flex items-center gap-1 border text-[10px] font-mono uppercase ${
            socket.status === 'open' ? 'border-positive/40 text-positive' : 'border-warning/40 text-warning'
          }`}
          title={socket.status === 'open' ? 'Синхронизация активна' : 'Переподключение…'}
        >
          {socket.status === 'open' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {socket.status === 'open' ? 'live' : 'sync'}
        </span>

        {socket.peers.length > 0 && (
          <div className="flex items-center gap-1">
            {socket.peers.slice(0, 6).map((peer) => (
              <PeerAvatar
                key={peer.userId}
                name={peer.displayName}
                color={peer.color}
                avatarUrl={peer.avatarUrl}
                size={22}
                crown={peer.role === 'dm'}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {isDm && state && state.status === 'setup' && (
            <button
              type="button"
              onClick={() => changeStatus('active')}
              disabled={busy || state.participants.length === 0}
              className="anime-btn-primary h-8 px-2.5 text-[10px] font-mono uppercase flex items-center gap-1 disabled:opacity-40"
            >
              <Play className="w-3 h-3" strokeWidth={2} /> начать бой
            </button>
          )}
          {isDm && state && state.status === 'active' && (
            <button
              type="button"
              onClick={() => changeStatus('paused')}
              className="h-8 px-2 text-[10px] font-mono uppercase border border-border text-muted hover:text-warning flex items-center gap-1"
            >
              <Pause className="w-3 h-3" strokeWidth={2} /> пауза
            </button>
          )}
          {isDm && state && state.status === 'paused' && (
            <button
              type="button"
              onClick={() => changeStatus('active')}
              className="h-8 px-2 text-[10px] font-mono uppercase border border-border text-muted hover:text-positive flex items-center gap-1"
            >
              <Play className="w-3 h-3" strokeWidth={2} /> продолжить
            </button>
          )}
          {isDm && state && state.status !== 'finished' && (
            <button
              type="button"
              onClick={() => changeStatus('finished')}
              className="h-8 px-2 text-[10px] font-mono uppercase border border-border text-muted hover:text-negative flex items-center gap-1"
              title="Завершить бой (трекер станет read-only)"
            >
              <ShieldAlert className="w-3 h-3" strokeWidth={2} /> завершить
            </button>
          )}
          {isDm && state && state.status === 'finished' && (
            <button
              type="button"
              onClick={() => changeStatus('setup')}
              className="h-8 px-2 text-[10px] font-mono uppercase border border-border text-muted hover:text-primary flex items-center gap-1"
              title="Вернуть бой в подготовку с теми же участниками"
            >
              <RotateCcw className="w-3 h-3" strokeWidth={2} /> сбросить
            </button>
          )}
          {isDm && state && state.status !== 'finished' && (
            <button
              type="button"
              onClick={() => void openBuilder('add')}
              className="h-8 px-2 text-[10px] font-mono uppercase border border-border text-muted hover:text-primary flex items-center gap-1"
            >
              <Skull className="w-3 h-3" strokeWidth={2} /> участники
            </button>
          )}
          {isDm && (
            <button
              type="button"
              onClick={() => void openBuilder('create')}
              className="h-8 px-2.5 text-[10px] font-mono uppercase border border-primary/50 text-primary hover:bg-primary/10"
            >
              + новый бой
            </button>
          )}
          {isDm && state && (
            <button
              type="button"
              onClick={toggleLog}
              className={`w-8 h-8 flex items-center justify-center border ${
                logOpen ? 'border-primary/60 text-primary' : 'border-border text-muted hover:text-text'
              }`}
              title="Журнал боя"
            >
              <History className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
          {isDm && state && (
            <button
              type="button"
              onClick={() => void onDeleteCombat()}
              className="w-8 h-8 flex items-center justify-center border border-border text-muted hover:text-negative"
              title="Удалить бой"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Таймер хода */}
      {state && state.settings.turnTimerSeconds && (
        <TurnTimer
          totalSeconds={state.settings.turnTimerSeconds}
          remainingMs={derived.remaining}
          running={Boolean(state.settings.turnTimerEndsAt)}
          paused={derived.timerPaused}
          expired={derived.timerExpired}
          canControl={isDm && state.status !== 'finished'}
          onStart={() => selectedId && void run(() => timerAction(selectedId, { action: 'reset' }))}
          onPause={() => selectedId && void run(() => timerAction(selectedId, { action: 'pause' }))}
          onReset={() => selectedId && void run(() => timerAction(selectedId, { action: 'reset' }))}
          onExtend={() => selectedId && void run(() => timerAction(selectedId, { action: 'extend', seconds: 30 }))}
        />
      )}

      {/* Основная область */}
      {loading && !state ? (
        <div className="glass-panel hud-cut p-8 flex items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Загрузка боя…
        </div>
      ) : !state ? (
        <div className="glass-panel hud-cut p-6 text-center space-y-2">
          <Swords className="w-5 h-5 text-primary mx-auto" strokeWidth={1.5} />
          <div className="text-sm text-text">Активных боёв нет</div>
          <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
            {isDm
              ? 'Соберите бой из игроков партии и существ бестиария, задайте инициативу и нажмите «Начать бой» — трекер появится у всех участников.'
              : 'Мастер ещё не начал бой. Как только бой начнётся, здесь появится трекер инициативы.'}
          </p>
          {isDm && (
            <button type="button" onClick={() => void openBuilder('create')} className="anime-btn-primary px-3 py-1.5 text-xs">
              Создать бой
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-3 ${isDm ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
          <div className="min-h-[26rem]">
            <InitiativeTracker
              state={state}
              participants={derived.sorted}
              peers={socket.peers}
              currentName={currentName}
              readOnly={readOnly}
              canAdvanceTurn={state.canAdvanceTurn}
              onNextTurn={() => selectedId && void run(() => nextTurn(selectedId))}
              handlers={handlers}
            />
          </div>

          {isDm && (
            <aside className="space-y-3 min-w-0">
              <div className="glass-panel hud-cut p-3 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wide text-secondary">Настройки боя</div>
                <label className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase text-muted">
                  игрок завершает ход
                  <input
                    type="checkbox"
                    checked={state.settings.allowPlayerTurn}
                    onChange={(event) =>
                      selectedId &&
                      void run(() =>
                        patchCombat(selectedId, { settings: { allowPlayerTurn: event.target.checked } })
                      )
                    }
                    className="accent-cyan-400"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase text-muted">
                  HP игроков видны
                  <input
                    type="checkbox"
                    checked={state.settings.showPlayerHp}
                    onChange={(event) =>
                      selectedId &&
                      void run(() => patchCombat(selectedId, { settings: { showPlayerHp: event.target.checked } }))
                    }
                    className="accent-cyan-400"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase text-muted">
                  чужие спасброски
                  <input
                    type="checkbox"
                    checked={state.settings.showOtherDeathSaves}
                    onChange={(event) =>
                      selectedId &&
                      void run(() =>
                        patchCombat(selectedId, { settings: { showOtherDeathSaves: event.target.checked } })
                      )
                    }
                    className="accent-cyan-400"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase text-muted">
                  HP мобов
                  <select
                    value={state.settings.monsterHpVisibility}
                    onChange={(event) =>
                      selectedId &&
                      void run(() =>
                        patchCombat(selectedId, {
                          settings: {
                            monsterHpVisibility: event.target.value as 'hidden' | 'bar' | 'numbers',
                          },
                        })
                      )
                    }
                    className="h-6 bg-deep border border-border px-1 text-[10px] text-text outline-none"
                  >
                    <option value="hidden">скрыто</option>
                    <option value="bar">полоса</option>
                    <option value="numbers">числа</option>
                  </select>
                </label>
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase text-muted">
                  таймер
                  <select
                    value={state.settings.turnTimerSeconds ?? 0}
                    onChange={(event) =>
                      selectedId &&
                      void run(() =>
                        patchCombat(selectedId, {
                          settings: { turnTimerSeconds: Number(event.target.value) || null },
                        })
                      )
                    }
                    className="h-6 bg-deep border border-border px-1 text-[10px] text-text outline-none"
                  >
                    <option value={0}>без таймера</option>
                    <option value={30}>30 с</option>
                    <option value={60}>60 с</option>
                    <option value={90}>90 с</option>
                    <option value={120}>120 с</option>
                    <option value={180}>180 с</option>
                  </select>
                </div>
              </div>

              {logOpen && (
                <div className="glass-panel hud-cut p-3 space-y-1 max-h-72 overflow-y-auto">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-secondary">Журнал боя</div>
                  {log.length === 0 && <div className="text-[10px] text-muted">Пока пусто.</div>}
                  {log.map((entry) => (
                    <div key={entry.id} className="text-[9px] font-mono text-muted flex gap-1.5">
                      <span className="text-muted/60 shrink-0">
                        {new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="truncate">
                        {entry.eventType}
                        {typeof entry.payload.name === 'string' ? ` · ${entry.payload.name}` : ''}
                        {typeof entry.payload.delta === 'number' ? ` · ${entry.payload.delta}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {builderOpen && (
        <CombatBuilder
          players={builderData.players}
          creatures={builderData.creatures}
          mode={builderMode}
          busy={builderLoading || busy}
          existingPlayerUserIds={(state?.participants ?? [])
            .filter((participant) => participant.participantType === 'player' && participant.userId != null)
            .map((participant) => participant.userId as number)}
          onSubmit={(input) => void submitBuilder(input)}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
};

export default CombatPage;
