/**
 * Протокол вкладки «Бой» — общие типы и правила D&D 5e для Worker и клиента.
 *
 * Модуль намеренно не зависит от DOM/D1, чтобы его могли импортировать
 * и `workers/combat-do.ts`, и React-компоненты.
 */

export type CombatStatus = 'setup' | 'active' | 'paused' | 'finished';
export type ParticipantType = 'player' | 'monster';
export type EffectType = 'condition' | 'exhaustion' | 'custom';
export type EffectDurationType = 'rounds' | 'until_save' | 'until_removed' | 'permanent';
export type MonsterHpVisibility = 'hidden' | 'bar' | 'numbers';

export type CombatActorRole = 'dm' | 'player';

export interface CombatActor {
  userId: number;
  role: CombatActorRole;
  playerId: number | null;
  displayName: string;
}

/* -------------------------------------------------------------------------- */
/*  Состояние боя                                                             */
/* -------------------------------------------------------------------------- */

export interface CombatSettings {
  turnTimerSeconds: number | null;
  turnTimerEndsAt: number | null;
  turnTimerPausedRemainingMs: number | null;
  allowPlayerTurn: boolean;
  showPlayerHp: boolean;
  showOtherDeathSaves: boolean;
  monsterHpVisibility: MonsterHpVisibility;
}

export interface CombatEffect {
  id: string;
  participantId: string;
  effectName: string;
  effectType: EffectType;
  exhaustionLevel: number;
  durationType: EffectDurationType | null;
  /** Для `rounds` — сколько раундов осталось */
  durationValue: number | null;
  description: string;
  isVisibleToPlayers: boolean;
  createdAt: number;
}

export interface DeathSavesView {
  successes: number;
  failures: number;
  stable: boolean;
}

/**
 * Участник боя в том виде, в котором его получает конкретный клиент.
 * Скрытые от игроков числа физически не отправляются — поля отсутствуют.
 */
export interface CombatParticipantView {
  id: string;
  participantType: ParticipantType;
  displayName: string;
  imageUrl: string;
  initiativeValue: number;
  initiativeOrder: number;
  isCurrent: boolean;
  /** Моб, чьи HP/AC/стат-блок скрыты от игроков */
  isHiddenFromPlayers: boolean;
  /** Имя скрыто от игроков («Неизвестное существо») */
  hideName: boolean;
  isDefeated: boolean;
  isYou: boolean;
  userId: number | null;
  playerId: number | null;
  monsterBestiaryId: number | null;
  /** null, если значение скрыто от этого зрителя */
  currentHp: number | null;
  maxHp: number | null;
  tempHp: number | null;
  armorClass: number | null;
  /** Процент HP для полосы без чисел */
  hpPercent: number | null;
  /** Можно ли показывать числа HP */
  hpNumbersVisible: boolean;
  deathSaves: DeathSavesView | null;
  exhaustionLevel: number;
  effects: CombatEffect[];
  /** Текст стат-блока — только мастеру */
  statblock: string | null;
  notes: string | null;
  /** CR/тип существа для подписи (публичные поля бестиария) */
  monsterMeta: { cr: string; creatureType: string; size: string } | null;
}

