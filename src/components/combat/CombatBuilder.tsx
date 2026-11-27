import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Search, Shield, Skull, Swords, Timer, UserPlus, Users, X } from 'lucide-react';
import type { MonsterHpVisibility } from '../../lib/combatProtocol';
import { resolveImageUrl } from '../../lib/artwork';
import type {
  CombatCreatureOption,
  CombatNpcOption,
  CombatParticipantInput,
  CombatPlayerOption,
} from '../../lib/combat';

export interface CombatBuilderSubmit {
  name: string;
  turnTimerSeconds: number | null;
  settings: {
    allowPlayerTurn: boolean;
    showPlayerHp: boolean;
    showOtherDeathSaves: boolean;
    monsterHpVisibility: MonsterHpVisibility;
  };
  participants: CombatParticipantInput[];
}

interface CombatBuilderProps {
  players: CombatPlayerOption[];
  creatures: CombatCreatureOption[];
  /** НПС из вкладки «Связи» вместе с их боевым листом */
  npcs: CombatNpcOption[];
  mode: 'create' | 'add';
  busy?: boolean;
  onSubmit: (input: CombatBuilderSubmit) => void;
  onClose: () => void;
  /** В режиме add — существующие имена игроков, чтобы не дублировать */
  existingPlayerUserIds?: number[];
}

interface MonsterDraft {
  quantity: number;
  initiative: number;
  hidden: boolean;
  hideName: boolean;
}

interface PlayerDraft {
  selected: boolean;
  initiative: number;
}

interface NpcDraft {
  selected: boolean;
  initiative: number;
  hidden: boolean;
  hideName: boolean;
}

/**
 * Конструктор боя (только мастер).
 *
 * Читает существующий бестиарий (`/api/combats/bestiary`) и ростер кампании
 * (`/api/combats/members`), ничего в них не изменяя. Мобы добавляются пачками
 * с числом экземпляров; по умолчанию их HP/AC/стат-блок скрыты от игроков.
 */
