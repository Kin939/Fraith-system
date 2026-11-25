import { fetchStaticJsonWithFallback } from './cdnAssets';
import { CANONICAL_TO_DNDSU_CLASS_ID, MAGIC_SCHOOL_LABELS_RU, normalizeDndClass } from './lss';
import type { DndsuFiltersPayload, Spell } from './types';

let officialPromise: Promise<Spell[]> | null = null;
let homebrewPromise: Promise<Spell[]> | null = null;
let filtersPromise: Promise<DndsuFiltersPayload> | null = null;

function stripHtmlFast(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|tr|h2|h3|h4|blockquote|div)>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hydrateSpells(rawList: Spell[]): Spell[] {
  return rawList.map((sp) => ({
    ...sp,
    description: sp.description || (sp.descriptionHtml ? stripHtmlFast(sp.descriptionHtml) : ''),
    createdBy: sp.createdBy ?? null,
  }));
}

export function loadOfficialDndsuSpells(): Promise<Spell[]> {
  if (!officialPromise) {
    officialPromise = fetchStaticJsonWithFallback<Spell[]>(
      '/data/dndsu-spells-official.json',
      'Не удалось загрузить официальные заклинания dnd.su'
    )
      .then(hydrateSpells)
      .catch((err) => {
        officialPromise = null;
        throw err;
      });
  }
  return officialPromise;
}

export function loadHomebrewDndsuSpells(): Promise<Spell[]> {
  if (!homebrewPromise) {
    homebrewPromise = fetchStaticJsonWithFallback<Spell[]>(
      '/data/dndsu-spells-homebrew.json',
      'Не удалось загрузить homebrew заклинания dnd.su'
    )
      .then(hydrateSpells)
      .catch((err) => {
        homebrewPromise = null;
        throw err;
      });
  }
  return homebrewPromise;
}

export function loadDndsuFilters(): Promise<DndsuFiltersPayload> {
  if (!filtersPromise) {
    filtersPromise = fetchStaticJsonWithFallback<DndsuFiltersPayload>(
      '/data/dndsu-filters.json',
      'Не удалось загрузить фильтры dnd.su'
    ).catch((err) => {
      filtersPromise = null;
      throw err;
    });
  }
  return filtersPromise;
}

export interface SchoolMeta {
  id: number;
  ru: string;
  short: string;
  color: string;
  bg: string;
  glyph: string;
}

export const SCHOOL_META_LIST: SchoolMeta[] = [
  {
    id: 1,
    ru: 'Воплощение',
    short: 'Вопл',
    color: '#fb7185',
    bg: 'rgba(251, 113, 133, 0.16)',
    glyph: '✦',
  },
  {
    id: 2,
    ru: 'Вызов',
    short: 'Выз',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.16)',
    glyph: '◈',
  },
  {
    id: 3,
    ru: 'Иллюзия',
    short: 'Илл',
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.16)',
    glyph: '◐',
  },
  {
    id: 4,
    ru: 'Некромантия',
    short: 'Некр',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.16)',
    glyph: '☠',
  },
  {
    id: 5,
    ru: 'Ограждение',
    short: 'Огр',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.16)',
    glyph: '⛨',
  },
  {
    id: 6,
    ru: 'Очарование',
    short: 'Очар',
    color: '#f472b6',
    bg: 'rgba(244, 114, 182, 0.16)',
    glyph: '❖',
  },
  {
    id: 7,
    ru: 'Преобразование',
    short: 'Преоб',
    color: '#2dd4bf',
    bg: 'rgba(45, 212, 191, 0.16)',
    glyph: '❂',
  },
  {
    id: 8,
    ru: 'Прорицание',
    short: 'Прор',
    color: '#818cf8',
    bg: 'rgba(129, 140, 248, 0.16)',
    glyph: '◉',
  },
];

const SCHOOL_BY_RU = new Map<string, SchoolMeta>(
  SCHOOL_META_LIST.map((m) => [m.ru.toLowerCase(), m])
);

export function getSchoolMeta(schoolRaw: string): SchoolMeta {
  const ru = MAGIC_SCHOOL_LABELS_RU[schoolRaw] || schoolRaw;
  return (
    SCHOOL_BY_RU.get(ru.toLowerCase()) || {
      id: 1,
      ru,
      short: ru.slice(0, 4),
      color: 'var(--primary)',
      bg: 'color-mix(in srgb, var(--primary) 18%, transparent)',
      glyph: '✦',
    }
  );
}

