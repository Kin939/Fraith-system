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

export interface DndHomebrewClassMeta {
  id: number;
  key: string;
  labelRu: string;
  labelLower: string;
  source: string;
  url: string;
  archetypes: string[];
}

export const DND_OFFICIAL_CLASS_LABELS_RU: Record<string, string> = {
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

export const DND_HOMEBREW_CLASSES_META: DndHomebrewClassMeta[] = [
  {
    id: 395,
    key: 'Alchemist',
    labelRu: 'Алхимик',
    labelLower: 'алхимик',
    source: "Valda's Spire of Secrets",
    url: 'https://dnd.su/homebrew/class/395-alchemist/',
    archetypes: [
      'Аморист',
      'Апотекарий',
      'Безумный бомбардир',
      'Динамо-инженер',
      'Иксолог',
      'Ксеноалхимик',
      'Метаморф',
      'Мутагенист',
      'Парфюмер',
      'Травник',
      'Ядовар',
    ],
  },
  {
    id: 853,
    key: 'AlternateBarbarian',
    labelRu: 'Альтернативный Варвар',
    labelLower: 'альтернативный варвар',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/853-alternate-barbarian/',
    archetypes: [
      'Путь берсерка',
      'Путь грубой силы',
      'Путь звериного сердца',
      'Путь природы',
      'Путь фанатика',
      'Путь чародейства',
      'Путь чемпиона',
    ],
  },
  {
    id: 382,
    key: 'AlternateFighter',
    labelRu: 'Альтернативный Воин',
    labelLower: 'альтернативный воин',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/382-alternate-fighter/',
    archetypes: [
      'Витязь',
      'Кавалерист',
      'Колдовской клинок',
      'Командир',
      'Крестоносец',
      'Лучник леса',
      'Мастер битвы',
      'Мастер клинка',
      'Мастер меча',
      'Мастер щита',
      'Мистик',
      'Мистический рыцарь',
      'Морской пехотинец',
      'Партизан',
      'Полководец',
      'Рыцарь рун',
      'Рыцарь эхо',
      'Самурай',
      'Стрелок',
      'Танцор с мечами',
      'Фехтовальщик',
      'Хранитель пламени',
    ],
  },
  {
    id: 391,
    key: 'AlternateMonk',
    labelRu: 'Альтернативный монах',
    labelLower: 'альтернативный монах',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/391-alternate-monk/',
    archetypes: [
      'Путь астрального тела',
      'Путь восходящего дракона',
      'Путь Ву Чжень',
      'Путь долгой смерти',
      'Путь жнеца',
      'Путь инь и ян',
      'Путь кэнсэя',
      'Путь открытой ладони',
      'Путь пьяного мастера',
      'Путь света',
      'Путь тени',
    ],
  },
  {
    id: 857,
    key: 'AlternateRogue',
    labelRu: 'Альтернативный Плут',
    labelLower: 'альтернативный плут',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/857-alternate-rogue/',
    archetypes: [
      'Ассасин',
      'Вор',
      'Головорез',
      'Дуэлянт',
      'Искатель',
      'Каратель',
      'Комбинатор',
      'Кровавый клинок',
      'Лазутчик',
      'Мистический ловкач',
      'Скаут',
      'Сыщик',
      'Фантом',
      'Шут',
    ],
  },
  {
    id: 403,
    key: 'Warlord',
    labelRu: 'Воевода',
    labelLower: 'воевода',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/403-warlord/',
    archetypes: [
      'Академия благородства',
      'Академия интриг',
      'Академия отваги',
      'Академия поклонения',
      'Академия порядка',
      'Академия рыцарства',
      'Академия свирепости',
      'Академия тактики',
    ],
  },
  {
    id: 472,
    key: 'Jaeger',
    labelRu: 'Егерь',
    labelLower: 'егерь',
    source: "Steinhardt's Guide to the Eldritch Hunt",
    url: 'https://dnd.su/homebrew/class/472-jaeger/',
    archetypes: [
      'Орден Абсолюта',
      'Орден Еретиков',
      'Орден Кровопускателей',
      'Орден Мара',
      'Орден Сапёров',
      'Орден Спасения',
    ],
  },
  {
    id: 565,
    key: 'Stargazer',
    labelRu: 'Звездочёт',
    labelLower: 'звездочёт',
    source: 'morethanwordscansay',
    url: 'https://dnd.su/homebrew/class/565-stargazer/',
    archetypes: ['Трин Воды', 'Трин Воздуха', 'Трин Земли', 'Трин Огня'],
  },
  {
    id: 195,
    key: 'BloodHunter',
    labelRu: 'Кровавый охотник',
    labelLower: 'кровавый охотник',
    source: 'Matt Mercer / Critical Role',
    url: 'https://dnd.su/homebrew/class/195-blood-hunter/',
    archetypes: [
      'Орден ликантропов',
      'Орден мутантов',
      'Орден осквернённых душ',
      'Орден охотников на призраков',
    ],
  },
  {
    id: 277,
    key: 'Magus',
    labelRu: 'Магус',
    labelLower: 'магус',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/277-magus/',
    archetypes: [
      'Орден Демиургов',
      'Орден Затмения',
      'Орден Мистических лучников',
      'Орден Стражей',
      'Орден Танцоров Клинка',
      'Орден Чароборцев',
      'Орден Чешуи',
    ],
  },
  {
    id: 208,
    key: 'Mystic',
    labelRu: 'Мистик',
    labelLower: 'мистик',
    source: 'Unearthed Arcana',
    url: 'https://dnd.su/homebrew/class/208-mystic/',
    archetypes: [
      'Орден аватаров',
      'Орден бессмертных',
      'Орден Ву Дзень',
      'Орден душевного клинка',
      'Орден кочевников',
      'Орден пробуждённых',
    ],
  },
  {
    id: 202,
    key: 'LingeringSoul',
    labelRu: 'Неупокоенная душа',
    labelLower: 'неупокоенная душа',
    source: 'Matt Mercer / Critical Role',
    url: 'https://dnd.su/homebrew/class/202-the-lingering-soul/',
    archetypes: ['Духовный страж', 'Зов полтергейста', 'Сущность призрака'],
  },
  {
    id: 401,
    key: 'Savant',
    labelRu: 'Савант',
    labelLower: 'савант',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/401-savant/',
    archetypes: [
      'Археолог',
      'Естествоиспытатель',
      'Врач',
      'Тактик',
      'Следователь',
      'Психолог',
      'Рунописец',
      'Философ',
    ],
  },
  {
    id: 419,
    key: 'Runekeeper',
    labelRu: 'Хранитель рун',
    labelLower: 'хранитель рун',
    source: 'Dungeon Masters Guild',
    url: 'https://dnd.su/homebrew/class/419-runekeeper/',
    archetypes: ['Гоблинский язык', 'Инфернальный язык'],
  },
  {
    id: 389,
    key: 'Shaman',
    labelRu: 'Шаман',
    labelLower: 'шаман',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/389-shaman/',
    archetypes: ['Воин духа', 'Дикое сердце', 'Знахарь', 'Связующий проклятия'],
  },
];

export const DND_HOMEBREW_CLASS_LABELS_RU: Record<string, string> = Object.fromEntries(
  DND_HOMEBREW_CLASSES_META.map((c) => [c.key, c.labelRu])
);

export const DND_HOMEBREW_CLASS_BY_KEY: Record<string, DndHomebrewClassMeta> = Object.fromEntries(
  DND_HOMEBREW_CLASSES_META.map((c) => [c.key, c])
);

export const DND_HOMEBREW_LOWER_SET = new Set(
  DND_HOMEBREW_CLASSES_META.map((c) => c.labelLower)
);

export const DND_CLASS_LABELS_RU: Record<string, string> = {
  ...DND_OFFICIAL_CLASS_LABELS_RU,
  ...DND_HOMEBREW_CLASS_LABELS_RU,
};

// Ordered multi-word / alternate / homebrew aliases FIRST so e.g. "Альтернативный Воин" or "Alt Fighter"
// resolves to "AlternateFighter" rather than matching substring "воин" / "fighter".
const RAW_CLASS_ALIASES: Array<[string, string]> = [
  // Homebrew multi-word & alternate classes (must precede Barbarian / Fighter / Monk / Rogue)
  ['альтернативный варвар', 'AlternateBarbarian'],
  ['альт. варвар', 'AlternateBarbarian'],
  ['альт варвар', 'AlternateBarbarian'],
  ['alt варвар', 'AlternateBarbarian'],
  ['alternate barbarian', 'AlternateBarbarian'],
  ['alternate_barbarian', 'AlternateBarbarian'],
  ['alternatebarbarian', 'AlternateBarbarian'],
  ['alt barbarian', 'AlternateBarbarian'],

  ['альтернативный воин', 'AlternateFighter'],
  ['альт. воин', 'AlternateFighter'],
  ['альт воин', 'AlternateFighter'],
  ['alt воин', 'AlternateFighter'],
  ['alternate fighter', 'AlternateFighter'],
  ['alternate_fighter', 'AlternateFighter'],
  ['alternatefighter', 'AlternateFighter'],
  ['alt fighter', 'AlternateFighter'],

  ['альтернативный монах', 'AlternateMonk'],
  ['альт. монах', 'AlternateMonk'],
  ['альт монах', 'AlternateMonk'],
  ['alt монах', 'AlternateMonk'],
  ['alternate monk', 'AlternateMonk'],
  ['alternate_monk', 'AlternateMonk'],
  ['alternatemonk', 'AlternateMonk'],
  ['alt monk', 'AlternateMonk'],

  ['альтернативный плут', 'AlternateRogue'],
  ['альт. плут', 'AlternateRogue'],
  ['альт плут', 'AlternateRogue'],
  ['alt плут', 'AlternateRogue'],
  ['alternate rogue', 'AlternateRogue'],
  ['alternate_rogue', 'AlternateRogue'],
  ['alternaterogue', 'AlternateRogue'],
  ['alt rogue', 'AlternateRogue'],

  ['кровавый охотник', 'BloodHunter'],
  ['blood hunter', 'BloodHunter'],
  ['blood_hunter', 'BloodHunter'],
  ['bloodhunter', 'BloodHunter'],

  ['неупокоенная душа', 'LingeringSoul'],
  ['the lingering soul', 'LingeringSoul'],
  ['lingering soul', 'LingeringSoul'],
  ['lingering_soul', 'LingeringSoul'],
  ['lingeringsoul', 'LingeringSoul'],

  ['хранитель рун', 'Runekeeper'],
  ['rune keeper', 'Runekeeper'],
  ['rune_keeper', 'Runekeeper'],
  ['runekeeper', 'Runekeeper'],

  ['звездочёт', 'Stargazer'],
  ['звездочет', 'Stargazer'],
  ['stargazer', 'Stargazer'],

  ['воевода', 'Warlord'],
  ['полководец', 'Warlord'],
  ['warlord', 'Warlord'],

  ['алхимик', 'Alchemist'],
  ['alchemist', 'Alchemist'],

  ['егерь', 'Jaeger'],
  ['jaeger', 'Jaeger'],

  ['магус', 'Magus'],
  ['magus', 'Magus'],

  ['мистик', 'Mystic'],
  ['mystic', 'Mystic'],

  ['савант', 'Savant'],
  ['savant', 'Savant'],

  ['шаман', 'Shaman'],
  ['shaman', 'Shaman'],

  // Official 13 classes
  ['изобретатель', 'Artificer'],
  ['artificer', 'Artificer'],
  ['волшебник', 'Wizard'],
  ['wizard', 'Wizard'],
  ['следопыт', 'Ranger'],
  ['ranger', 'Ranger'],
  ['чародей', 'Sorcerer'],
  ['sorcerer', 'Sorcerer'],
  ['паладин', 'Paladin'],
  ['paladin', 'Paladin'],
  ['варвар', 'Barbarian'],
  ['barbarian', 'Barbarian'],
  ['колдун', 'Warlock'],
  ['warlock', 'Warlock'],
  ['клирик', 'Cleric'],
  ['cleric', 'Cleric'],
  ['друид', 'Druid'],
  ['druid', 'Druid'],
  ['монах', 'Monk'],
  ['monk', 'Monk'],
  ['fighter', 'Fighter'],
  ['воин', 'Fighter'],
  ['rogue', 'Rogue'],
  ['жрец', 'Cleric'],
  ['бард', 'Bard'],
  ['bard', 'Bard'],
  ['плут', 'Rogue'],
  ['маг', 'Wizard'],
];

const EXACT_CLASS_ALIASES: Record<string, string> = Object.fromEntries(RAW_CLASS_ALIASES);
const ORDERED_CLASS_ALIASES: Array<[string, string]> = [...RAW_CLASS_ALIASES].sort(
  (a, b) => b[0].length - a[0].length
);

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
  // 15 Homebrew classes from https://dnd.su/homebrew/class/
  Alchemist: 395,
  AlternateBarbarian: 853,
  AlternateFighter: 382,
  AlternateMonk: 391,
  AlternateRogue: 857,
  Warlord: 403,
  Jaeger: 472,
  Stargazer: 565,
  BloodHunter: 195,
  Magus: 277,
  Mystic: 208,
  LingeringSoul: 202,
  Savant: 401,
  Runekeeper: 419,
  Shaman: 389,
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
    .replace(/\s*\(hb\)\s*$/i, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!firstToken) return undefined;

  const exactDirect =
    EXACT_CLASS_ALIASES[firstToken] ||
    EXACT_CLASS_ALIASES[firstToken.replace(/е/g, 'ё')];
  if (exactDirect) return exactDirect;

  for (const [alias, canonical] of ORDERED_CLASS_ALIASES) {
    const aliasNorm = alias.replace(/ё/g, 'е');
    if (firstToken.includes(aliasNorm)) return canonical;
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

export function formatCharacterClassesRu(charClassRaw?: string | null): string {
  if (!charClassRaw || !charClassRaw.trim()) return '';
  const parts = charClassRaw
    .split(/[,/|;]/)
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      const norm = normalizeDndClass(trimmed);
      return (norm && DND_CLASS_LABELS_RU[norm]) || DND_CLASS_LABELS_RU[trimmed] || trimmed;
    })
    .filter(Boolean);
  return parts.join(' / ');
}

