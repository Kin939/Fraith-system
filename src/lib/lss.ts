import type { CharacterCoins, Spell } from './types';

export const LSS_ORIGIN = 'https://longstoryshort.app';
export const LSS_ALLOWED_ORIGINS = [LSS_ORIGIN];
export const LSS_CHARACTER_LIST_EMBED_URL = 'https://longstoryshort.app/iframe/characters/list/';
export const LSS_SCHEMA_V1_URL = 'https://longstoryshort.app/schema/v1/character.json';

export interface ParsedLssCharacter {
  characterName?: string;
  charClass?: string;
  subclass?: string;
  race?: string;
  level?: number;
  maxSpells?: number;
  coins?: Partial<CharacterCoins>;
  hpCurrent?: number;
  hpMax?: number;
  hpTemp?: number;
  notes?: string;
}

const CLASS_ALIASES: Record<string, string> = {
  wizard: 'Wizard',
  волшебник: 'Wizard',
  маг: 'Wizard',
  cleric: 'Cleric',
  жрец: 'Cleric',
  клирик: 'Cleric',
  sorcerer: 'Sorcerer',
  чародей: 'Sorcerer',
  warlock: 'Warlock',
  колдун: 'Warlock',
  bard: 'Bard',
  бард: 'Bard',
  druid: 'Druid',
  друид: 'Druid',
  paladin: 'Paladin',
  паладин: 'Paladin',
  ranger: 'Ranger',
  следопыт: 'Ranger',
  fighter: 'Fighter',
  воин: 'Fighter',
  rogue: 'Rogue',
  плут: 'Rogue',
  barbarian: 'Barbarian',
  варвар: 'Barbarian',
  monk: 'Monk',
  монах: 'Monk',
  artificer: 'Artificer',
  изобретатель: 'Artificer',
};

export const DND_CLASS_LABELS_RU: Record<string, string> = {
  Wizard: 'Волшебник',
  Cleric: 'Жрец',
  Sorcerer: 'Чародей',
  Warlock: 'Колдун',
  Bard: 'Бард',
  Druid: 'Друид',
  Paladin: 'Паладин',
  Ranger: 'Следопыт',
  Fighter: 'Воин',
  Rogue: 'Плут',
  Barbarian: 'Варвар',
  Monk: 'Монах',
  Artificer: 'Изобретатель',
};

export const CANONICAL_TO_DNDSU_CLASS_ID: Record<string, number> = {
  Barbarian: 11,
  Bard: 12,
  Cleric: 13,
  Fighter: 14,
  Monk: 15,
  Paladin: 16,
  Ranger: 17,
  Rogue: 18,
  Sorcerer: 19,
  Warlock: 20,
  Wizard: 21,
  Druid: 22,
  Artificer: 23,
};

export const MAGIC_SCHOOL_LABELS_RU: Record<string, string> = {
  Abjuration: 'Ограждение',
  Conjuration: 'Вызов',
  Divination: 'Прорицание',
  Enchantment: 'Очарование',
  Evocation: 'Воплощение',
  Illusion: 'Иллюзия',
  Necromancy: 'Некромантия',
  Transmutation: 'Преобразование',
  Ограждение: 'Ограждение',
  Вызов: 'Вызов',
  Прорицание: 'Прорицание',
  Очарование: 'Очарование',
  Воплощение: 'Воплощение',
  Иллюзия: 'Иллюзия',
  Некромантия: 'Некромантия',
  Преобразование: 'Преобразование',
};

