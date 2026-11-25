import { DND_CLASS_LABELS_RU } from './lss';

export type AbilityCode = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_META: Record<
  AbilityCode,
  { shortRu: string; fullRu: string }
> = {
  str: { shortRu: 'СИЛ', fullRu: 'Сила' },
  dex: { shortRu: 'ЛОВ', fullRu: 'Ловкость' },
  con: { shortRu: 'ТЕЛ', fullRu: 'Телосложение' },
  int: { shortRu: 'ИНТ', fullRu: 'Интеллект' },
  wis: { shortRu: 'МДР', fullRu: 'Мудрость' },
  cha: { shortRu: 'ХАР', fullRu: 'Харизма' },
};

export const SKILL_META: Array<{
  key: string;
  labelRu: string;
  defaultStat: AbilityCode;
}> = [
  { key: 'acrobatics', labelRu: 'Акробатика', defaultStat: 'dex' },
  { key: 'investigation', labelRu: 'Анализ', defaultStat: 'int' },
  { key: 'athletics', labelRu: 'Атлетика', defaultStat: 'str' },
  { key: 'perception', labelRu: 'Внимательность', defaultStat: 'wis' },
  { key: 'survival', labelRu: 'Выживание', defaultStat: 'wis' },
  { key: 'performance', labelRu: 'Выступление', defaultStat: 'cha' },
  { key: 'intimidation', labelRu: 'Запугивание', defaultStat: 'cha' },
  { key: 'history', labelRu: 'История', defaultStat: 'int' },
  { key: 'sleight of hand', labelRu: 'Ловкость рук', defaultStat: 'dex' },
  { key: 'arcana', labelRu: 'Магия', defaultStat: 'int' },
  { key: 'medicine', labelRu: 'Медицина', defaultStat: 'wis' },
  { key: 'deception', labelRu: 'Обман', defaultStat: 'cha' },
  { key: 'nature', labelRu: 'Природа', defaultStat: 'int' },
  { key: 'insight', labelRu: 'Проницательность', defaultStat: 'wis' },
  { key: 'religion', labelRu: 'Религия', defaultStat: 'int' },
  { key: 'stealth', labelRu: 'Скрытность', defaultStat: 'dex' },
  { key: 'persuasion', labelRu: 'Убеждение', defaultStat: 'cha' },
  { key: 'animal handling', labelRu: 'Уход за животными', defaultStat: 'wis' },
];

export const TEXT_BLOCK_LABELS_RU: Record<string, string> = {
  traits: 'Умения и способности',
  features: 'Классовые и расовые черты',
  feats: 'Черты',
  attacks: 'Атаки и приёмы',
  weapons: 'Оружие и боевой стиль',
  equipment: 'Снаряжение и инвентарь',
  items: 'Предметы',
  prof: 'Владения и языки',
  attunement: 'Настройка на магические предметы',
  personality: 'Черты характера',
  ideals: 'Идеалы',
  bonds: 'Привязанности',
  flaws: 'Слабости',
  background: 'Предыстория',
  appearance: 'Внешность',
  allies: 'Союзники и организации',
  quests: 'Заметки о заданиях',
  other: 'Прочие заметки',
  notes: 'Заметки',
  'notes-1': 'Заметки #1',
  'notes-2': 'Заметки #2',
  'notes-3': 'Заметки #3',
  'notes-4': 'Заметки #4',
  'notes-5': 'Заметки #5',
  'notes-6': 'Заметки #6',
};

export const PROF_FLAG_LABELS_RU: Record<string, string> = {
  'armor-light': 'Лёгкие доспехи',
  'armor-medium': 'Средние доспехи',
  'armor-heavy': 'Тяжёлые доспехи',
  'armor-label': 'Щиты',
  'weapon-simple': 'Простое оружие',
  'weapon-martial': 'Воинское оружие',
  'weapon-other': 'Особое оружие',
};

export interface LssRichParagraph {
  kind: 'paragraph' | 'bullet' | 'ordered' | 'spoiler' | 'divider';
  title?: string;
  text: string;
  items?: string[];
}

export interface LssParsedWeapon {
  id: string;
  name: string;
  ability: AbilityCode | 'none';
  isProf: boolean;
  attackBonus: number;
  damageRaw: string;
  damageResolved: string;
  damageType: string;
  notes: string;
}

export interface LssParsedResource {
  id: string;
  name: string;
  current: number;
  max: number;
  restLabel: string;
  notes: string;
}

export interface LssParsedSheet {
  edition: string;
  name: string;
  classLabel: string;
  subclass: string;
  race: string;
  background: string;
  alignment: string;
  playerName: string;
  experience: number | null;
  level: number;
  proficiencyBonus: number;
  avatarUrl: string | null;
  inspiration: boolean;
  exhaustion: number;
  conditions: string[];