/**
 * Checks whether a spell from dnd.su (or custom DM spell) can be learned by a character
 * based on their class(es) OR subclass parent class in `spell.subclasses` (e.g. `клятвопреступник (паладин)`
 * or `орден демиургов (магус)`), plus rule-based off-school/ritual picks for Official & Homebrew classes.
 */
export function isSpellAllowedForCharacter(
  spell: Pick<Spell, 'classes' | 'subclasses'> &
    Partial<Pick<Spell, 'level' | 'ritual' | 'fClass'>>,
  charClassRaw?: string | null,
  subclassRaw?: string | null
): boolean {
  const playerClasses = extractPlayerCanonicalClasses(charClassRaw);
  if (playerClasses.length === 0) return false;

  // Direct numeric fClass match (covers all 13 Official + 15 Homebrew dnd.su classes)
  if (spell.fClass && spell.fClass.length > 0) {
    const playerClassIds = playerClasses
      .map((pc) => CANONICAL_TO_DNDSU_CLASS_ID[pc])
      .filter((n): n is number => Boolean(n));
    if (playerClassIds.some((cid) => spell.fClass!.includes(cid))) {
      return true;
    }
  }

  // If spell has no class restriction listed (e.g. special/universal homebrew), allow any caster
  if ((!spell.classes || spell.classes.length === 0) && !spell.subclasses) {
    return true;
  }

  const spellCanonical = new Set<string>();
  for (const c of spell.classes || []) {
    const norm = normalizeDndClass(c);
    if (norm) spellCanonical.add(norm.toLowerCase());
  }

  // Also check parent classes in `subclasses`, e.g. `круг земли (друид), клятва мести (паладин), трин огня (звездочёт)`
  if (spell.subclasses) {
    const subLower = spell.subclasses.toLowerCase().replace(/ё/g, 'е');
    if (subclassRaw && subclassRaw.trim().length > 2) {
      const playerSubLower = subclassRaw.trim().toLowerCase().replace(/ё/g, 'е');
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

  if (playerClasses.some((pc) => spellCanonical.has(pc.toLowerCase()))) {
    return true;
  }

  const playerLowerSet = new Set(playerClasses.map((pc) => pc.toLowerCase()));
  const spellLvl = typeof spell.level === 'number' ? spell.level : 0;
  const subNorm = (subclassRaw || '').trim().toLowerCase().replace(/ё/g, 'е');

  // Alchemist (Динамо-инженер) can also learn off-school Wizard 0–4 spells at levels 3/8/14/20
  if (playerLowerSet.has('alchemist') && spellCanonical.has('wizard') && spellLvl <= 4) {
    return true;
  }

  // Magus (Орден Демиургов) can learn Wizard cantrips & 6th–7th Wizard spells (Великий Демиург)
  if (
    playerLowerSet.has('magus') &&
    spellCanonical.has('wizard') &&
    (spellLvl === 0 || (subNorm.includes('демиург') && spellLvl <= 7))
  ) {
    return true;
  }

  // Alternate Rogue (Искатель) can learn any cantrip or 1st–5th level ritual
  if (
    playerLowerSet.has('alternaterogue') &&
    (subNorm.includes('искател') || subNorm.includes('seeker')) &&
    (spellLvl === 0 || (Boolean(spell.ritual) && spellLvl <= 5))
  ) {
    return true;
  }

  // Official Fighter (Eldritch Knight) & Rogue (Arcane Trickster) off-school Wizard 0–4 picks
  if (
    (playerLowerSet.has('fighter') || playerLowerSet.has('rogue')) &&
    spellCanonical.has('wizard') &&
    spellLvl <= 4
  ) {
    return true;
  }

  return false;
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
