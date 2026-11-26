import { apiFetch } from './api';
import type { CombatLogEntry, CombatSummary, CombatView, MonsterHpVisibility } from './combatProtocol';

/** Клиент вкладки «Бой»: REST-обёртки над /api/combats/*. */

export interface CombatPlayerOption {
  userId: number;
  playerId: number | null;
  username: string;
  displayName: string;
  characterName: string;
  charClass: string;
  race: string;
  level: number;
  /** HP из листа персонажа (0 — не заполнено) */
  hpCurrent: number;
  hpMax: number;
  avatarUrl: string | null;
}

export interface CombatCreatureOption {
  id: number;
  name: string;
  cr: string;
  crNumeric: number;
  creatureType: string;
  size: string;
  ac: number;
  hpAverage: number;
  hpDice: string;
  hpRaw: string;
  imageUrl: string;
  isRevealed: boolean;
  statblock: string;
}

export interface CombatParticipantInput {
  participantType: 'player' | 'monster';
  userId?: number | null;
  playerId?: number | null;
  monsterBestiaryId?: number | null;
  displayName?: string;
  imageUrl?: string;
  initiativeValue?: number;
  currentHp?: number;
  maxHp?: number;
  armorClass?: number | null;
  isHiddenFromPlayers?: boolean;
  hideName?: boolean;
  statblock?: string;
  quantity?: number;
}

export interface CombatSettingsInput {
  turnTimerSeconds?: number | null;
  allowPlayerTurn?: boolean;
  showPlayerHp?: boolean;
  showOtherDeathSaves?: boolean;
  monsterHpVisibility?: MonsterHpVisibility;
}

export const listCombats = () => apiFetch<{ combats: CombatSummary[]; isDm: boolean }>('/api/combats');

export const getCombat = (combatId: string) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}`);

export const createCombat = (input: {
  name: string;
  turnTimerSeconds?: number | null;
  settings?: CombatSettingsInput;
  participants: CombatParticipantInput[];
}) =>
  apiFetch<{ combat: CombatView }>('/api/combats', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const patchCombat = (
  combatId: string,
  input: { name?: string; status?: CombatView['status']; settings?: CombatSettingsInput }
) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteCombat = (combatId: string) =>
  apiFetch<{ ok: boolean }>(`/api/combats/${encodeURIComponent(combatId)}`, { method: 'DELETE' });

export const addParticipants = (combatId: string, participants: CombatParticipantInput[]) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participants }),
  });

export const patchParticipant = (
  combatId: string,
  participantId: string,
  input: {
    displayName?: string;
    initiativeValue?: number;
    currentHp?: number;
    maxHp?: number;
    tempHp?: number;
    hpDelta?: number;
    armorClass?: number | null;
    isHiddenFromPlayers?: boolean;
    hideName?: boolean;
    notes?: string;
  }
) =>
  apiFetch<{ combat: CombatView }>(
    `/api/combats/${encodeURIComponent(combatId)}/participants/${encodeURIComponent(participantId)}`,
    { method: 'PATCH', body: JSON.stringify(input) }
  );

/** Патч участника — те же поля, что принимает PATCH /combats/:id/participants/:pid. */
export type CombatParticipantPatch = Parameters<typeof patchParticipant>[2];

export const deleteParticipant = (combatId: string, participantId: string) =>
  apiFetch<{ combat: CombatView }>(
    `/api/combats/${encodeURIComponent(combatId)}/participants/${encodeURIComponent(participantId)}`,
    { method: 'DELETE' }
  );

export const addEffect = (
  combatId: string,
  input: {
    participantId: string;
    effectName: string;
    effectType?: 'condition' | 'custom' | 'exhaustion';
    exhaustionLevel?: number;
    durationType?: 'rounds' | 'until_save' | 'until_removed' | 'permanent' | null;
    durationValue?: number | null;
    description?: string;
    isVisibleToPlayers?: boolean;
  }
) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}/effects`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const removeEffect = (combatId: string, effectId: string) =>
  apiFetch<{ combat: CombatView }>(
    `/api/combats/${encodeURIComponent(combatId)}/effects/${encodeURIComponent(effectId)}`,
    { method: 'DELETE' }
  );

export const nextTurn = (combatId: string) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}/next-turn`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const timerAction = (
  combatId: string,
  input: { action: 'configure' | 'pause' | 'reset' | 'extend'; seconds?: number | null }
) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}/timer`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const setDeathSaves = (
  combatId: string,
  input: { participantId: string; kind?: 'success' | 'failure'; stable?: boolean }
) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}/death-saves`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const setExhaustion = (combatId: string, participantId: string, level: number) =>
  apiFetch<{ combat: CombatView }>(`/api/combats/${encodeURIComponent(combatId)}/exhaustion`, {
    method: 'POST',
    body: JSON.stringify({ participantId, level }),
  });

export const loadCombatLog = (combatId: string) =>
  apiFetch<{ log: CombatLogEntry[] }>(`/api/combats/${encodeURIComponent(combatId)}/log`);

/** Данные конструктора: существа из существующего бестиария + ростер игроков. */
export const loadBuilderData = () =>
  Promise.all([
    apiFetch<{ creatures: CombatCreatureOption[] }>('/api/combats/bestiary'),
    apiFetch<{ players: CombatPlayerOption[] }>('/api/combats/members'),
  ]).then(([bestiary, members]) => ({ creatures: bestiary.creatures, players: members.players }));