  subInfo: Array<{ label: string; value: string }>;

  abilities: Record<
    AbilityCode,
    {
      code: AbilityCode;
      shortRu: string;
      fullRu: string;
      score: number;
      mod: number;
      checkBonus: number;
      saveBonus: number;
      saveProf: boolean;
    }
  >;

  skills: Array<{
    key: string;
    labelRu: string;
    stat: AbilityCode;
    statShortRu: string;
    profLevel: 0 | 1 | 2;
    total: number;
  }>;

  combat: {
    ac: number;
    shieldEquipped: boolean;
    initiative: number;
    speed: string;
    hitDie: string;
    hitDiceCurrent: number;
    darkvision: number;
    passivePerception: number;
    passiveInsight: number;
    passiveInvestigation: number;
    hpMaxComputed: number;
  };

  weapons: LssParsedWeapon[];
  resources: LssParsedResource[];
  attunements: Array<{ name: string; active: boolean }>;
  profFlags: string[];

  spellcasting: {
    baseAbility: AbilityCode | null;
    saveDc: number | null;
    attackBonus: number | null;
    slots: Array<{ level: number; total: number; expended: number; isPact?: boolean }>;
    preparedSlugs: string[];
  };

  textBlocks: Array<{
    key: string;
    label: string;
    nodes: LssRichParagraph[];
  }>;
}

function unwrapVal(v: unknown): unknown {
  if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    return (v as Record<string, unknown>).value;
  }
  return v;
}