export const CombatBuilder: React.FC<CombatBuilderProps> = ({
  players,
  creatures,
  npcs,
  mode,
  busy = false,
  onSubmit,
  onClose,
  existingPlayerUserIds = [],
}) => {
  const [name, setName] = useState(mode === 'create' ? 'Бой' : '');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState('60');
  const [allowPlayerTurn, setAllowPlayerTurn] = useState(false);
  const [showPlayerHp, setShowPlayerHp] = useState(true);
  const [showOtherDeathSaves, setShowOtherDeathSaves] = useState(false);
  const [monsterHpVisibility, setMonsterHpVisibility] = useState<MonsterHpVisibility>('bar');
  const [search, setSearch] = useState('');
  const [crFilter, setCrFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [playerDrafts, setPlayerDrafts] = useState<Record<number, PlayerDraft>>({});
  const [monsterDrafts, setMonsterDrafts] = useState<Record<number, MonsterDraft>>({});
  const [npcDrafts, setNpcDrafts] = useState<Record<number, NpcDraft>>({});
  const [npcSearch, setNpcSearch] = useState('');

  const filteredCreatures = useMemo(() => {
    const query = search.trim().toLowerCase();
    return creatures.filter((creature) => {
      if (query && !creature.name.toLowerCase().includes(query) && !creature.creatureType.toLowerCase().includes(query)) {
        return false;
      }
      if (crFilter === 'low') return creature.crNumeric <= 2;
      if (crFilter === 'mid') return creature.crNumeric > 2 && creature.crNumeric <= 8;
      if (crFilter === 'high') return creature.crNumeric > 8;
      return true;
    });
  }, [creatures, search, crFilter]);

  const selectedMonsters = useMemo(
    () => Object.entries(monsterDrafts).filter(([, draft]) => draft.quantity > 0),
    [monsterDrafts]
  );
  const selectedPlayers = useMemo(
    () => Object.entries(playerDrafts).filter(([, draft]) => draft.selected),
    [playerDrafts]
  );

  const filteredNpcs = useMemo(() => {
    const query = npcSearch.trim().toLowerCase();
    if (!query) return npcs;
    return npcs.filter((npc) =>
      `${npc.name} ${npc.role}`.toLowerCase().includes(query)
    );
  }, [npcs, npcSearch]);

  const selectedNpcs = useMemo(
    () => Object.entries(npcDrafts).filter(([, draft]) => draft.selected),
    [npcDrafts]
  );

  const toggleNpc = (npcId: number) => {
    setNpcDrafts((prev) => {
      const current = prev[npcId] ?? { selected: false, initiative: 0, hidden: true, hideName: false };
      return { ...prev, [npcId]: { ...current, selected: !current.selected } };
    });
  };

  const patchNpcDraft = (npcId: number, patch: Partial<NpcDraft>) => {
    setNpcDrafts((prev) => {
      const current = prev[npcId] ?? { selected: false, initiative: 0, hidden: true, hideName: false };
      return { ...prev, [npcId]: { ...current, ...patch } };
    });
  };

  const togglePlayer = (playerId: number) => {
    setPlayerDrafts((prev) => {
      const current = prev[playerId];
      return { ...prev, [playerId]: { selected: !current?.selected, initiative: current?.initiative ?? 0 } };
    });
  };

  const bumpMonster = (creatureId: number, delta: number) => {
    setMonsterDrafts((prev) => {
      const current = prev[creatureId] ?? { quantity: 0, initiative: 0, hidden: true, hideName: false };
      const quantity = Math.max(0, Math.min(20, current.quantity + delta));
      return { ...prev, [creatureId]: { ...current, quantity } };
    });
  };

  const submit = () => {
    const participants: CombatParticipantInput[] = [];

    for (const [userIdRaw, draft] of selectedPlayers) {
      const userId = Number(userIdRaw);
      const player = players.find((item) => item.userId === userId);
      if (!player) continue;
      const maxHp = player.hpMax > 0 ? player.hpMax : 10;
      const currentHp = player.hpMax > 0 ? Math.min(player.hpCurrent || maxHp, maxHp) : 10;
      participants.push({
        participantType: 'player',
        userId: player.userId,
        playerId: player.playerId,
        displayName: player.characterName || player.displayName,
        imageUrl: player.avatarUrl ?? undefined,
        initiativeValue: draft.initiative,
        maxHp,
        currentHp,
      });
    }

    for (const [creatureIdRaw, draft] of selectedMonsters) {
      const creatureId = Number(creatureIdRaw);
      const creature = creatures.find((item) => item.id === creatureId);
      if (!creature) continue;
      participants.push({
        participantType: 'monster',
        monsterBestiaryId: creature.id,
        displayName: creature.name,
        imageUrl: creature.imageUrl,
        initiativeValue: draft.initiative,
        isHiddenFromPlayers: draft.hidden,
        // Скрытый моб приходит игрокам как «Неизвестное существо» с силуэтом;
        // мастер может позже открыть имя отдельным переключателем.
        hideName: draft.hideName || draft.hidden,
        quantity: draft.quantity,
      });
    }

    for (const [npcIdRaw, draft] of selectedNpcs) {
      const npcId = Number(npcIdRaw);
      const npc = npcs.find((item) => item.id === npcId);
      if (!npc) continue;
      participants.push({
        participantType: 'npc',
        npcId: npc.id,
        displayName: npc.name,
        imageUrl: npc.imageKey ? resolveImageUrl(npc.imageKey, 'crown') : undefined,
        initiativeValue: draft.initiative,
        // Статы берутся из боевого листа, но мастер может поправить их
        // позже в шторке участника.
        maxHp: npc.sheet.hp ?? 10,
        currentHp: npc.sheet.hp ?? 10,
        armorClass: npc.sheet.ac,
        isHiddenFromPlayers: draft.hidden,
        hideName: draft.hideName || draft.hidden,
        statblock: npc.statblock,
        quantity: 1,
      });
    }

    onSubmit({
      name: name.trim() || 'Бой',
      turnTimerSeconds: timerEnabled ? Math.max(5, Number.parseInt(timerSeconds, 10) || 60) : null,
      settings: { allowPlayerTurn, showPlayerHp, showOtherDeathSaves, monsterHpVisibility },
      participants,
    });
  };

  const availablePlayers = players.filter((player) => !existingPlayerUserIds.includes(player.userId));

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="glass-panel hud-cut w-full max-w-4xl my-4">
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" strokeWidth={1.5} />
            <div>
              <div className="text-base text-text">
                {mode === 'create' ? 'Конструктор боя' : 'Добавить участников в бой'}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">
                игроки, НПС из «Связей» и существа из бестиария · стат-блоки скрыты от игроков
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center border border-border text-secondary hover:text-text"
            title="Закрыть"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {mode === 'create' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-mono uppercase tracking-wide text-secondary">Название боя</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full h-10 bg-deep border border-border px-2.5 text-sm text-text outline-none focus:border-primary/60"
                  placeholder="Засада на тракте"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wide text-secondary flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5" strokeWidth={1.75} /> Таймер хода
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTimerEnabled(false)}
                    className={`h-10 px-3 text-[11px] font-mono uppercase border ${
                      !timerEnabled ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted'
                    }`}
                  >
                    без таймера
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerEnabled(true)}
                    className={`h-10 px-3 text-[11px] font-mono uppercase border ${
                      timerEnabled ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted'
                    }`}
                  >
                    на ход
                  </button>
                  {timerEnabled && (
                    <input
                      value={timerSeconds}
                      onChange={(event) => setTimerSeconds(event.target.value)}
                      inputMode="numeric"
                      className="w-20 h-10 bg-deep border border-border px-2 text-sm font-mono text-text outline-none focus:border-primary/60"
                      placeholder="сек"
                      title="Секунд на ход"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {mode === 'create' && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-[11px] font-mono uppercase text-secondary">
                <input
                  type="checkbox"
                  checked={allowPlayerTurn}
                  onChange={(event) => setAllowPlayerTurn(event.target.checked)}
                  className="accent-cyan-400"
                />
                игрок может завершить свой ход
              </label>
              <label className="flex items-center gap-2 text-[11px] font-mono uppercase text-secondary">
                <input
                  type="checkbox"
                  checked={showPlayerHp}
                  onChange={(event) => setShowPlayerHp(event.target.checked)}
                  className="accent-cyan-400"
                />
                HP игроков видны всем
              </label>
              <label className="flex items-center gap-2 text-[11px] font-mono uppercase text-secondary">
                <input
                  type="checkbox"
                  checked={showOtherDeathSaves}
                  onChange={(event) => setShowOtherDeathSaves(event.target.checked)}
                  className="accent-cyan-400"
                />
                чужие спасброски видны
              </label>
              <label className="flex items-center gap-2 text-[11px] font-mono uppercase text-secondary sm:col-span-2">
                HP видимых мобов
                <select
                  value={monsterHpVisibility}
                  onChange={(event) => setMonsterHpVisibility(event.target.value as MonsterHpVisibility)}
                  className="h-9 bg-deep border border-border px-2 text-[11px] text-text outline-none"
                >
                  <option value="hidden">скрыто</option>
                  <option value="bar">полоса без чисел</option>
                  <option value="numbers">числа</option>
                </select>
              </label>
            </div>
          )}

          {/* Игроки */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary mb-2 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> Игроки партии
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {availablePlayers.length === 0 && (
                <div className="text-sm text-muted col-span-3">Все игроки уже в бою.</div>
              )}
              {availablePlayers.map((player) => {
                const draft = playerDrafts[player.userId];
                return (
                  <div
                    key={player.userId}
                    className={`flex items-center gap-2 p-2 border ${
                      draft?.selected ? 'border-primary/60 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePlayer(player.userId)}
                      className={`w-6 h-6 shrink-0 border flex items-center justify-center ${
                        draft?.selected ? 'border-primary text-primary' : 'border-border text-muted'
                      }`}
                      title="Включить в бой"
                    >
                      {draft?.selected ? '✓' : ''}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text truncate">{player.characterName || player.displayName}</div>
                      <div className="text-[11px] font-mono text-secondary truncate">
                        {player.charClass || 'класс не указан'} · ур. {player.level}
                        {player.hpMax > 0 ? ` · HP ${player.hpCurrent || player.hpMax}/${player.hpMax}` : ''}
                      </div>
                    </div>
                    <input
                      value={draft?.initiative ?? 0}
                      onChange={(event) =>
                        setPlayerDrafts((prev) => ({
                          ...prev,
                          [player.userId]: {
                            selected: prev[player.userId]?.selected ?? false,
                            initiative: Number.parseInt(event.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-12 h-9 bg-deep border border-border px-1.5 text-xs font-mono text-text outline-none focus:border-primary/60"
                      title="Инициатива"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* НПС из «Связей» */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wide text-secondary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" strokeWidth={1.75} /> НПС из «Связей»
              </div>
              <div className="relative">
                <Search className="w-3 h-3 text-muted absolute left-1.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                <input
                  value={npcSearch}
                  onChange={(event) => setNpcSearch(event.target.value)}
                  placeholder="поиск"
                  className="h-9 w-32 sm:w-48 bg-deep border border-border pl-7 pr-2 text-[11px] text-text outline-none focus:border-primary/60"
                />
              </div>
            </div>

            {npcs.length === 0 ? (
              <div className="border border-border p-3 text-[11px] text-muted">
                В «Связях» пока нет НПС. Создайте контакт и заполните его боевой лист — он появится здесь.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-border divide-y divide-border/60">
                {filteredNpcs.length === 0 && (
                  <div className="p-3 text-[11px] text-muted">Ничего не найдено по этому запросу.</div>
                )}
                {filteredNpcs.map((npc) => {
                  const draft = npcDrafts[npc.id];
                  return (
                    <div
                      key={npc.id}
                      className={`flex items-center gap-2 p-2 ${draft?.selected ? 'bg-primary/5' : 'hover:bg-raised/30'}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleNpc(npc.id)}
                        className={`w-6 h-6 shrink-0 border flex items-center justify-center ${
                          draft?.selected ? 'border-primary text-primary' : 'border-border text-muted'
                        }`}
                        title="Добавить НПС в бой"
                      >
                        {draft?.selected ? '✓' : ''}
                      </button>

                      <div className="w-10 h-10 shrink-0 bg-surface border border-border overflow-hidden">
                        {npc.imageKey ? (
                          <img
                            src={resolveImageUrl(npc.imageKey, 'crown')}
                            alt={npc.name}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">
                            <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-text truncate">
                          {npc.name}
                          {!npc.isRevealed && (
                            <span className="ml-1.5 text-[10px] font-mono uppercase text-warning/80">скрыт</span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-secondary truncate">
                          {npc.sheet.hp == null && npc.sheet.ac == null ? (
                            <span className="text-warning/80">лист пуст — НПС войдёт в бой с 10 HP</span>
                          ) : (
                            <>
                              {npc.role || 'роль не указана'} · КД {npc.sheet.ac ?? '—'} · HP {npc.sheet.hp ?? '—'}
                              {npc.sheet.cr ? ` · CR ${npc.sheet.cr}` : ''}
                            </>
                          )}
                        </div>
                      </div>

                      <input
                        value={draft?.initiative ?? 0}
                        onChange={(event) =>
                          patchNpcDraft(npc.id, { initiative: Number.parseInt(event.target.value, 10) || 0 })
                        }
                        className="w-12 h-9 bg-deep border border-border px-1.5 text-xs font-mono text-text outline-none focus:border-primary/60"
                        title={
                          npc.sheet.initiativeBonus != null
                            ? `Инициатива (бонус листа ${npc.sheet.initiativeBonus >= 0 ? '+' : ''}${npc.sheet.initiativeBonus})`
                            : 'Инициатива'
                        }
                      />

                      <button
                        type="button"
                        onClick={() => patchNpcDraft(npc.id, { hidden: !(draft?.hidden ?? true) })}
                        className={`w-8 h-8 flex items-center justify-center border ${
                          (draft?.hidden ?? true) ? 'border-warning/60 text-warning' : 'border-border text-muted'
                        }`}
                        title="Скрыть HP/AC/статы НПС от игроков"
                      >
                        {(draft?.hidden ?? true) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Мобы */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wide text-secondary flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5" strokeWidth={1.75} /> Существа из бестиария
              </div>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <Search className="w-3 h-3 text-muted absolute left-1.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="поиск"
                    className="h-9 w-32 sm:w-48 bg-deep border border-border pl-7 pr-2 text-[11px] text-text outline-none focus:border-primary/60"
                  />
                </div>
                <select
                  value={crFilter}
                  onChange={(event) => setCrFilter(event.target.value as 'all' | 'low' | 'mid' | 'high')}
                  className="h-9 bg-deep border border-border px-2 text-[11px] text-text outline-none"
                  title="Фильтр по CR"
                >
                  <option value="all">CR любой</option>
                  <option value="low">CR 0–2</option>
                  <option value="mid">CR 3–8</option>
                  <option value="high">CR 9+</option>
                </select>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-border divide-y divide-border/60">
              {filteredCreatures.length === 0 && (
                <div className="p-4 text-sm text-muted">Ничего не найдено. Бестиарий пуст или фильтр слишком узкий.</div>
              )}
              {filteredCreatures.map((creature) => {
                const draft = monsterDrafts[creature.id];
                return (
                  <div key={creature.id} className="flex items-center gap-2 p-2 hover:bg-raised/30">
                    <div className="w-10 h-10 shrink-0 bg-surface border border-border overflow-hidden">
                      {creature.imageUrl ? (
                        <img src={creature.imageUrl} alt={creature.name} className="w-full h-full object-cover object-top" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <Skull className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text truncate">{creature.name}</div>
                      <div className="text-[11px] font-mono text-secondary truncate">
                        CR {creature.cr} · {creature.creatureType} · AC {creature.ac} · HP {creature.hpRaw}
                      </div>
                    </div>

                    <input
                      value={draft?.initiative ?? 0}
                      onChange={(event) =>
                        setMonsterDrafts((prev) => ({
                          ...prev,
                          [creature.id]: {
                            ...(prev[creature.id] ?? { quantity: 0, hidden: true, hideName: false }),
                            initiative: Number.parseInt(event.target.value, 10) || 0,
                          },
                        }))
                      }
                      className="w-12 h-9 bg-deep border border-border px-1.5 text-xs font-mono text-text outline-none focus:border-primary/60"
                      title="Инициатива"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setMonsterDrafts((prev) => ({
                          ...prev,
                          [creature.id]: {
                            ...(prev[creature.id] ?? { quantity: 0, initiative: 0, hideName: false }),
                            hidden: !(prev[creature.id]?.hidden ?? true),
                          },
                        }))
                      }
                      className={`w-8 h-8 flex items-center justify-center border ${
                        (draft?.hidden ?? true) ? 'border-warning/60 text-warning' : 'border-border text-muted'
                      }`}
                      title="Скрыть HP/AC/стат-блок от игроков"
                    >
                      {(draft?.hidden ?? true) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => bumpMonster(creature.id, -1)}
                        className="w-7 h-9 border border-border text-secondary hover:text-text"
                        title="Меньше"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-mono text-sm text-text tabular-nums">
                        {draft?.quantity ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => bumpMonster(creature.id, 1)}
                        className="w-7 h-9 border border-border text-secondary hover:text-primary"
                        title="Добавить экземпляр"
                      >
                        <Plus className="w-2.5 h-2.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 px-4 py-3.5 border-t border-border">
          <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">
            выбрано: игроков {selectedPlayers.length} · НПС {selectedNpcs.length} · мобов{' '}
            {selectedMonsters.reduce((sum, [, draft]) => sum + draft.quantity, 0)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-sm border border-border text-secondary hover:text-text"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={
                busy ||
                (selectedPlayers.length === 0 && selectedMonsters.length === 0 && selectedNpcs.length === 0)
              }
              className="anime-btn-primary h-10 px-4 text-sm disabled:opacity-40"
            >
              {mode === 'create' ? 'Создать бой' : 'Добавить в бой'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