export function normalizeDndClass(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const firstToken = raw
    .split(/[,/|(]/)[0]
    .trim()
    .toLowerCase()
    .replace(/\s+\d+$/, '');
  if (!firstToken) return undefined;
  if (CLASS_ALIASES[firstToken]) {
    return CLASS_ALIASES[firstToken];
  }
  for (const [alias, canonical] of Object.entries(CLASS_ALIASES)) {
    if (firstToken.includes(alias)) return canonical;
  }
  return raw.trim();
}

export function extractPlayerCanonicalClasses(charClassRaw?: string | null): string[] {
  if (!charClassRaw) return [];
  return charClassRaw
    .split(/[,/|;]/)
    .map((part) => normalizeDndClass(part))
    .filter((c): c is string => Boolean(c));
}

/**
 * Checks whether a spell from dnd.su (or custom DM spell) can be learned by a character
 * based on their class(es) OR subclass parent class in `spell.subclasses` (e.g. `клятвопреступник (паладин)`).
 */
export function isSpellAllowedForCharacter(
  spell: Pick<Spell, 'classes' | 'subclasses'>,
  charClassRaw?: string | null,
  subclassRaw?: string | null
): boolean {
  const playerClasses = extractPlayerCanonicalClasses(charClassRaw);
  if (playerClasses.length === 0) return false;

  // If spell has no class restriction listed (e.g. special/universal homebrew), allow any caster
  if ((!spell.classes || spell.classes.length === 0) && !spell.subclasses) {
    return true;
  }

  const spellCanonical = new Set<string>();
  for (const c of spell.classes || []) {
    const norm = normalizeDndClass(c);
    if (norm) spellCanonical.add(norm.toLowerCase());
  }

  // Also check parent classes in `subclasses`, e.g. `круг земли (друид), клятва мести (паладин)`
  if (spell.subclasses) {
    const subLower = spell.subclasses.toLowerCase();
    if (subclassRaw && subclassRaw.trim().length > 2) {
      const playerSubLower = subclassRaw.trim().toLowerCase();
      if (subLower.includes(playerSubLower)) {
        return true;
      }
    }
    const parenMatches = spell.subclasses.matchAll(/\(([^)]+)\)/g);
    for (const m of parenMatches) {
      const norm = normalizeDndClass(m[1]);
      if (norm) spellCanonical.add(norm.toLowerCase());
    }
  }

  return playerClasses.some((pc) => spellCanonical.has(pc.toLowerCase()));
}

function readVal(field: unknown): unknown {
  if (field && typeof field === 'object' && 'value' in (field as Record<string, unknown>)) {
    return (field as Record<string, unknown>).value;
  }
  return field;
}