// Keyboard layout converter (QWERTY <-> ЙЦУКЕН) matching dnd.su search convenience
const ENG_TO_RU: Record<string, string> = {
  f: 'а', ',': 'б', d: 'в', u: 'г', l: 'д', t: 'е', '`': 'ё', ';': 'ж',
  p: 'з', b: 'и', q: 'й', r: 'к', k: 'л', v: 'м', y: 'н', j: 'о',
  g: 'п', h: 'р', c: 'с', n: 'т', e: 'у', a: 'ф', '[': 'х', w: 'ц',
  x: 'ч', i: 'ш', o: 'щ', m: 'ь', s: 'ы', ']': 'ъ', "'": 'э', '.': 'ю', z: 'я',
};

export function swapEngToRuLayout(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => ENG_TO_RU[ch] ?? ch)
    .join('');
}

export type SpellCategoryMode = 'official' | 'homebrew' | 'all' | 'learned';
export type SpellSortMode = 'title' | 'level' | 'school';

export interface DndsuActiveFilters {
  search: string;
  searchInText: boolean;
  levels: number[];
  classes: number[];
  archetypes: number[];
  schools: number[];
  sources: number[];
  concentration: number | null; // 2 = Требуется, 1 = Не требуется
  ritual: number | null; // 2 = Ритуал, 1 = Не ритуал
  components: string[]; // 'v' | 's' | 'm' | '-v' | '-s' | '-m'
  casttime: string | null; // 'action' | 'bonus_action' | 'reaction' | 'minute' | 'hour'
  damtypes: number[];
  disableTasha: boolean;
  sortBy: SpellSortMode;
}

export const INITIAL_DNDSU_FILTERS: DndsuActiveFilters = {
  search: '',
  searchInText: false,
  levels: [],
  classes: [],
  archetypes: [],
  schools: [],
  sources: [],
  concentration: null,
  ritual: null,
  components: [],
  casttime: null,
  damtypes: [],
  disableTasha: false,
  sortBy: 'title',
};

export function countActiveFilterBadges(f: DndsuActiveFilters): number {
  let c = 0;
  if (f.search.trim()) c++;
  if (f.levels.length) c++;
  if (f.classes.length) c++;
  if (f.archetypes.length) c++;
  if (f.schools.length) c++;
  if (f.sources.length) c++;
  if (f.concentration !== null) c++;
  if (f.ritual !== null) c++;
  if (f.components.length) c++;
  if (f.casttime !== null) c++;
  if (f.damtypes.length) c++;
  if (f.disableTasha) c++;
  return c;
}