function asNum(v: unknown): number | undefined {
  const u = unwrapVal(v);
  if (typeof u === 'number' && Number.isFinite(u)) return u;
  if (typeof u === 'string' && u.trim() !== '') {
    const n = Number(u.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asStr(v: unknown): string {
  const u = unwrapVal(v);
  if (typeof u === 'string') return u.trim();
  if (typeof u === 'number' && Number.isFinite(u)) return String(u);
  return '';
}

export function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export type FormulaVars = Record<string, number>;

/**
 * Safely evaluates LSS numeric formulas like `10+[DEX]`, `13+[DEX]+[CON]`, `8+[PROF]+[WIS]`, `round([PROF]/2)`.
 */
export function evalLssNumericFormula(
  rawExpr: string | number | null | undefined,
  vars: FormulaVars
): number | null {
  if (rawExpr === null || rawExpr === undefined) return null;
  if (typeof rawExpr === 'number') return Number.isFinite(rawExpr) ? rawExpr : null;
  const trimmed = String(rawExpr).trim();
  if (!trimmed) return null;

  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;

  // Replace [STR], [dex], [PROF], [LVL]
  let expr = trimmed.replace(/\[([a-zA-Z_]+)\]/g, (_, rawName: string) => {
    const key = rawName.toUpperCase();
    const val = vars[key] ?? 0;
    return `(${val})`;
  });

  // Replace dice terms in purely numeric context with 0 (per LSS vitality spec)
  expr = expr.replace(/\d*\s*[dкКD]\s*\d+/g, '0');

  // Support simple functions: floor, ceil, round, min, max
  expr = expr
    .replace(/\bfloor\s*\(/gi, 'Math.floor(')
    .replace(/\bceil\s*\(/gi, 'Math.ceil(')
    .replace(/\bround\s*\(/gi, 'Math.round(')
    .replace(/\bmin\s*\(/gi, 'Math.min(')
    .replace(/\bmax\s*\(/gi, 'Math.max(');

  // Whitelist safe arithmetic tokens only
  const strippedCheck = expr.replace(/Math\.(floor|ceil|round|min|max)/g, '');
  if (!/^[0-9+\-*/().,\s]+$/.test(strippedCheck)) {
    return null;
  }

  try {
    const fn = new Function(`"use strict"; return (${expr});`);
    const res = fn();
    return typeof res === 'number' && Number.isFinite(res) ? Math.trunc(res) : null;
  } catch {
    return null;
  }
}

export function resolveWeaponDamageString(rawDmg: string, vars: FormulaVars): string {
  if (!rawDmg.trim()) return '1';
  const replaced = rawDmg.replace(/\[([a-zA-Z_]+)\]/g, (_, rawName: string) => {
    const val = vars[rawName.toUpperCase()] ?? 0;
    return val >= 0 ? `${val}` : `(${val})`;
  });
  return replaced.replace(/\+\s*\(-(\d+)\)/g, '- $1').replace(/\+\s*0\b/g, '').trim() || '1';
}

interface ActiveBonus {
  target: string;
  mode: string;
  val: number;
}

function collectActiveBonuses(
  sheet: Record<string, unknown>,
  vars: FormulaVars
): ActiveBonus[] {
  const rawBonuses = Array.isArray(sheet.bonuses) ? sheet.bonuses : [];
  const rawEffects = Array.isArray(sheet.effects) ? sheet.effects : [];
  const rawAttunements = Array.isArray(sheet.attunementsList) ? sheet.attunementsList : [];

  const disabledEffectIds = new Set<string>();
  const existingEffectIds = new Set<string>();
  for (const ef of rawEffects) {
    if (ef && typeof ef === 'object') {
      const r = ef as Record<string, unknown>;
      if (typeof r.id === 'string') {
        existingEffectIds.add(r.id);
        if (r.disabled === true) disabledEffectIds.add(r.id);
      }
    }
  }

  const activeAttunementIds = new Set<string>();
  for (const att of rawAttunements) {
    if (att && typeof att === 'object') {
      const r = att as Record<string, unknown>;
      if (typeof r.id === 'string' && r.checked === true) {
        activeAttunementIds.add(r.id);
      }
    }
  }

  const out: ActiveBonus[] = [];
  for (const item of rawBonuses) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    if (b.disabled === true) continue;

    const src = (b.source && typeof b.source === 'object' ? b.source : {}) as Record<
      string,
      unknown
    >;
    if (src.kind === 'effect' && typeof src.refId === 'string') {
      if (!existingEffectIds.has(src.refId) || disabledEffectIds.has(src.refId)) continue;
    }
    if (src.kind === 'attunement' && typeof src.refId === 'string') {
      if (!activeAttunementIds.has(src.refId)) continue;
    }

    const target = typeof b.target === 'string' ? b.target : '';
    if (!target) continue;
    const mode =
      typeof b.mode === 'string'
        ? b.mode
        : b.kind === 'override'
          ? 'set'
          : 'add';
    if (mode === 'advantage' || mode === 'disadvantage') continue;

    let val: number | null = null;
    if (typeof b.value === 'number' && Number.isFinite(b.value)) {
      val = b.value;
    } else if (typeof b.expr === 'string') {
      val = evalLssNumericFormula(b.expr, vars);
    }
    if (val === null) continue;
    out.push({ target, mode, val });
  }
  return out;
}

function applyBonusesToBase(base: number, bonuses: ActiveBonus[], targets: string[]): number {
  let result = base;
  const targetSet = new Set(targets);
  // Apply 'set' overrides first, then 'add'
  for (const b of bonuses) {
    if (targetSet.has(b.target) && b.mode === 'set') {
      result = b.val;
    }
  }
  for (const b of bonuses) {
    if (targetSet.has(b.target) && b.mode === 'add') {
      result += b.val;
    }
  }
  return result;
}

function extractInlineText(
  node: unknown,
  resourcesMap: Record<string, LssParsedResource>
): string {
  if (!node || typeof node !== 'object') return '';
  const r = node as Record<string, unknown>;
  const type = typeof r.type === 'string' ? r.type : '';

  if (type === 'text') {
    return typeof r.text === 'string' ? r.text : '';
  }
  if (type === 'hardBreak') {
    return '\n';
  }
  if (type === 'roller' || type === 'formula') {
    const attrs = (r.attrs && typeof r.attrs === 'object' ? r.attrs : {}) as Record<
      string,
      unknown
    >;
    const label = asStr(attrs.label) || asStr(attrs.formula) || asStr(attrs.expr) || asStr(r.text);
    return label ? `[🎲 ${label}]` : '';
  }
  if (type === 'resource') {
    const attrs = (r.attrs && typeof r.attrs === 'object' ? r.attrs : {}) as Record<
      string,
      unknown
    >;
    const id = asStr(attrs.id);
    const res = id ? resourcesMap[id] : undefined;
    if (res) {
      return `[⚡ ${res.name}: ${res.current}/${res.max}]`;
    }
    return '';
  }

  if (Array.isArray(r.content)) {
    return r.content.map((c) => extractInlineText(c, resourcesMap)).join('');
  }
  return '';
}

function parseRichDocNodes(
  docNode: unknown,
  resourcesMap: Record<string, LssParsedResource>
): LssRichParagraph[] {
  if (!docNode || typeof docNode !== 'object') return [];
  const doc = docNode as Record<string, unknown>;
  const content = Array.isArray(doc.content) ? doc.content : [];
  const out: LssRichParagraph[] = [];

  for (const rawBlock of content) {
    if (!rawBlock || typeof rawBlock !== 'object') continue;
    const b = rawBlock as Record<string, unknown>;
    const bType = typeof b.type === 'string' ? b.type : '';

    if (bType === 'divider' || bType === 'horizontalRule') {
      out.push({ kind: 'divider', text: '' });
      continue;
    }

    if (bType === 'bulletList' || bType === 'orderedList' || bType === 'taskList') {
      const itemsRaw = Array.isArray(b.content) ? b.content : [];
      const items: string[] = [];
      for (const li of itemsRaw) {
        const text = extractInlineText(li, resourcesMap).trim();
        if (text) items.push(text);
      }
      if (items.length > 0) {
        out.push({
          kind: bType === 'orderedList' ? 'ordered' : 'bullet',
          text: '',
          items,
        });
      }
      continue;
    }

    if (bType === 'spoiler') {
      const children = Array.isArray(b.content) ? b.content : [];
      let summary = 'Подробнее';
      const bodyParts: string[] = [];
      for (const ch of children) {
        if (!ch || typeof ch !== 'object') continue;
        const cr = ch as Record<string, unknown>;
        if (cr.type === 'spoilerSummary') {
          summary = extractInlineText(cr, resourcesMap).trim() || summary;
        } else {
          const t = extractInlineText(cr, resourcesMap).trim();
          if (t) bodyParts.push(t);
        }
      }
      if (bodyParts.length > 0) {
        out.push({
          kind: 'spoiler',
          title: summary,
          text: bodyParts.join('\n'),
        });
      }
      continue;
    }

    const text = extractInlineText(b, resourcesMap).trim();
    if (text) {
      out.push({ kind: 'paragraph', text });
    }
  }

  return out;
}

/**
 * Parses a raw Long Story Short character `.json` string or object into a complete
 * renderable D&D 5e sheet model.
 */
export function parseFullLssSheet(rawJson: string | null | undefined): LssParsedSheet | null {
  if (!rawJson) return null;
  let root: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    root = parsed as Record<string, unknown>;
  } catch {
    return null;
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

  const edition = asStr(root.edition) || asStr(sheet.edition) || '2014';
  const info = (sheet.info && typeof sheet.info === 'object' ? sheet.info : {}) as Record<
    string,
    unknown
  >;
  const subInfoObj = (
    sheet.subInfo && typeof sheet.subInfo === 'object' ? sheet.subInfo : {}
  ) as Record<string, unknown>;
  const statsObj = (sheet.stats && typeof sheet.stats === 'object' ? sheet.stats : {}) as Record<
    string,
    unknown
  >;
  const savesObj = (sheet.saves && typeof sheet.saves === 'object' ? sheet.saves : {}) as Record<
    string,
    unknown
  >;
  const skillsObj = (
    sheet.skills && typeof sheet.skills === 'object' ? sheet.skills : {}
  ) as Record<string, unknown>;
  const vitality = (
    sheet.vitality && typeof sheet.vitality === 'object' ? sheet.vitality : {}
  ) as Record<string, unknown>;

  const name = asStr(sheet.name) || asStr(info.name) || 'Безымянный герой';
  const rawClass = asStr(info.charClass) || asStr(sheet.charClass) || '';
  const classLabel = DND_CLASS_LABELS_RU[rawClass] || rawClass;
  const subclass = asStr(info.charSubclass) || asStr(sheet.subclass);
  const race = asStr(info.race) || asStr(sheet.race);
  const background = asStr(info.background);
  const alignment = asStr(info.alignment);
  const playerName = asStr(info.playerName);
  const experience = asNum(info.experience) ?? null;
  const level = Math.max(1, asNum(info.level) ?? asNum(sheet.level) ?? 1);

  const defaultProf = Math.floor((level - 1) / 4) + 2;
  const customProf = asNum(sheet.proficiencyCustom);
  const proficiencyBonus =
    customProf && customProf > 0
      ? customProf
      : (asNum(sheet.proficiency) ?? defaultProf);

  // First-pass base scores
  const baseScores: Record<AbilityCode, number> = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };
  for (const code of Object.keys(ABILITY_META) as AbilityCode[]) {
    const entry = statsObj[code];
    if (entry && typeof entry === 'object') {
      const r = entry as Record<string, unknown>;
      baseScores[code] = asNum(r.score) ?? asNum(r.value) ?? 10;
    } else if (typeof entry === 'number') {
      baseScores[code] = entry;
    }
  }

  const initialVars: FormulaVars = {
    LVL: level,
    PROF: proficiencyBonus,
    STR: Math.floor((baseScores.str - 10) / 2),
    DEX: Math.floor((baseScores.dex - 10) / 2),
    CON: Math.floor((baseScores.con - 10) / 2),
    INT: Math.floor((baseScores.int - 10) / 2),
    WIS: Math.floor((baseScores.wis - 10) / 2),
    CHA: Math.floor((baseScores.cha - 10) / 2),
  };

  let bonuses = collectActiveBonuses(sheet, initialVars);

  // Final ability scores & modifiers after stat.*.score bonuses
  const finalScores: Record<AbilityCode, number> = { ...baseScores };
  for (const code of Object.keys(ABILITY_META) as AbilityCode[]) {
    finalScores[code] = applyBonusesToBase(baseScores[code], bonuses, [`stat.${code}.score`]);
  }

  const vars: FormulaVars = {
    LVL: level,
    PROF: proficiencyBonus,
    STR: Math.floor((finalScores.str - 10) / 2),
    DEX: Math.floor((finalScores.dex - 10) / 2),
    CON: Math.floor((finalScores.con - 10) / 2),
    INT: Math.floor((finalScores.int - 10) / 2),
    WIS: Math.floor((finalScores.wis - 10) / 2),
    CHA: Math.floor((finalScores.cha - 10) / 2),
  };
  // Re-evaluate bonuses with final ability modifiers
  bonuses = collectActiveBonuses(sheet, vars);

  const abilities = {} as LssParsedSheet['abilities'];
  for (const code of Object.keys(ABILITY_META) as AbilityCode[]) {
    const score = finalScores[code];
    const mod = Math.floor((score - 10) / 2);
    const saveRaw = (savesObj[code] && typeof savesObj[code] === 'object'
      ? savesObj[code]
      : {}) as Record<string, unknown>;
    const saveProf =
      Boolean(saveRaw.isProf) ||
      bonuses.some((b) => b.target === `prof.save.${code}` && b.val > 0);

    let saveBase = mod + (saveProf ? proficiencyBonus : 0) + (asNum(saveRaw.bonus) ?? 0);
    if (typeof saveRaw.bonusExpr === 'string') {
      const exprVal = evalLssNumericFormula(saveRaw.bonusExpr, vars);
      if (exprVal !== null) saveBase += exprVal;
    }
    let saveBonus = applyBonusesToBase(saveBase, bonuses, ['save.all', `save.${code}`]);
    if (saveRaw.customModifier !== undefined && saveRaw.customModifier !== null && saveRaw.customModifier !== '') {
      const cm = evalLssNumericFormula(saveRaw.customModifier as string | number, vars);
      if (cm !== null) saveBonus = cm;
    }

    const checkBonus = applyBonusesToBase(mod, bonuses, ['check.all', `stat.${code}.check`]);

    abilities[code] = {
      code,
      shortRu: ABILITY_META[code].shortRu,
      fullRu: ABILITY_META[code].fullRu,
      score,
      mod,
      checkBonus,
      saveBonus,
      saveProf,
    };
  }

  // 18 SRD skills
  const skills: LssParsedSheet['skills'] = SKILL_META.map((meta) => {
    const raw = (skillsObj[meta.key] && typeof skillsObj[meta.key] === 'object'
      ? skillsObj[meta.key]
      : {}) as Record<string, unknown>;
    const stat =
      typeof raw.baseStat === 'string' && raw.baseStat in ABILITY_META
        ? (raw.baseStat as AbilityCode)
        : meta.defaultStat;
    let profLevel: 0 | 1 | 2 = 0;
    if (raw.isProf === 2) profLevel = 2;
    else if (raw.isProf === 1 || raw.isProf === true) profLevel = 1;

    // Check proficiency grant bonuses
    for (const b of bonuses) {
      if (b.target === `prof.skill.${meta.key}`) {
        if (b.val >= 2) profLevel = 2;
        else if (b.val >= 1 && profLevel < 1) profLevel = 1;
      }
    }

    const statMod = abilities[stat].mod;
    const profAdd =
      profLevel === 2 ? proficiencyBonus * 2 : profLevel === 1 ? proficiencyBonus : 0;
    let total = statMod + profAdd + (asNum(raw.bonus) ?? 0);
    if (typeof raw.bonusExpr === 'string') {
      const exprVal = evalLssNumericFormula(raw.bonusExpr, vars);
      if (exprVal !== null) total += exprVal;
    }
    total = applyBonusesToBase(total, bonuses, [
      'check.all',
      `stat.${stat}.check`,
      `skill.${meta.key}`,
    ]);
    if (raw.customModifier !== undefined && raw.customModifier !== null && raw.customModifier !== '') {
      const cm = evalLssNumericFormula(raw.customModifier as string | number, vars);
      if (cm !== null) total = cm;
    }

    return {
      key: meta.key,
      labelRu: meta.labelRu,
      stat,
      statShortRu: ABILITY_META[stat].shortRu,
      profLevel,
      total,
    };
  });

  // Combat & vitality
  const acFormula = asStr(vitality.ac) || '10+[DEX]';
  let ac = evalLssNumericFormula(acFormula, vars) ?? 10 + abilities.dex.mod;
  const shieldObj = (
    vitality.shield && typeof vitality.shield === 'object' ? vitality.shield : {}
  ) as Record<string, unknown>;
  const shieldEquipped = Boolean(shieldObj.value);
  if (shieldEquipped) {
    const shieldMod = evalLssNumericFormula(asStr(shieldObj.mod) || '2', vars) ?? 2;
    ac += applyBonusesToBase(shieldMod, bonuses, ['shield']);
  }
  ac = applyBonusesToBase(ac, bonuses, ['ac']);

  const initRaw = unwrapVal(vitality.initiative);
  const initBase =
    initRaw !== null && initRaw !== undefined && String(initRaw).trim() !== ''
      ? (evalLssNumericFormula(String(initRaw), vars) ?? abilities.dex.mod)
      : abilities.dex.mod;
  const initiative = applyBonusesToBase(initBase, bonuses, ['initiative', 'check.all', 'stat.dex.check']);

  const speedRaw = asStr(vitality.speed) || '30';
  const speedEval = evalLssNumericFormula(speedRaw, vars);
  const speed =
    speedEval !== null
      ? `${applyBonusesToBase(speedEval, bonuses, ['speed.walk'])} фт.`
      : speedRaw;

  const hitDie = asStr(vitality['hit-die']) || 'd8';
  const hitDiceCurrent = asNum(vitality['hp-dice-current']) ?? level;
  const darkvision = asNum(vitality.darkvision) ?? 0;

  const hpMaxBase =
    (asNum(vitality['hp-max']) ?? 0) + (asNum(vitality['hp-max-bonus']) ?? 0);
  const hpMaxComputed = applyBonusesToBase(hpMaxBase, bonuses, ['hp.max']);

  const skillByKey = Object.fromEntries(skills.map((s) => [s.key, s]));
  const passivePerception = applyBonusesToBase(
    10 + (skillByKey.perception?.total ?? abilities.wis.mod),
    bonuses,
    ['passive.perception']
  );
  const passiveInsight = applyBonusesToBase(
    10 + (skillByKey.insight?.total ?? abilities.wis.mod),
    bonuses,
    ['passive.insight']
  );
  const passiveInvestigation = applyBonusesToBase(
    10 + (skillByKey.investigation?.total ?? abilities.int.mod),
    bonuses,
    ['passive.investigation']
  );

  // Weapons
  const rawWeapons = Array.isArray(sheet.weaponsList) ? sheet.weaponsList : [];
  const weapons: LssParsedWeapon[] = [];
  for (const w of rawWeapons) {
    if (!w || typeof w !== 'object') continue;
    const wr = w as Record<string, unknown>;
    const wName = asStr(wr.name);
    if (!wName) continue;
    const wId = asStr(wr.id) || wName;
    const ability: AbilityCode | 'none' =
      typeof wr.ability === 'string' && wr.ability in ABILITY_META
        ? (wr.ability as AbilityCode)
        : wr.ability === 'none'
          ? 'none'
          : 'str';
    const isProf = wr.isProf !== false;
    const statAttackMod = ability === 'none' ? 0 : abilities[ability].mod;
    const extraMod = evalLssNumericFormula(asStr(wr.mod), vars) ?? 0;
    const attackBase = statAttackMod + (isProf ? proficiencyBonus : 0) + extraMod;
    const attackTargets = ['attack.all', `weapon.${wId}.attack`];
    if (ability !== 'none') attackTargets.push(`stat.${ability}.attack`);
    const attackBonus = applyBonusesToBase(attackBase, bonuses, attackTargets);

    const damageRaw = asStr(wr.dmg) || '1к4';
    const damageResolved = resolveWeaponDamageString(damageRaw, vars);
    const damageType = asStr(wr.dmgType);
    const notes = asStr(wr.notes);

    weapons.push({
      id: wId,
      name: wName,
      ability,
      isProf,
      attackBonus,
      damageRaw,
      damageResolved,
      damageType,
      notes,
    });
  }

  // Resources
  const resourcesObj = (
    sheet.resources && typeof sheet.resources === 'object' ? sheet.resources : {}
  ) as Record<string, unknown>;
  const resourcesMap: Record<string, LssParsedResource> = {};
  for (const [key, val] of Object.entries(resourcesObj)) {
    if (!val || typeof val !== 'object') continue;
    const rr = val as Record<string, unknown>;
    if (rr.isDeleted === true || rr.orphanedAt) continue;
    const rName = asStr(rr.name);
    if (!rName) continue;
    const current = asNum(rr.current) ?? 0;
    const maxFromExpr =
      typeof rr.maxExpr === 'string' ? evalLssNumericFormula(rr.maxExpr, vars) : null;
    const max = maxFromExpr ?? asNum(rr.max) ?? current;
    const restLabel = rr.isShortRest
      ? 'кор. отдых'
      : rr.isLongRest
        ? 'дл. отдых'
        : '';
    const rId = asStr(rr.id) || key;
    resourcesMap[rId] = {
      id: rId,
      name: rName,
      current,
      max,
      restLabel,
      notes: asStr(rr.notes),
    };
  }

  // Attunements & Proficiencies
  const attunements: LssParsedSheet['attunements'] = [];
  if (Array.isArray(sheet.attunementsList)) {
    for (const a of sheet.attunementsList) {
      if (a && typeof a === 'object') {
        const ar = a as Record<string, unknown>;
        const val = asStr(ar.value);
        if (val) attunements.push({ name: val, active: Boolean(ar.checked) });
      }
    }
  }

  const profObj = (sheet.prof && typeof sheet.prof === 'object' ? sheet.prof : {}) as Record<
    string,
    unknown
  >;
  const profFlags: string[] = [];
  for (const [k, label] of Object.entries(PROF_FLAG_LABELS_RU)) {
    const checked =
      Boolean(unwrapVal(profObj[k])) ||
      bonuses.some((b) => b.target === `prof.${k}` && b.val > 0);
    if (checked) profFlags.push(label);
  }

  // Spellcasting info + slots
  const spellsInfo = (
    sheet.spellsInfo && typeof sheet.spellsInfo === 'object' ? sheet.spellsInfo : {}
  ) as Record<string, unknown>;
  const baseInfo = (
    spellsInfo.base && typeof spellsInfo.base === 'object' ? spellsInfo.base : {}
  ) as Record<string, unknown>;
  const baseCode =
    typeof baseInfo.code === 'string' && baseInfo.code in ABILITY_META
      ? (baseInfo.code as AbilityCode)
      : null;

  let saveDc: number | null = null;
  let spellAttackBonus: number | null = null;
  if (baseCode) {
    saveDc = applyBonusesToBase(
      8 + proficiencyBonus + abilities[baseCode].mod,
      bonuses,
      ['spellDC']
    );
    spellAttackBonus = applyBonusesToBase(
      proficiencyBonus + abilities[baseCode].mod,
      bonuses,
      ['spellAttack', 'attack.all']
    );
  }
  const saveOverrideObj = (
    spellsInfo.save && typeof spellsInfo.save === 'object' ? spellsInfo.save : {}
  ) as Record<string, unknown>;
  if (typeof saveOverrideObj.customModifier === 'string' && saveOverrideObj.customModifier.trim()) {
    const ov = evalLssNumericFormula(saveOverrideObj.customModifier, vars);
    if (ov !== null) saveDc = ov;
  }
  const modOverrideObj = (
    spellsInfo.mod && typeof spellsInfo.mod === 'object' ? spellsInfo.mod : {}
  ) as Record<string, unknown>;
  if (typeof modOverrideObj.customModifier === 'string' && modOverrideObj.customModifier.trim()) {
    const ov = evalLssNumericFormula(modOverrideObj.customModifier, vars);
    if (ov !== null) spellAttackBonus = ov;
  }

  const slots: LssParsedSheet['spellcasting']['slots'] = [];
  const spellsSlotsObj = (
    sheet.spells && typeof sheet.spells === 'object' ? sheet.spells : {}
  ) as Record<string, unknown>;
  for (let lvl = 1; lvl <= 9; lvl++) {
    const entry = spellsSlotsObj[`slots-${lvl}`];
    const baseSlotVal =
      entry && typeof entry === 'object'
        ? (asNum((entry as Record<string, unknown>).value) ?? 0)
        : 0;
    const total = applyBonusesToBase(baseSlotVal, bonuses, [`spellSlot.${lvl}`]);
    const expended =
      entry && typeof entry === 'object'
        ? (asNum((entry as Record<string, unknown>).filled) ?? 0)
        : 0;
    if (total > 0) {
      slots.push({ level: lvl, total, expended });
    }
  }

  const pactSlotsObj = (
    sheet.spellsPact && typeof sheet.spellsPact === 'object' ? sheet.spellsPact : {}
  ) as Record<string, unknown>;
  for (let lvl = 1; lvl <= 9; lvl++) {
    const entry = pactSlotsObj[`slots-${lvl}`];
    const baseSlotVal =
      entry && typeof entry === 'object'
        ? (asNum((entry as Record<string, unknown>).value) ?? 0)
        : 0;
    const total = applyBonusesToBase(baseSlotVal, bonuses, [`pactSlot.${lvl}`]);
    const expended =
      entry && typeof entry === 'object'
        ? (asNum((entry as Record<string, unknown>).filled) ?? 0)
        : 0;
    if (total > 0) {
      slots.push({ level: lvl, total, expended, isPact: true });
    }
  }

  const topSpells = (
    root.spells && typeof root.spells === 'object' ? root.spells : {}
  ) as Record<string, unknown>;
  const preparedSlugs = Array.isArray(topSpells.prepared)
    ? topSpells.prepared.filter((s): s is string => typeof s === 'string')
    : [];

  // Rich text blocks
  const textObj = (sheet.text && typeof sheet.text === 'object' ? sheet.text : {}) as Record<
    string,
    unknown
  >;
  const textBlocks: LssParsedSheet['textBlocks'] = [];
  for (const [key, rawBlock] of Object.entries(textObj)) {
    if (!rawBlock || typeof rawBlock !== 'object') continue;
    const br = rawBlock as Record<string, unknown>;
    if (br.isHidden === true) continue;
    const valObj = (br.value && typeof br.value === 'object' ? br.value : {}) as Record<
      string,
      unknown
    >;
    const nodes = parseRichDocNodes(valObj.data ?? valObj, resourcesMap);
    if (nodes.length === 0) continue;
    const label =
      asStr(br.customLabel) || TEXT_BLOCK_LABELS_RU[key] || `Раздел (${key})`;
    textBlocks.push({ key, label, nodes });
  }

  // SubInfo
  const subInfoMeta: Array<[string, string]> = [
    ['age', 'Возраст'],
    ['height', 'Рост'],
    ['weight', 'Вес'],
    ['eyes', 'Глаза'],
    ['skin', 'Кожа'],
    ['hair', 'Волосы'],
  ];
  const subInfo: Array<{ label: string; value: string }> = [];
  for (const [k, lbl] of subInfoMeta) {
    const val = asStr(subInfoObj[k]);
    if (val) subInfo.push({ label: lbl, value: val });
  }

  // Avatar
  let avatarUrl: string | null = null;
  if (sheet.avatar && typeof sheet.avatar === 'object') {
    const av = sheet.avatar as Record<string, unknown>;
    avatarUrl = asStr(av.webp) || asStr(av.jpeg) || null;
  }

  const conditions = Array.isArray(sheet.conditions)
    ? sheet.conditions.filter((c): c is string => typeof c === 'string')
    : [];
  const exhaustion = asNum(sheet.exhaustion) ?? 0;
  const inspiration = Boolean(sheet.inspiration);

  return {
    edition,
    name,
    classLabel,
    subclass,
    race,
    background,
    alignment,
    playerName,
    experience,
    level,
    proficiencyBonus,
    avatarUrl,
    inspiration,
    exhaustion,
    conditions,
    subInfo,
    abilities,
    skills,
    combat: {
      ac,
      shieldEquipped,
      initiative,
      speed,
      hitDie,
      hitDiceCurrent,
      darkvision,
      passivePerception,
      passiveInsight,
      passiveInvestigation,
      hpMaxComputed,
    },
    weapons,
    resources: Object.values(resourcesMap),
    attunements,
    profFlags,
    spellcasting: {
      baseAbility: baseCode,
      saveDc,
      attackBonus: spellAttackBonus,
      slots,
      preparedSlugs,
    },
    textBlocks,
  };
}

function randomDie(sides: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % sides) + 1;
}

export function rollD20WithModifier(modifier: number): {
  formula: string;
  breakdown: string;
  total: string;
  isCrit: boolean;
  critKind: 'success' | 'failure' | null;
} {
  const d20 = randomDie(20);
  const sum = d20 + modifier;
  const modPart = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`;
  const breakdownMod =
    modifier === 0 ? '' : modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  return {
    formula: `1к20${modPart}`,
    breakdown: `[${d20}]${breakdownMod} = ${sum}`,
    total: String(sum),
    isCrit: d20 === 20 || d20 === 1,
    critKind: d20 === 20 ? 'success' : d20 === 1 ? 'failure' : null,
  };
}

export function rollDamageExpression(resolvedExpr: string): {
  formula: string;
  breakdown: string;
  total: string;
} {
  const expr = resolvedExpr.trim() || '1';
  const parts: string[] = [];
  let sum = 0;

  // Tokenize +/- terms like `2к6`, `1d8`, `3`
  const normalized = expr.replace(/\s+/g, '');
  const tokens = normalized.match(/[+-]?[^+-]+/g) || [normalized];

  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[+-]/, '');
    const diceMatch = body.match(/^(\d*)[dкКD](\d+)$/);
    if (diceMatch) {
      const count = Math.min(30, Math.max(1, Number(diceMatch[1] || '1')));
      const sides = Math.max(2, Number(diceMatch[2]));
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) rolls.push(randomDie(sides));
      const subtotal = rolls.reduce((a, b) => a + b, 0) * sign;
      sum += subtotal;
      const prefix = parts.length === 0 ? (sign < 0 ? '-' : '') : sign < 0 ? ' - ' : ' + ';
      parts.push(`${prefix}[${rolls.join(', ')}]`);
    } else {
      const num = Number(body.replace(/[()]/g, ''));
      if (Number.isFinite(num)) {
        sum += num * sign;
        const prefix = parts.length === 0 ? (sign < 0 ? '-' : '') : sign < 0 ? ' - ' : ' + ';
        parts.push(`${prefix}${Math.abs(num)}`);
      }
    }
  }

  return {
    formula: expr,
    breakdown: `${parts.join('')} = ${sum}`,
    total: String(sum),
  };
}