function toInt(val: unknown): number | undefined {
  const unwrapped = readVal(val);
  if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) {
    return Math.trunc(unwrapped);
  }
  if (typeof unwrapped === 'string' && unwrapped.trim() !== '') {
    const parsed = Number.parseInt(unwrapped.trim(), 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function toStr(val: unknown): string | undefined {
  const unwrapped = readVal(val);
  if (typeof unwrapped === 'string' && unwrapped.trim().length > 0) {
    return unwrapped.trim();
  }
  if (Array.isArray(unwrapped)) {
    const parts = unwrapped
      .map((item) => (typeof item === 'string' ? item : ''))
      .filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
  }
  if (unwrapped && typeof unwrapped === 'object') {
    const obj = unwrapped as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      return extractPlainTextFromRichNode(obj.data);
    }
    if (Array.isArray(obj.content)) {
      return extractPlainTextFromRichNode(obj);
    }
  }
  return undefined;
}

function extractPlainTextFromRichNode(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const rec = node as Record<string, unknown>;
  let out = typeof rec.text === 'string' ? rec.text : '';
  if (Array.isArray(rec.content)) {
    const children = rec.content.map(extractPlainTextFromRichNode).filter(Boolean);
    out += (out ? '\n' : '') + children.join(rec.type === 'doc' ? '\n' : ' ');
  }
  return out.trim();
}

/**
 * Parses both:
 * 1) Long Story Short v1 character schema (`https://longstoryshort.app/schema/v1/character.json`)
 * 2) Native LSS exported `.json` files (where `data` or `json` is a serialized JSON string)
 */
export function parseLssCharacterPayload(rawInput: unknown): ParsedLssCharacter {
  let root: Record<string, unknown> = {};

  if (typeof rawInput === 'string') {
    root = JSON.parse(rawInput) as Record<string, unknown>;
  } else if (rawInput && typeof rawInput === 'object') {
    root = rawInput as Record<string, unknown>;
  } else {
    throw new Error('Некорректный формат JSON персонажа LSS');
  }

  let sheet: Record<string, unknown> = root;
  if (typeof root.data === 'string') {
    try {
      sheet = JSON.parse(root.data) as Record<string, unknown>;
    } catch {
      sheet = root;
    }
  } else if (root.data && typeof root.data === 'object') {
    sheet = root.data as Record<string, unknown>;
  } else if (typeof root.json === 'string') {
    try {
      sheet = JSON.parse(root.json) as Record<string, unknown>;
    } catch {
      sheet = root;
    }
  }

  const info = (sheet.info && typeof sheet.info === 'object' ? sheet.info : {}) as Record<
    string,
    unknown
  >;
  const vitality = (
    sheet.vitality && typeof sheet.vitality === 'object'
      ? sheet.vitality
      : sheet.health && typeof sheet.health === 'object'
        ? sheet.health
        : sheet.hp && typeof sheet.hp === 'object'
          ? sheet.hp
          : {}
  ) as Record<string, unknown>;

  const coinsObj = (
    sheet.coins && typeof sheet.coins === 'object'
      ? sheet.coins
      : sheet.currency && typeof sheet.currency === 'object'
        ? sheet.currency
        : {}
  ) as Record<string, unknown>;

  const textObj = (sheet.text && typeof sheet.text === 'object' ? sheet.text : {}) as Record<
    string,
    unknown
  >;

  const characterName = toStr(sheet.name) ?? toStr(info.name) ?? toStr(root.name);
  const rawClass =
    toStr(info.charClass) ??
    toStr(sheet.charClass) ??
    toStr(sheet.class) ??
    (Array.isArray(sheet.classes) && sheet.classes[0] && typeof sheet.classes[0] === 'object'
      ? toStr((sheet.classes[0] as Record<string, unknown>).name)
      : undefined);

  const charClass = normalizeDndClass(rawClass);
  const subclass = toStr(info.charSubclass) ?? toStr(sheet.subclass);
  const race = toStr(info.race) ?? toStr(sheet.race);
  const level = toInt(info.level) ?? toInt(sheet.level);

  const hpCurrent =
    toInt(vitality['hp-current']) ?? toInt(vitality.current) ?? toInt(sheet.hpCurrent);
  const hpMax = toInt(vitality['hp-max']) ?? toInt(vitality.max) ?? toInt(sheet.hpMax);
  const hpTemp = toInt(vitality['hp-temp']) ?? toInt(vitality.temp) ?? toInt(sheet.hpTemp);

  const coins: Partial<CharacterCoins> = {};
  const cp = toInt(coinsObj.cp);
  const sp = toInt(coinsObj.sp);
  const ep = toInt(coinsObj.ep);
  const gp = toInt(coinsObj.gp);
  const pp = toInt(coinsObj.pp);
  if (cp !== undefined) coins.cp = cp;
  if (sp !== undefined) coins.sp = sp;
  if (ep !== undefined) coins.ep = ep;
  if (gp !== undefined) coins.gp = gp;
  if (pp !== undefined) coins.pp = pp;

  const noteSections = [
    toStr(sheet.notes),
    toStr(textObj.notes),
    toStr(textObj.other),
    toStr(textObj.features),
    toStr(textObj.background),
  ].filter(Boolean);

  const notes = noteSections.length > 0 ? noteSections.join('\n\n') : undefined;
  const maxSpells =
    toInt(sheet.maxSpells) ??
    (level !== undefined ? Math.max(6, level + 4) : 10);

  return {
    characterName,
    charClass,
    subclass,
    race,
    level,
    maxSpells,
    coins: Object.keys(coins).length > 0 ? coins : undefined,
    hpCurrent,
    hpMax,
    hpTemp,
    notes,
  };
}