export interface CombatLogEntry {
  id: string;
  eventType: string;
  participantId: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface CombatView {
  id: string;
  campaignId: string;
  name: string;
  status: CombatStatus;
  currentTurnIndex: number;
  roundNumber: number;
  createdAt: number;
  updatedAt: number;
  createdBy: number;
  settings: CombatSettings;
  participants: CombatParticipantView[];
  log: CombatLogEntry[];
  /** true, если текущий зритель — мастер (полные данные) */
  isDm: boolean;
  /** Может ли этот зритель завершать ход */
  canAdvanceTurn: boolean;
}

export interface CombatSummary {
  id: string;
  name: string;
  status: CombatStatus;
  roundNumber: number;
  participantCount: number;
  updatedAt: number;
  createdAt: number;
  isDm: boolean;
  currentParticipantName: string | null;
}

export interface CombatRoomPeer {
  userId: number;
  displayName: string;
  role: CombatActorRole;
  color: string;
  avatarUrl: string | null;
  connectedAt: number;
}

/* -------------------------------------------------------------------------- */
/*  Правила 5e: условия, истощение, спасброски                                */
/* -------------------------------------------------------------------------- */

export interface ConditionRule {
  /** Каноническое английское имя из SRD — оно же хранится в БД */
  name: string;
  /** Русская подпись для интерфейса */
  label: string;
  description: string;
}

/** 14 стандартных состояний D&D 5e (SRD). */
export const DND_CONDITIONS: ConditionRule[] = [
  { name: 'Blinded', label: 'Ослеплён', description: 'Не видит, автоматически проваливает проверки, требующие зрения. Атаки по нему — с преимуществом, его атаки — с помехой.' },
  { name: 'Charmed', label: 'Очарован', description: 'Не может атаковать очаровавшего, тот получает преимущество на социальные проверки против него.' },
  { name: 'Deafened', label: 'Оглох', description: 'Не слышит, автоматически проваливает проверки, требующие слуха.' },
  { name: 'Frightened', label: 'Испуган', description: 'Помеха на проверки и атаки, пока источник страха в поле зрения; не может добровольно приближаться к нему.' },
  { name: 'Grappled', label: 'Схвачен', description: 'Скорость 0. Состояние заканчивается, если схвативший обездвижен.' },
  { name: 'Incapacitated', label: 'Недееспособен', description: 'Не может совершать действия и реакции.' },
  { name: 'Invisible', label: 'Невидим', description: 'Невозможно увидеть без магии; атаки по нему — с помехой, его атаки — с преимуществом.' },
  { name: 'Paralyzed', label: 'Парализован', description: 'Недееспособен, не может двигаться и говорить, автопровал спасбросков Силы и Ловкости. Атаки в упор — критические.' },
  { name: 'Petrified', label: 'Окаменел', description: 'Превращён в камень, недееспособен, скорость 0, сопротивление всем видам урона, иммунитет к яду и болезням.' },
  { name: 'Poisoned', label: 'Отравлен', description: 'Помеха на броски атаки и проверки характеристик.' },
  { name: 'Prone', label: 'Сбит с ног', description: 'Может только ползти. Атаки в упор — с преимуществом, дальние — с помехой; вставание стоит половину скорости.' },
  { name: 'Restrained', label: 'Опутан', description: 'Скорость 0, атаки по нему — с преимуществом, его атаки и спасброски Ловкости — с помехой.' },
  { name: 'Stunned', label: 'Оглушён', description: 'Недееспособен, не может двигаться, автопровал спасбросков Силы и Ловкости, атаки по нему — с преимуществом.' },
  { name: 'Unconscious', label: 'Без сознания', description: 'Недееспособен, не может двигаться и говорить, не замечает окружение. Атаки по нему — с преимуществом, в упор — критические.' },
];

export const conditionRule = (name: string): ConditionRule | undefined =>
  DND_CONDITIONS.find((rule) => rule.name.toLowerCase() === name.trim().toLowerCase());

/** Подпись условия: «Отравлен (Poisoned)» */
export const conditionLabel = (name: string): string => {
  const rule = conditionRule(name);
  return rule ? rule.label : name;
};

export const conditionDescription = (name: string): string => conditionRule(name)?.description ?? '';

/** Уровни истощения по правилам 5e (2014). */
export const EXHAUSTION_EFFECTS: Array<{ level: number; summary: string }> = [
  { level: 1, summary: 'Помеха на проверки характеристик' },
  { level: 2, summary: 'Скорость уменьшена вдвое' },
  { level: 3, summary: 'Помеха на броски атаки и спасброски' },
  { level: 4, summary: 'Максимум HP уменьшен вдвое' },
  { level: 5, summary: 'Скорость равна 0' },
  { level: 6, summary: 'Смерть' },
];

export const exhaustionSummary = (level: number): string[] =>
  EXHAUSTION_EFFECTS.filter((entry) => entry.level <= level).map((entry) => `ур. ${entry.level}: ${entry.summary}`);

export const MAX_EXHAUSTION = 6;
export const DEATH_SAVE_TARGET = 3;

/** Итоговое состояние спасбросков от смерти. */
export function deathSaveOutcome(successes: number, failures: number, stable: boolean): 'stable' | 'dead' | 'dying' {
  if (stable) return 'stable';
  if (failures >= DEATH_SAVE_TARGET) return 'dead';
  if (successes >= DEATH_SAVE_TARGET) return 'stable';
  return 'dying';
}

/** Цвет полосы HP в неоновой палитре: зелёный → жёлтый → красный. */
export function hpTone(currentHp: number, maxHp: number): 'positive' | 'warning' | 'negative' {
  if (maxHp <= 0) return 'negative';
  const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
  if (ratio > 0.6) return 'positive';
  if (ratio > 0.25) return 'warning';
  return 'negative';
}

/** Остаток таймера хода в миллисекундах (0 — истёк). */
export function turnTimerRemaining(settings: CombatSettings, now = Date.now()): number {
  if (!settings.turnTimerSeconds || settings.turnTimerSeconds <= 0) return 0;
  if (settings.turnTimerEndsAt) return Math.max(0, settings.turnTimerEndsAt - now);
  if (settings.turnTimerPausedRemainingMs != null) return Math.max(0, settings.turnTimerPausedRemainingMs);
  return settings.turnTimerSeconds * 1000;
}

export function formatSeconds(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Кто изображён в строке состояния — «Неизвестное существо» для скрытых мобов. */
export const DISPLAY_UNKNOWN_CREATURE = 'Неизвестное существо';