function getSpellComponentFlags(sp: Spell): { v: boolean; s: boolean; m: boolean } {
  if (sp.fComp) {
    const parts = sp.fComp.split('|');
    return {
      v: parts[0] === '1',
      s: parts[1] === '1',
      m: parts[2] === '1',
    };
  }
  const badge = sp.componentsBadge || '';
  if (badge.length === 3) {
    return {
      v: badge[0] === 'В',
      s: badge[1] === 'С',
      m: badge[2] === 'М',
    };
  }
  const comp = sp.components || '';
  return {
    v: /(^|[\s,])В([\s,(]|$)/i.test(comp),
    s: /(^|[\s,])С([\s,(]|$)/i.test(comp),
    m: /(^|[\s,])М([\s,(]|$)/i.test(comp),
  };
}

export function getSpellDisplayBadge(sp: Spell): string {
  if (sp.componentsBadge && sp.componentsBadge.length === 3) {
    return sp.componentsBadge;
  }
  const flags = getSpellComponentFlags(sp);
  return `${flags.v ? 'В' : '.'}${flags.s ? 'С' : '.'}${flags.m ? 'М' : '.'}`;
}

export function filterAndSortDndsuSpells(
  spells: Spell[],
  filters: DndsuActiveFilters
): Spell[] {
  const rawQuery = filters.search.trim().toLowerCase();
  const altQuery = rawQuery ? swapEngToRuLayout(rawQuery) : '';

  const filtered = spells.filter((sp) => {
    if (filters.levels.length > 0 && !filters.levels.includes(sp.level)) {
      return false;
    }

    if (filters.classes.length > 0) {
      let fClassIds = sp.fClass;
      if (!fClassIds || fClassIds.length === 0) {
        const derived = new Set<number>();
        for (const cl of sp.classes || []) {
          const cid = CANONICAL_TO_DNDSU_CLASS_ID[normalizeDndClass(cl) || ''];
          if (cid) derived.add(cid);
        }
        if (sp.subclasses) {
          for (const m of sp.subclasses.matchAll(/\(([^)]+)\)/g)) {
            const cid = CANONICAL_TO_DNDSU_CLASS_ID[normalizeDndClass(m[1]) || ''];
            if (cid) derived.add(cid);
          }
        }
        fClassIds = Array.from(derived);
      }
      const allowedIds = filters.disableTasha
        ? fClassIds
        : [...fClassIds, ...(sp.fClassTce || [])];
      if (!filters.classes.some((cid) => allowedIds.includes(cid))) {
        return false;
      }
    } else if (filters.disableTasha) {
      // If disableTasha is checked without specific class filter, hide spells that ONLY exist in TCE source (139)
      if (sp.fSource && sp.fSource.length === 1 && sp.fSource[0] === 139) {
        return false;
      }
    }

    if (filters.archetypes.length > 0) {
      const arch = sp.fArchetype || [];
      if (!filters.archetypes.some((aid) => arch.includes(aid))) {
        return false;
      }
    }

    if (filters.schools.length > 0) {
      const schoolIds = sp.fSchool?.length ? sp.fSchool : [getSchoolMeta(sp.school).id];
      if (!filters.schools.some((sid) => schoolIds.includes(sid))) {
        return false;
      }
    }

    if (filters.sources.length > 0) {
      const src = sp.fSource || [];
      if (!filters.sources.some((sid) => src.includes(sid))) {
        return false;
      }
    }

    if (filters.concentration !== null) {
      const wantConc = filters.concentration === 2;
      if (Boolean(sp.concentration) !== wantConc) return false;
    }

    if (filters.ritual !== null) {
      const wantRitual = filters.ritual === 2;
      if (Boolean(sp.ritual) !== wantRitual) return false;
    }

    if (filters.components.length > 0) {
      const flags = getSpellComponentFlags(sp);
      for (const rule of filters.components) {
        if (rule === 'v' && !flags.v) return false;
        if (rule === 's' && !flags.s) return false;
        if (rule === 'm' && !flags.m) return false;
        if (rule === '-v' && flags.v) return false;
        if (rule === '-s' && flags.s) return false;
        if (rule === '-m' && flags.m) return false;
      }
    }

    if (filters.casttime !== null) {
      const castList = sp.fCast || [];
      if (!castList.includes(filters.casttime)) return false;
    }

    if (filters.damtypes.length > 0) {
      const dam = sp.fDam || [];
      if (!filters.damtypes.some((did) => dam.includes(did))) {
        return false;
      }
    }

    if (rawQuery) {
      const titleHay = `${sp.name} ${sp.nameEn || ''}`.toLowerCase();
      const matchTitle =
        titleHay.includes(rawQuery) || (altQuery !== rawQuery && titleHay.includes(altQuery));
      if (!matchTitle) {
        if (!filters.searchInText) return false;
        const bodyHay = `${sp.description} ${sp.subclasses || ''} ${sp.components || ''}`.toLowerCase();
        const matchBody =
          bodyHay.includes(rawQuery) || (altQuery !== rawQuery && bodyHay.includes(altQuery));
        if (!matchBody) return false;
      }
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (filters.sortBy === 'level') {
      return a.level - b.level || a.name.localeCompare(b.name, 'ru');
    }
    if (filters.sortBy === 'school') {
      const sa = MAGIC_SCHOOL_LABELS_RU[a.school] || a.school;
      const sb = MAGIC_SCHOOL_LABELS_RU[b.school] || b.school;
      return sa.localeCompare(sb, 'ru') || a.level - b.level || a.name.localeCompare(b.name, 'ru');
    }
    return a.name.localeCompare(b.name, 'ru');
  });

  return sorted;
}
