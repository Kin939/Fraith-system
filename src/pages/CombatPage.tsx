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
import { CombatHistoryModal } from '../components/combat/CombatHistoryModal';
import { ParticipantEditor } from '../components/combat/ParticipantEditor';
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

/** Строка настройки в боковой панели: подпись слева, контрол справа. */
const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 min-h-9">
    <span className="text-[11px] font-mono uppercase tracking-wide text-secondary">{label}</span>
    {children}
  </div>
);

/** Компактный тумблер в стиле HUD. */
const Toggle: React.FC<{ checked: boolean; onChange: (value: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 border relative shrink-0 ${checked ? 'border-primary/70 bg-primary/10' : 'border-border'}`}
    title={checked ? 'Включено' : 'Выключено'}
  >
    <span className={`absolute top-0.5 w-4 h-4 transition-all ${checked ? 'right-0.5 bg-primary' : 'left-0.5 bg-secondary/60'}`} />
  </button>
);

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  /**
   * Мгновенный отклик: сначала правим HP локально, потом отправляем на сервер.
   * Авторитетный ответ DO всё равно придёт по WebSocket и заменит локальную оценку.
   */
  const applyLocalHp = useCallback(
    (participantId: string, delta: number) => {
      const current = socket.state;
      if (!current) return;
      const participants = current.participants.map((item) => {
        if (item.id !== participantId || item.currentHp == null || item.maxHp == null) return item;
        const next = Math.max(0, Math.min(item.maxHp, item.currentHp + delta));
        return {
          ...item,
          currentHp: next,
          hpPercent: item.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((next / item.maxHp) * 100))) : item.hpPercent,
        };
      });
      socket.setState({ ...current, participants });
    },
    [socket]
  );

  const handlers: ParticipantCardHandlers = useMemo(
    () => ({
      onHpDelta: (participantId, delta) => {
        if (!selectedId) return;
        applyLocalHp(participantId, delta);
        void run(() => patchParticipant(selectedId, participantId, { hpDelta: delta }));
      },
      onOpenEditor: (participantId) => setEditingId(participantId),
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
    [selectedId, run, applyLocalHp]
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

  const editingParticipant = useMemo(
    () => (state?.participants ?? []).find((participant) => participant.id === editingId) ?? null,
    [state, editingId]
  );
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
      <div className="glass-panel hud-cut px-3.5 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Swords className="w-5 h-5 text-primary shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <div className="text-base leading-tight text-text truncate">{state?.name ?? 'Бой'}</div>
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">
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
              className="h-10 max-w-[18rem] bg-deep border border-border pl-2.5 pr-7 text-xs text-text outline-none focus:border-primary/60 appearance-none"
              title="Выбрать бой"
            >
              {combats.map((combat) => (
                <option key={combat.id} value={combat.id}>
                  {combat.name} · {statusLabel[combat.status] ?? combat.status}
                  {combat.currentParticipantName ? ` · ${combat.currentParticipantName}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-primary hover:border-primary/50 flex items-center gap-1.5"
          title="Архив завершённых боёв"
        >
          <History className="w-4 h-4" strokeWidth={1.75} /> история
        </button>

        <span
          className={`h-8 px-2.5 flex items-center gap-1.5 border text-[11px] font-mono uppercase ${
            socket.status === 'open' ? 'border-positive/40 text-positive' : 'border-warning/40 text-warning'
          }`}
          title={socket.status === 'open' ? 'Синхронизация активна' : 'Переподключение…'}
        >
          {socket.status === 'open' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {socket.status === 'open' ? 'live' : 'sync'}
        </span>

        {socket.peers.length > 0 && (
          <div className="flex items-center gap-1.5">
            {socket.peers.slice(0, 6).map((peer) => (
              <PeerAvatar
                key={peer.userId}
                name={peer.displayName}
                color={peer.color}
                avatarUrl={peer.avatarUrl}
                size={26}
                crown={peer.role === 'dm'}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {isDm && state && state.status === 'setup' && (
            <button
              type="button"
              onClick={() => changeStatus('active')}
              disabled={busy || state.participants.length === 0}
              className="anime-btn-primary h-10 px-3.5 text-[11px] font-mono uppercase flex items-center gap-1.5 disabled:opacity-40"
            >
              <Play className="w-4 h-4" strokeWidth={2} /> начать бой
            </button>
          )}
          {isDm && state && state.status === 'active' && (
            <button
              type="button"
              onClick={() => changeStatus('paused')}
              className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-warning hover:border-warning/50 flex items-center gap-1.5"
            >
              <Pause className="w-4 h-4" strokeWidth={2} /> пауза
            </button>
          )}
          {isDm && state && state.status === 'paused' && (
            <button
              type="button"
              onClick={() => changeStatus('active')}
              className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-positive hover:border-positive/50 flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" strokeWidth={2} /> продолжить
            </button>
          )}
          {isDm && state && state.status !== 'finished' && (
            <button
              type="button"
              onClick={() => changeStatus('finished')}
              className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-negative hover:border-negative/50 flex items-center gap-1.5"
              title="Завершить бой (трекер станет read-only)"
            >
              <ShieldAlert className="w-4 h-4" strokeWidth={2} /> завершить
            </button>
          )}
          {isDm && state && state.status === 'finished' && (
            <button
              type="button"
              onClick={() => changeStatus('setup')}
              className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-primary flex items-center gap-1.5"
              title="Вернуть бой в подготовку с теми же участниками"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2} /> сбросить
            </button>
          )}
          {isDm && state && state.status !== 'finished' && (
            <button
              type="button"
              onClick={() => void openBuilder('add')}
              className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-primary hover:border-primary/50 flex items-center gap-1.5"
            >
              <Skull className="w-4 h-4" strokeWidth={2} /> участники
            </button>
          )}
          {isDm && (
            <button
              type="button"
              onClick={() => void openBuilder('create')}
              className="h-10 px-3.5 text-[11px] font-mono uppercase border border-primary/50 text-primary hover:bg-primary/10"
            >
              + новый бой
            </button>
          )}
          {isDm && state && (
            <button
              type="button"
              onClick={toggleLog}
              className={`h-10 w-10 flex items-center justify-center border ${
                logOpen ? 'border-primary/60 text-primary' : 'border-border text-secondary hover:text-text'
              }`}
              title="Журнал боя"
            >
              <History className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          {isDm && state && (
            <button
              type="button"
              onClick={() => void onDeleteCombat()}
              className="h-10 w-10 flex items-center justify-center border border-border text-secondary hover:text-negative hover:border-negative/50"
              title="Удалить бой"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
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
        <div className="glass-panel hud-cut p-10 flex items-center justify-center gap-2.5 text-sm text-muted">
          <Loader2 className="w-5 h-5 animate-spin" /> Загрузка боя…
        </div>
      ) : !state ? (
        <div className="glass-panel hud-cut p-8 text-center space-y-3">
          <Swords className="w-6 h-6 text-primary mx-auto" strokeWidth={1.5} />
          <div className="text-base text-text">Активных боёв нет</div>
          <p className="text-sm text-secondary leading-relaxed max-w-lg mx-auto">
            {isDm
              ? 'Соберите бой из игроков партии и существ бестиария, задайте инициативу и нажмите «Начать бой» — трекер появится у всех участников.'
              : 'Мастер ещё не начал бой. Как только бой начнётся, здесь появится трекер инициативы.'}
          </p>
          {isDm && (
            <button
              type="button"
              onClick={() => void openBuilder('create')}
              className="anime-btn-primary h-10 px-4 text-sm"
            >
              Создать бой
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-3 ${isDm ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
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
              <div className="glass-panel hud-cut p-3.5 space-y-2.5">
                <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">Настройки боя</div>

                <SettingRow label="Игрок завершает ход">
                  <Toggle
                    checked={state.settings.allowPlayerTurn}
                    onChange={(value) =>
                      selectedId && void run(() => patchCombat(selectedId, { settings: { allowPlayerTurn: value } }))
                    }
                  />
                </SettingRow>

                <SettingRow label="HP игроков видны всем">
                  <Toggle
                    checked={state.settings.showPlayerHp}
                    onChange={(value) =>
                      selectedId && void run(() => patchCombat(selectedId, { settings: { showPlayerHp: value } }))
                    }
                  />
                </SettingRow>

                <SettingRow label="Чужие спасброски">
                  <Toggle
                    checked={state.settings.showOtherDeathSaves}
                    onChange={(value) =>
                      selectedId &&
                      void run(() => patchCombat(selectedId, { settings: { showOtherDeathSaves: value } }))
                    }
                  />
                </SettingRow>

                <SettingRow label="HP мобов">
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
                    className="h-9 bg-deep border border-border px-2 text-[11px] text-text outline-none focus:border-primary/60"
                  >
                    <option value="hidden">скрыто</option>
                    <option value="bar">полоса</option>
                    <option value="numbers">числа</option>
                  </select>
                </SettingRow>

                <SettingRow label="Таймер хода">
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
                    className="h-9 bg-deep border border-border px-2 text-[11px] text-text outline-none focus:border-primary/60"
                  >
                    <option value={0}>без таймера</option>
                    <option value={30}>30 с</option>
                    <option value={60}>60 с</option>
                    <option value={90}>90 с</option>
                    <option value={120}>120 с</option>
                    <option value={180}>180 с</option>
                  </select>
                </SettingRow>
              </div>

              {logOpen && (
                <div className="glass-panel hud-cut p-3.5 space-y-1.5 max-h-80 overflow-y-auto">
                  <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">Журнал боя</div>
                  {log.length === 0 && <div className="text-[11px] text-muted">Пока пусто.</div>}
                  {log.map((entry) => (
                    <div key={entry.id} className="text-[11px] font-mono text-secondary flex gap-2">
                      <span className="text-muted shrink-0">
                        {new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="truncate">
                        {LOG_LABELS[entry.eventType] ?? entry.eventType}
                        {typeof entry.payload.name === 'string' ? ` · ${entry.payload.name}` : ''}
                        {typeof entry.payload.delta === 'number' ? ` · ${entry.payload.delta}` : ''}
                        {typeof entry.payload.hp === 'number' ? ` → ${entry.payload.hp}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {historyOpen && <CombatHistoryModal onClose={() => setHistoryOpen(false)} />}

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

      {editingId && editingParticipant && (
        <ParticipantEditor
          participant={editingParticipant}
          handlers={handlers}
          readOnly={readOnly}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );

};

export default CombatPage;
