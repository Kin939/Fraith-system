import type { NpcAbilities, NpcSheet } from './types';

/**
 * Боевой лист НПС (вкладка «Связи» + трекер «Бой»).
 *
 * Хранится как JSON в `campaign_npcs.sheet_json`; одна и та же нормализация
 * используется и на клиенте (предпросмотр), и в воркере (запись в D1) — файл
 * чистый, без DOM, поэтому его можно подключить в tsconfig.worker.json.
 */

export const NPC_ABILITY_KEYS: Array<{ key: keyof NpcAbilities; short: string; label: string }> = [
  { key: 'str', short: 'СИЛ', label: 'Сила' },
  { key: 'dex', short: 'ЛОВ', label: 'Ловкость' },
  { key: 'con', short: 'ТЕЛ', label: 'Телосложение' },
  { key: 'int', short: 'ИНТ', label: 'Интеллект' },
  { key: 'mud', short: 'МДР', label: 'Мудрость' },
  { key: 'cha', short: 'ХАР', label: 'Харизма' },
];

export const NPC_SHEET_TEXT_LIMIT = 4000;

export function createEmptyNpcSheet(): NpcSheet {
  return {
    ac: null,
    hp: null,
    hitDice: '',
    speed: '',
    cr: '',
    initiativeBonus: null,
    abilities: { str: null, dex: null, con: null, int: null, mud: null, cha: null },
    saves: '',
    skills: '',
    senses: '',
    languages: '',
    traits: '',
    actions: '',
    bonusActions: '',
    reactions: '',
    legendary: '',
  };
}

function clampInt(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function clampText(value: unknown, limit = NPC_SHEET_TEXT_LIMIT): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

/** Приводит любой вход (тело запроса, JSON из D1) к валидному NpcSheet. */
export function normalizeNpcSheet(raw: unknown): NpcSheet {
  const empty = createEmptyNpcSheet();
  if (!raw || typeof raw !== 'object') return empty;
  const source = raw as Record<string, unknown>;
  const abilitiesRaw =
    source.abilities && typeof source.abilities === 'object'
      ? (source.abilities as Record<string, unknown>)
      : {};

  return {
    ac: clampInt(source.ac, 0, 40),
    hp: clampInt(source.hp, 0, 9999),
    hitDice: clampText(source.hitDice, 40),
    speed: clampText(source.speed, 80),
    cr: clampText(source.cr, 16),
    initiativeBonus: clampInt(source.initiativeBonus, -20, 20),
    abilities: {
      str: clampInt(abilitiesRaw.str, 0, 40),
      dex: clampInt(abilitiesRaw.dex, 0, 40),
      con: clampInt(abilitiesRaw.con, 0, 40),
      int: clampInt(abilitiesRaw.int, 0, 40),
      mud: clampInt(abilitiesRaw.mud, 0, 40),
      cha: clampInt(abilitiesRaw.cha, 0, 40),
    },
    saves: clampText(source.saves, 200),
    skills: clampText(source.skills, 300),
    senses: clampText(source.senses, 300),
    languages: clampText(source.languages, 300),
    traits: clampText(source.traits),
    actions: clampText(source.actions),
    bonusActions: clampText(source.bonusActions),
    reactions: clampText(source.reactions),
    legendary: clampText(source.legendary),
  };
}

export function parseNpcSheetJson(raw: string | null | undefined): NpcSheet {
  if (!raw) return createEmptyNpcSheet();
  try {
    return normalizeNpcSheet(JSON.parse(raw) as unknown);
  } catch {
    return createEmptyNpcSheet();
  }
}

export function serializeNpcSheet(sheet: NpcSheet): string {
  return JSON.stringify(normalizeNpcSheet(sheet));
}

/** Есть ли в листе хоть что-то, кроме пустых полей. */
export function npcSheetHasStats(sheet: NpcSheet | null | undefined): boolean {
  if (!sheet) return false;
  return (
    sheet.ac != null ||
    sheet.hp != null ||
    Boolean(sheet.speed || sheet.cr || sheet.saves || sheet.skills) ||
    Boolean(sheet.traits || sheet.actions || sheet.bonusActions || sheet.reactions || sheet.legendary) ||
    Object.values(sheet.abilities).some((value) => value != null)
  );
}

/** Модификатор характеристики в стиле 5e (10 → +0, 8 → −1). */
export function abilityModifier(value: number | null): string {
  if (value == null) return '—';
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Текст стат-блока для трекера боя: только мастеру, поэтому можно писать
 * всё как есть — включая тактику и легендарные действия.
 */
export function npcSheetToStatblock(sheet: NpcSheet, name: string): string {
  const lines: string[] = [];
  const head: string[] = [];
  if (sheet.cr) head.push(`CR ${sheet.cr}`);
  head.push(`КД ${sheet.ac ?? '—'}`);
  head.push(`HP ${sheet.hp ?? '—'}${sheet.hitDice ? ` (${sheet.hitDice})` : ''}`);
  if (sheet.speed) head.push(`скорость ${sheet.speed}`);
  if (sheet.initiativeBonus != null) head.push(`инициатива ${abilityModifier(10 + sheet.initiativeBonus * 2)}`);
  lines.push(`${name} — ${head.join(' · ')}`);

  const abilities = NPC_ABILITY_KEYS.map(({ key, short }) => {
    const value = sheet.abilities[key];
    return `${short} ${value ?? '—'} (${abilityModifier(value)})`;
  });
  if (Object.values(sheet.abilities).some((value) => value != null)) {
    lines.push(abilities.join(' · '));
  }

  const meta: string[] = [];
  if (sheet.saves) meta.push(`Спасброски: ${sheet.saves}`);
  if (sheet.skills) meta.push(`Навыки: ${sheet.skills}`);
  if (sheet.senses) meta.push(`Чувства: ${sheet.senses}`);
  if (sheet.languages) meta.push(`Языки: ${sheet.languages}`);
  if (meta.length > 0) lines.push(meta.join('\n'));

  const blocks: Array<[string, string]> = [
    ['Особенности', sheet.traits],
    ['Действия', sheet.actions],
    ['Бонусные действия', sheet.bonusActions],
    ['Реакции', sheet.reactions],
    ['Легендарные действия', sheet.legendary],
  ];
  for (const [label, body] of blocks) {
    if (body) lines.push(`${label}:\n${body}`);
  }

  return lines.join('\n\n');
}
