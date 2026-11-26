import { DND_CLASS_LABELS_RU, formatCharacterClassesRu } from './lss';
import type { ResourceColorKey, ResourceRecoverMode } from './lssResources';
import type { CharacterCoins, SpellCastMode } from './types';

export type AbilityCode = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

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
  { key: 'athletics', labelRu: 'Атлетика', defaultStat: 'str' },
  { key: 'acrobatics', labelRu: 'Акробатика', defaultStat: 'dex' },
  { key: 'sleight of hand', labelRu: 'Ловкость рук', defaultStat: 'dex' },
  { key: 'stealth', labelRu: 'Скрытность', defaultStat: 'dex' },
  { key: 'investigation', labelRu: 'Анализ', defaultStat: 'int' },
  { key: 'history', labelRu: 'История', defaultStat: 'int' },
  { key: 'arcana', labelRu: 'Магия', defaultStat: 'int' },
  { key: 'nature', labelRu: 'Природа', defaultStat: 'int' },
  { key: 'religion', labelRu: 'Религия', defaultStat: 'int' },
  { key: 'perception', labelRu: 'Восприятие', defaultStat: 'wis' },
  { key: 'survival', labelRu: 'Выживание', defaultStat: 'wis' },
  { key: 'medicine', labelRu: 'Медицина', defaultStat: 'wis' },
  { key: 'insight', labelRu: 'Проницательность', defaultStat: 'wis' },
  { key: 'animal handling', labelRu: 'Уход за животными', defaultStat: 'wis' },
  { key: 'performance', labelRu: 'Выступление', defaultStat: 'cha' },
  { key: 'intimidation', labelRu: 'Запугивание', defaultStat: 'cha' },
  { key: 'deception', labelRu: 'Обман', defaultStat: 'cha' },
  { key: 'persuasion', labelRu: 'Убеждение', defaultStat: 'cha' },
];

export const DND5E_XP_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

export function getXpProgressInfo(
  level: number,
  currentXp: number,
  customMaxXp = 0
): {
  currentXp: number;
  floorXp: number;
  targetXp: number;
  percent: number;
  canLevelUp: boolean;
} {
  const safeLevel = Math.min(20, Math.max(1, level || 1));
  const floorXp = customMaxXp > 0 ? 0 : (DND5E_XP_BY_LEVEL[safeLevel] ?? 0);
  const defaultNext =
    safeLevel >= 20 ? 355000 : (DND5E_XP_BY_LEVEL[safeLevel + 1] ?? 300);
  const targetXp = customMaxXp > 0 ? customMaxXp : defaultNext;
  const span = Math.max(1, targetXp - floorXp);
  const rawPct =
    safeLevel >= 20 && customMaxXp <= 0
      ? 100
      : Math.round(((currentXp - floorXp) / span) * 100);
  const percent = Math.min(100, Math.max(0, rawPct));
  return {
    currentXp,
    floorXp,
    targetXp,
    percent,
    canLevelUp: safeLevel < 20 && currentXp >= targetXp,
  };
}

export const TEXT_BLOCK_LABELS_RU: Record<string, string> = {
  traits: 'Умения и способности',
  features: 'Классовые и расовые черты',
  feats: 'Черты (Feats)',
  equipment: 'Снаряжение и инвентарь',
  items: 'Предметы и сокровища',
  prof: 'Владения и языки',
  attacks: 'Боевые приёмы и заметки об атаках',
  personality: 'Черты характера',
  ideals: 'Идеалы',
  bonds: 'Привязанности',
  flaws: 'Слабости',
  background: 'Предыстория и биография',
  appearance: 'Внешность',
  allies: 'Союзники и организации',
  quests: 'Личные цели',
  notes: 'Общие заметки',
  'notes-1': 'Заметки #1',
  'notes-2': 'Заметки #2',
  'notes-3': 'Заметки #3',
};

export const DEFAULT_EDITABLE_TEXT_KEYS = [
  'features',
  'traits',
  'feats',
  'equipment',
  'prof',
  'personality',
  'ideals',
  'bonds',
  'flaws',
  'background',
  'notes',
] as const;

export const PROF_FLAG_LABELS_RU: Record<string, string> = {
  'armor-light': 'Лёгкие доспехи',
  'armor-medium': 'Средние доспехи',
  'armor-heavy': 'Тяжёлые доспехи',
  'armor-label': 'Щиты',
  'weapon-simple': 'Простое оружие',
  'weapon-martial': 'Воинское оружие',
  'weapon-other': 'Особое оружие',
};

export const DND_CONDITIONS_RU = [
  'Бессознательный',
  'Испуган',
  'Истощён',
  'Концентрация',
  'Невидимый',
  'Недееспособный',
  'Оглохший',
  'Окаменевший',
  'Опутанный',
  'Ослеплённый',
  'Отравленный',
  'Очарованный',
  'Ошеломлённый',
  'Парализованный',
  'Сбитый с ног',
  'Схваченный',
];

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
  extraAttackMod: string;
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
  maxExpr: string;
  die: string;
  dieResolved: string;
  spendLimit: number;
  recoverMode: ResourceRecoverMode;
  color: ResourceColorKey;
  glyph: string;
  isShortRest: boolean;
  isLongRest: boolean;
  restLabel: string;
  notes: string;
}

export interface LssSpellCastConfig {
  mode: SpellCastMode;
  maxUses: number;
  used: number;
  resourceId: string;
  note: string;
}

export interface LssManualSpellRow {
  id: string;
  level: number;
  name: string;
  castingTime: string;
  range: string;
  concentration: boolean;
  ritual: boolean;
  material: boolean;
  notes: string;
  castMode: SpellCastMode;
  castMaxUses: number;
  castResourceId: string;
  castNote: string;
}

export interface LssParsedSheet {
  edition: string;
  name: string;
  rawCharClass: string;
  classLabel: string;
  subclass: string;
  race: string;
  background: string;
  alignment: string;
  size: string;
  playerName: string;
  experience: number | null;
  level: number;
  proficiencyBonus: number;
  avatarUrl: string | null;
  inspiration: boolean;
  exhaustion: number;
  conditions: string[];

  physical: {
    size: string;
    carryCapacity: string;
    highJump: string;
    longJump: string;
  };

  deathSaves: {
    success: number;
    fail: number;
  };

  coins: CharacterCoins;

  subInfo: Array<{ key: string; label: string; value: string }>;
  subInfoMap: Record<string, string>;

  abilities: Record<
    AbilityCode,
    {
      code: AbilityCode;
      shortRu: string;
      fullRu: string;
      baseScore: number;
      score: number;
      mod: number;
      checkBonus: number;
      saveBonus: number;
      saveExtraBonus: number;
      saveProf: boolean;
    }
  >;

  skills: Array<{
    key: string;
    labelRu: string;
    stat: AbilityCode;
    statShortRu: string;
    profLevel: 0 | 1 | 2;
    extraBonus: number;
    total: number;
  }>;

  combat: {
    ac: number;
    acFormula: string;
    shieldEquipped: boolean;
    shieldMod: string;
    initiative: number;
    initiativeRaw: string;
    speed: string;
    speedRaw: string;
    hitDie: string;
    hitDiceCurrent: number;
    darkvision: number;
    passivePerception: number;
    passiveInsight: number;
    passiveInvestigation: number;
    hpCurrent: number;
    hpTemp: number;
    hpMaxBase: number;
    hpMaxBonus: number;
    hpMaxComputed: number;
  };

  weapons: LssParsedWeapon[];
  resources: LssParsedResource[];
  attunements: Array<{ id: string; name: string; active: boolean }>;
  profFlags: string[];
  profFlagKeys: string[];

  spellcasting: {
    baseAbility: AbilityCode | null;
    abilityMod: number | null;
    saveDc: number | null;
    attackBonus: number | null;
    slotsByLevel: Record<number, { total: number; expended: number }>;
    pactSlots: { level: number; total: number; expended: number };
    slots: Array<{ level: number; total: number; expended: number; isPact?: boolean }>;
    preparedSlugs: string[];
    manualSpells: LssManualSpellRow[];
    castConfigs: Record<string, LssSpellCastConfig>;
  };

  textBlocks: Array<{
    key: string;
    label: string;
    plainText: string;
    nodes: LssRichParagraph[];
  }>;
  textByKey: Record<
    string,
    {
      key: string;
      label: string;
      plainText: string;
      nodes: LssRichParagraph[];
    }
  >;
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

  let expr = trimmed.replace(/\[([a-zA-Z_]+)\]/g, (_, rawName: string) => {
    const key = rawName.toUpperCase();
    const val = vars[key] ?? 0;
    return `(${val})`;
  });

  expr = expr.replace(/\d*\s*[dкКD]\s*\d+/g, '0');

  expr = expr
    .replace(/\bfloor\s*\(/gi, 'Math.floor(')
    .replace(/\bceil\s*\(/gi, 'Math.ceil(')
    .replace(/\bround\s*\(/gi, 'Math.round(')
    .replace(/\bmin\s*\(/gi, 'Math.min(')
    .replace(/\bmax\s*\(/gi, 'Math.max(');

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
  if (!rawDmg.trim()) return '1к4';
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

function applyProseMirrorMarks(rawText: string, marks: unknown): string {
  if (!rawText || !Array.isArray(marks) || marks.length === 0) return rawText;
  const types = new Set(
    marks
      .map((m) =>
        m && typeof m === 'object' && typeof (m as Record<string, unknown>).type === 'string'
          ? String((m as Record<string, unknown>).type).toLowerCase()
          : ''
      )
      .filter(Boolean)
  );
  let out = rawText;
  if (types.has('code')) out = `\`${out}\``;
  if (types.has('strike') || types.has('strikethrough')) out = `~~${out}~~`;
  if (types.has('underline')) out = `__${out}__`;
  if (types.has('italic') || types.has('em')) out = `*${out}*`;
  if (types.has('bold') || types.has('strong')) out = `**${out}**`;
  return out;
}

function extractInlineText(
  node: unknown,
  resourcesMap: Record<string, LssParsedResource>,
  onResourceRef?: () => void
): string {
  if (!node || typeof node !== 'object') return '';
  const r = node as Record<string, unknown>;
  const type = typeof r.type === 'string' ? r.type : '';

  if (type === 'text') {
    const raw = typeof r.text === 'string' ? r.text : '';
    return applyProseMirrorMarks(raw, r.marks);
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
    return label ? `[roll: ${label}]` : '';
  }
  if (type === 'resource') {
    onResourceRef?.();
    const attrs = (r.attrs && typeof r.attrs === 'object' ? r.attrs : {}) as Record<
      string,
      unknown
    >;
    const id = asStr(attrs.id);
    const res = id ? resourcesMap[id] : undefined;
    if (res) {
      return `[res: ${res.name}: ${res.current}/${res.max}]`;
    }
    return '';
  }

  if (Array.isArray(r.content)) {
    return r.content.map((c) => extractInlineText(c, resourcesMap, onResourceRef)).join('');
  }
  return '';
}

function parseRichDocNodes(
  docNode: unknown,
  resourcesMap: Record<string, LssParsedResource>,
  onResourceRef?: () => void
): LssRichParagraph[] {
  if (typeof docNode === 'string' && docNode.trim()) {
    return docNode
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text) => ({ kind: 'paragraph' as const, text }));
  }
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

    if (bType === 'heading') {
      const attrs = (b.attrs && typeof b.attrs === 'object' ? b.attrs : {}) as Record<
        string,
        unknown
      >;
      const level = Math.min(3, Math.max(1, asNum(attrs.level) ?? 3));
      const text = extractInlineText(b, resourcesMap, onResourceRef).trim();
      if (text) {
        out.push({ kind: 'paragraph', text: `${'#'.repeat(level)} ${text}` });
      }
      continue;
    }

    if (bType === 'blockquote') {
      const text = extractInlineText(b, resourcesMap, onResourceRef).trim();
      if (text) {
        const quoted = text
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        out.push({ kind: 'paragraph', text: quoted });
      }
      continue;
    }

    if (bType === 'bulletList' || bType === 'orderedList' || bType === 'taskList') {
      const itemsRaw = Array.isArray(b.content) ? b.content : [];
      const items: string[] = [];
      for (const li of itemsRaw) {
        const text = extractInlineText(li, resourcesMap, onResourceRef).trim();
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
          summary = extractInlineText(cr, resourcesMap, onResourceRef).trim() || summary;
        } else {
          const t = extractInlineText(cr, resourcesMap, onResourceRef).trim();
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

    const text = extractInlineText(b, resourcesMap, onResourceRef).trim();
    if (text) {
      out.push({ kind: 'paragraph', text });
    }
  }

  return out;
}

export function nodesToPlainText(nodes: LssRichParagraph[]): string {
  return nodes
    .map((n) => {
      if (n.kind === 'divider') return '---';
      if (n.kind === 'bullet') return (n.items ?? []).map((it) => `• ${it}`).join('\n');
      if (n.kind === 'ordered')
        return (n.items ?? []).map((it, idx) => `${idx + 1}. ${it}`).join('\n');
      if (n.kind === 'spoiler') return `${n.title ? `${n.title}:\n` : ''}${n.text}`;
      return n.text;
    })
    .filter(Boolean)
    .join('\n\n');
}

function inlineLineToProseMirrorNodes(
  line: string,
  inheritedMarks: Array<{ type: string }> = []
): Array<Record<string, unknown>> {
  if (!line) return [];
  const TOKEN_RE =
    /(\*\*\*([^\n]+?)\*\*\*|\*\*([^\n]+?)\*\*|__([^\n]+?)__|~~([^\n]+?)~~|\*([^\n*]+?)\*|`([^\n`]+?)`|\[(?:roll:|\u{1F3B2})\s*([^\]]+?)\])/gu;

  const out: Array<Record<string, unknown>> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const pushText = (txt: string, marks: Array<{ type: string }>) => {
    if (!txt) return;
    if (marks.length > 0) {
      out.push({ type: 'text', text: txt, marks });
    } else {
      out.push({ type: 'text', text: txt });
    }
  };

  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m.index > lastIndex) {
      pushText(line.slice(lastIndex, m.index), inheritedMarks);
    }

    if (m[2] !== undefined) {
      out.push(
        ...inlineLineToProseMirrorNodes(m[2], [
          ...inheritedMarks,
          { type: 'bold' },
          { type: 'italic' },
        ])
      );
    } else if (m[3] !== undefined) {
      out.push(...inlineLineToProseMirrorNodes(m[3], [...inheritedMarks, { type: 'bold' }]));
    } else if (m[4] !== undefined) {
      out.push(...inlineLineToProseMirrorNodes(m[4], [...inheritedMarks, { type: 'underline' }]));
    } else if (m[5] !== undefined) {
      out.push(...inlineLineToProseMirrorNodes(m[5], [...inheritedMarks, { type: 'strike' }]));
    } else if (m[6] !== undefined) {
      out.push(...inlineLineToProseMirrorNodes(m[6], [...inheritedMarks, { type: 'italic' }]));
    } else if (m[7] !== undefined) {
      pushText(m[7], [...inheritedMarks, { type: 'code' }]);
    } else if (m[8] !== undefined) {
      const f = m[8].trim();
      out.push({ type: 'roller', attrs: { formula: f, label: f } });
    }

    lastIndex = m.index + m[0].length;
  }

  if (lastIndex < line.length) {
    pushText(line.slice(lastIndex), inheritedMarks);
  }

  return out;
}

export function plainTextToLssDoc(text: string): Record<string, unknown> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const content: Array<Record<string, unknown>> = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^(-{3,}|—{2,}|\*{3,})$/.test(trimmed)) {
      content.push({ type: 'horizontalRule' });
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const inline = inlineLineToProseMirrorNodes(headingMatch[2]);
      content.push({
        type: 'heading',
        attrs: { level },
        content: inline.length > 0 ? inline : [{ type: 'text', text: headingMatch[2] }],
      });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteParagraphs: Array<Record<string, unknown>> = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        const qLine = lines[i].trim().replace(/^>\s?/, '');
        const inline = inlineLineToProseMirrorNodes(qLine);
        if (inline.length > 0) {
          quoteParagraphs.push({ type: 'paragraph', content: inline });
        }
        i += 1;
      }
      if (quoteParagraphs.length > 0) {
        content.push({ type: 'blockquote', content: quoteParagraphs });
      }
      continue;
    }

    if (/^([•\-*])\s+/.test(trimmed)) {
      const listItems: Array<Record<string, unknown>> = [];
      while (i < lines.length && /^([•\-*])\s+/.test(lines[i].trim())) {
        const liText = lines[i].trim().replace(/^([•\-*])\s+/, '');
        const inline = inlineLineToProseMirrorNodes(liText);
        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: inline.length > 0 ? inline : [{ type: 'text', text: liText }],
            },
          ],
        });
        i += 1;
      }
      content.push({ type: 'bulletList', content: listItems });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const listItems: Array<Record<string, unknown>> = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        const liText = lines[i].trim().replace(/^\d+[.)]\s+/, '');
        const inline = inlineLineToProseMirrorNodes(liText);
        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: inline.length > 0 ? inline : [{ type: 'text', text: liText }],
            },
          ],
        });
        i += 1;
      }
      content.push({ type: 'orderedList', content: listItems });
      continue;
    }

    const inline = inlineLineToProseMirrorNodes(rawLine);
    content.push({
      type: 'paragraph',
      content: inline.length > 0 ? inline : [{ type: 'text', text: rawLine }],
    });
    i += 1;
  }

  return {
    data: {
      type: 'doc',
      content,
    },
  };
}

export interface LssMutableBundle {
  root: Record<string, unknown>;
  sheet: Record<string, unknown>;
  mode: 'data-string' | 'data-object' | 'flat';
}

const richBlockMemo = new WeakMap<
  object,
  { resSig: string | null; plainText: string; nodes: LssRichParagraph[] }
>();

/**
 * Unwraps a raw LSS JSON string into `{ root, sheet, mode }` so mutations
 * preserve 100% of original LSS metadata (`bonuses`, `effects`, `spells`, `avatar`, etc.).
 */
export function unwrapLssJsonMutable(rawJson: string | null | undefined): LssMutableBundle {
  if (!rawJson) {
    return createBlankLssStructures();
  }
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return createBlankLssStructures();
    }
    const root = parsed as Record<string, unknown>;
    if (typeof root.data === 'string') {
      try {
        const sheet = JSON.parse(root.data) as Record<string, unknown>;
        return { root, sheet, mode: 'data-string' };
      } catch {
        return { root, sheet: root, mode: 'flat' };
      }
    }
    if (root.data && typeof root.data === 'object') {
      return {
        root,
        sheet: root.data as Record<string, unknown>,
        mode: 'data-object',
      };
    }
    if (typeof root.json === 'string') {
      try {
        const sheet = JSON.parse(root.json) as Record<string, unknown>;
        return { root, sheet, mode: 'data-string' };
      } catch {
        return { root, sheet: root, mode: 'flat' };
      }
    }
    return { root, sheet: root, mode: 'flat' };
  } catch {
    return createBlankLssStructures();
  }
}

export function createBlankLssStructures(initialName = 'Новый герой'): {
  root: Record<string, unknown>;
  sheet: Record<string, unknown>;
  mode: 'data-string';
} {
  const sheet: Record<string, unknown> = {
    name: { value: initialName },
    info: {
      charClass: { value: 'Fighter' },
      charSubclass: { value: '' },
      level: { value: 1 },
      race: { value: 'Человек' },
      background: { value: '' },
      alignment: { value: '' },
      experience: { value: 0 },
    },
    subInfo: {
      age: { value: '' },
      height: { value: '' },
      weight: { value: '' },
      eyes: { value: '' },
      skin: { value: '' },
      hair: { value: '' },
    },
    stats: {
      str: { name: 'str', score: 10 },
      dex: { name: 'dex', score: 10 },
      con: { name: 'con', score: 10 },
      int: { name: 'int', score: 10 },
      wis: { name: 'wis', score: 10 },
      cha: { name: 'cha', score: 10 },
    },
    saves: {
      str: { name: 'str', isProf: false },
      dex: { name: 'dex', isProf: false },
      con: { name: 'con', isProf: false },
      int: { name: 'int', isProf: false },
      wis: { name: 'wis', isProf: false },
      cha: { name: 'cha', isProf: false },
    },
    skills: Object.fromEntries(
      SKILL_META.map((sk) => [
        sk.key,
        { baseStat: sk.defaultStat, name: sk.key, isProf: 0 },
      ])
    ),
    vitality: {
      'hp-current': { value: 10 },
      'hp-max': { value: 10 },
      'hp-temp': { value: 0 },
      'hp-max-bonus': { value: 0 },
      'hit-die': { value: 'd10' },
      'hp-dice-current': { value: 1 },
      ac: { value: '10+[DEX]' },
      shield: { value: false, mod: '2' },
      speed: { value: '30' },
      initiative: { value: '[DEX]' },
      darkvision: { value: 0 },
      deathSaves: { success: 0, fail: 0 },
    },
    weaponsList: [],
    resources: {},
    coins: {
      pp: { value: 0 },
      gp: { value: 0 },
      ep: { value: 0 },
      sp: { value: 0 },
      cp: { value: 0 },
    },
    prof: {
      'armor-light': { value: false },
      'armor-medium': { value: false },
      'armor-heavy': { value: false },
      'armor-label': { value: false },
      'weapon-simple': { value: false },
      'weapon-martial': { value: false },
      'weapon-other': { value: false },
    },
    attunementsList: [],
    spellsInfo: {
      base: { code: '' },
    },
    spells: {},
    spellsPact: {},
    text: {
      features: { value: plainTextToLssDoc('') },
      equipment: { value: plainTextToLssDoc('') },
      notes: { value: plainTextToLssDoc('') },
    },
    inspiration: false,
    exhaustion: 0,
    conditions: [],
  };

  const root: Record<string, unknown> = {
    jsonType: 'character',
    version: '2',
    edition: '2014',
    spells: { mode: 'cards', prepared: [], book: [] },
    data: JSON.stringify(sheet),
  };

  return { root, sheet, mode: 'data-string' };
}

export function packLssStructures(bundle: {
  root: Record<string, unknown>;
  sheet: Record<string, unknown>;
  mode: 'data-string' | 'data-object' | 'flat';
}): Record<string, unknown> {
  if (bundle.mode === 'data-string') {
    return {
      ...bundle.root,
      jsonType: bundle.root.jsonType ?? 'character',
      version: bundle.root.version ?? '2',
      data: JSON.stringify(bundle.sheet),
    };
  }
  if (bundle.mode === 'data-object') {
    return {
      ...bundle.root,
      data: bundle.sheet,
    };
  }
  return {
    jsonType: 'character',
    version: '2',
    edition: bundle.sheet.edition ?? '2014',
    spells: { mode: 'cards', prepared: [], book: [] },
    data: JSON.stringify(bundle.sheet),
  };
}

export function mutateLssRawJson(
  rawJson: string | null | undefined,
  mutator: (sheet: Record<string, unknown>, root: Record<string, unknown>) => void
): Record<string, unknown> {
  const bundle = unwrapLssJsonMutable(rawJson);
  mutator(bundle.sheet, bundle.root);
  return packLssStructures(bundle);
}

/**
 * Helper to write a `{ value: X }` field in an LSS object while preserving other sibling properties.
 */
export function setLssField(
  parent: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  const existing = parent[key];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    parent[key] = { ...(existing as Record<string, unknown>), value };
  } else {
    parent[key] = { value };
  }
}

export function ensureObj(
  parent: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) {
    parent[key] = {};
  }
  return parent[key] as Record<string, unknown>;
}

/**
 * Parses a raw Long Story Short character `.json` string into a complete
 * renderable and editable D&D 5e sheet model.
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

  return parseLssSheetFromObjects(sheet, root);
}

/**
 * Ultra-fast zero-serialization parser that derives `LssParsedSheet` directly from
 * in-memory `(sheet, root)` objects (<0.1ms per call — no JSON.parse/stringify!).
 */
export function parseLssSheetFromObjects(
  sheet: Record<string, unknown>,
  root: Record<string, unknown>
): LssParsedSheet {
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
  const coinsRaw = (
    sheet.coins && typeof sheet.coins === 'object' ? sheet.coins : {}
  ) as Record<string, unknown>;

  const name = asStr(sheet.name) || asStr(info.name) || 'Безымянный герой';
  const rawCharClass = asStr(info.charClass) || asStr(sheet.charClass) || '';
  const classLabel =
    formatCharacterClassesRu(rawCharClass) || DND_CLASS_LABELS_RU[rawCharClass] || rawCharClass;
  const subclass = asStr(info.charSubclass) || asStr(sheet.subclass);
  const race = asStr(info.race) || asStr(sheet.race);
  const background = asStr(info.background);
  const alignment = asStr(info.alignment);
  const playerName = asStr(info.playerName);
  const experience = asNum(info.experience) ?? null;
  const level = Math.max(1, Math.min(20, asNum(info.level) ?? asNum(sheet.level) ?? 1));

  const defaultProf = Math.floor((level - 1) / 4) + 2;
  const customProf = asNum(sheet.proficiencyCustom);
  const proficiencyBonus =
    customProf && customProf > 0
      ? customProf
      : (asNum(sheet.proficiency) ?? defaultProf);

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
    LEVEL: level,
    PROF: proficiencyBonus,
    PB: proficiencyBonus,
    STR: Math.floor((baseScores.str - 10) / 2),
    DEX: Math.floor((baseScores.dex - 10) / 2),
    CON: Math.floor((baseScores.con - 10) / 2),
    INT: Math.floor((baseScores.int - 10) / 2),
    WIS: Math.floor((baseScores.wis - 10) / 2),
    CHA: Math.floor((baseScores.cha - 10) / 2),
  };

  let bonuses = collectActiveBonuses(sheet, initialVars);

  const finalScores: Record<AbilityCode, number> = { ...baseScores };
  for (const code of Object.keys(ABILITY_META) as AbilityCode[]) {
    finalScores[code] = applyBonusesToBase(baseScores[code], bonuses, [`stat.${code}.score`]);
  }

  const vars: FormulaVars = {
    LVL: level,
    LEVEL: level,
    PROF: proficiencyBonus,
    PB: proficiencyBonus,
    STR: Math.floor((finalScores.str - 10) / 2),
    DEX: Math.floor((finalScores.dex - 10) / 2),
    CON: Math.floor((finalScores.con - 10) / 2),
    INT: Math.floor((finalScores.int - 10) / 2),
    WIS: Math.floor((finalScores.wis - 10) / 2),
    CHA: Math.floor((finalScores.cha - 10) / 2),
  };
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
    const saveExtraBonus = asNum(saveRaw.bonus) ?? 0;

    let saveBase = mod + (saveProf ? proficiencyBonus : 0) + saveExtraBonus;
    if (typeof saveRaw.bonusExpr === 'string') {
      const exprVal = evalLssNumericFormula(saveRaw.bonusExpr, vars);
      if (exprVal !== null) saveBase += exprVal;
    }
    let saveBonus = applyBonusesToBase(saveBase, bonuses, ['save.all', `save.${code}`]);
    if (
      saveRaw.customModifier !== undefined &&
      saveRaw.customModifier !== null &&
      saveRaw.customModifier !== ''
    ) {
      const cm = evalLssNumericFormula(saveRaw.customModifier as string | number, vars);
      if (cm !== null) saveBonus = cm;
    }

    const checkBonus = applyBonusesToBase(mod, bonuses, ['check.all', `stat.${code}.check`]);

    abilities[code] = {
      code,
      shortRu: ABILITY_META[code].shortRu,
      fullRu: ABILITY_META[code].fullRu,
      baseScore: baseScores[code],
      score,
      mod,
      checkBonus,
      saveBonus,
      saveExtraBonus,
      saveProf,
    };
  }

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

    for (const b of bonuses) {
      if (b.target === `prof.skill.${meta.key}`) {
        if (b.val >= 2) profLevel = 2;
        else if (b.val >= 1 && profLevel < 1) profLevel = 1;
      }
    }

    const extraBonus = asNum(raw.bonus) ?? 0;
    const statMod = abilities[stat].mod;
    const profAdd =
      profLevel === 2 ? proficiencyBonus * 2 : profLevel === 1 ? proficiencyBonus : 0;
    let total = statMod + profAdd + extraBonus;
    if (typeof raw.bonusExpr === 'string') {
      const exprVal = evalLssNumericFormula(raw.bonusExpr, vars);
      if (exprVal !== null) total += exprVal;
    }
    total = applyBonusesToBase(total, bonuses, [
      'check.all',
      `stat.${stat}.check`,
      `skill.${meta.key}`,
    ]);
    if (
      raw.customModifier !== undefined &&
      raw.customModifier !== null &&
      raw.customModifier !== ''
    ) {
      const cm = evalLssNumericFormula(raw.customModifier as string | number, vars);
      if (cm !== null) total = cm;
    }

    return {
      key: meta.key,
      labelRu: meta.labelRu,
      stat,
      statShortRu: ABILITY_META[stat].shortRu,
      profLevel,
      extraBonus,
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
  const shieldModStr = asStr(shieldObj.mod) || '2';
  if (shieldEquipped) {
    const shieldMod = evalLssNumericFormula(shieldModStr, vars) ?? 2;
    ac += applyBonusesToBase(shieldMod, bonuses, ['shield']);
  }
  ac = applyBonusesToBase(ac, bonuses, ['ac']);

  const initRawVal = unwrapVal(vitality.initiative);
  const initiativeRaw =
    initRawVal !== null && initRawVal !== undefined && String(initRawVal).trim() !== ''
      ? String(initRawVal).trim()
      : '[DEX]';
  const initBase = evalLssNumericFormula(initiativeRaw, vars) ?? abilities.dex.mod;
  const initiative = applyBonusesToBase(initBase, bonuses, [
    'initiative',
    'check.all',
    'stat.dex.check',
  ]);

  const speedRaw = asStr(vitality.speed) || '30';
  const speedEval = evalLssNumericFormula(speedRaw, vars);
  const speed =
    speedEval !== null
      ? `${applyBonusesToBase(speedEval, bonuses, ['speed.walk'])} фт.`
      : speedRaw;

  const hitDie = asStr(vitality['hit-die']) || 'd8';
  const hitDiceCurrent = Math.max(0, asNum(vitality['hp-dice-current']) ?? level);
  const darkvision = asNum(vitality.darkvision) ?? 0;

  const hpCurrent = Math.max(0, asNum(vitality['hp-current']) ?? 10);
  const hpTemp = Math.max(0, asNum(vitality['hp-temp']) ?? 0);
  const hpMaxBase = Math.max(1, asNum(vitality['hp-max']) ?? 10);
  const hpMaxBonus = asNum(vitality['hp-max-bonus']) ?? 0;
  const hpMaxComputed = Math.max(
    1,
    applyBonusesToBase(hpMaxBase + hpMaxBonus, bonuses, ['hp.max'])
  );

  // Death saves (LSS stores either vitality.deathSaves or sheet.deathSaves or vitality['death-saves-*'])
  const dsObj = (
    vitality.deathSaves && typeof vitality.deathSaves === 'object'
      ? vitality.deathSaves
      : sheet.deathSaves && typeof sheet.deathSaves === 'object'
        ? sheet.deathSaves
        : {}
  ) as Record<string, unknown>;
  const deathSuccess = Math.min(
    3,
    Math.max(0, asNum(dsObj.success) ?? asNum(vitality['death-saves-success']) ?? 0)
  );
  const deathFail = Math.min(
    3,
    Math.max(0, asNum(dsObj.fail) ?? asNum(vitality['death-saves-fail']) ?? 0)
  );

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

  // Coins
  const coins: CharacterCoins = {
    pp: Math.max(0, asNum(coinsRaw.pp) ?? 0),
    gp: Math.max(0, asNum(coinsRaw.gp) ?? 0),
    ep: Math.max(0, asNum(coinsRaw.ep) ?? 0),
    sp: Math.max(0, asNum(coinsRaw.sp) ?? 0),
    cp: Math.max(0, asNum(coinsRaw.cp) ?? 0),
  };

  // Weapons
  const rawWeapons = Array.isArray(sheet.weaponsList) ? sheet.weaponsList : [];
  const weapons: LssParsedWeapon[] = [];
  for (let idx = 0; idx < rawWeapons.length; idx++) {
    const w = rawWeapons[idx];
    if (!w || typeof w !== 'object') continue;
    const wr = w as Record<string, unknown>;
    const wName = asStr(wr.name);
    if (!wName) continue;
    const wId = asStr(wr.id) || `weapon-${idx}`;
    const ability: AbilityCode | 'none' =
      typeof wr.ability === 'string' && wr.ability in ABILITY_META
        ? (wr.ability as AbilityCode)
        : wr.ability === 'none'
          ? 'none'
          : 'str';
    const isProf = wr.isProf !== false;
    const statAttackMod = ability === 'none' ? 0 : abilities[ability].mod;
    const extraAttackMod = asStr(wr.mod) || '0';
    const extraMod = evalLssNumericFormula(extraAttackMod, vars) ?? 0;
    const attackBase = statAttackMod + (isProf ? proficiencyBonus : 0) + extraMod;
    const attackTargets = ['attack.all', `weapon.${wId}.attack`];
    if (ability !== 'none') attackTargets.push(`stat.${ability}.attack`);
    const attackBonus = applyBonusesToBase(attackBase, bonuses, attackTargets);

    const damageRaw = asStr(wr.dmg) || '1к6+[STR]';
    const damageResolved = resolveWeaponDamageString(damageRaw, vars);
    const damageType = asStr(wr.dmgType);
    const notes = asStr(wr.notes);

    weapons.push({
      id: wId,
      name: wName,
      ability,
      isProf,
      extraAttackMod,
      attackBonus,
      damageRaw,
      damageResolved,
      damageType,
      notes,
    });
  }

  // Resources (LSS Unique Resources: pools, rogue dice, psi charges, presets, formulas)
  const VALID_RES_COLORS = new Set<ResourceColorKey>([
    'violet',
    'cyan',
    'amber',
    'crimson',
    'emerald',
  ]);
  const VALID_RECOVER_MODES = new Set<ResourceRecoverMode>([
    'all',
    'half_up',
    'half_down',
    'one',
  ]);

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
    const maxExpr = typeof rr.maxExpr === 'string' ? rr.maxExpr.trim() : '';
    const maxFromExpr = maxExpr ? evalLssNumericFormula(maxExpr, vars) : null;
    const currentRaw = Math.max(0, asNum(rr.current) ?? 0);
    const max = Math.max(1, maxFromExpr ?? asNum(rr.max) ?? Math.max(1, currentRaw));
    const current = Math.min(max, currentRaw);
    const dieRaw = asStr(rr.die);
    const dieResolved = dieRaw ? resolveWeaponDamageString(dieRaw, vars) : '';
    const spendLimit = Math.max(0, asNum(rr.spendLimit) ?? 0);
    const rawRec = asStr(rr.recoverMode) as ResourceRecoverMode;
    const recoverMode: ResourceRecoverMode = VALID_RECOVER_MODES.has(rawRec) ? rawRec : 'all';
    const rawColor = asStr(rr.color) as ResourceColorKey;
    const color: ResourceColorKey = VALID_RES_COLORS.has(rawColor) ? rawColor : 'amber';
    const glyph = asStr(rr.glyph) || (dieRaw ? 'dice' : spendLimit > 0 ? 'orb' : 'bolt');
    const isShortRest = Boolean(rr.isShortRest);
    const isLongRest = Boolean(rr.isLongRest);
    const recSuffix =
      recoverMode === 'half_up'
        ? ' (½↑)'
        : recoverMode === 'half_down'
          ? ' (½↓)'
          : recoverMode === 'one'
            ? ' (+1)'
            : '';
    const restLabel = isShortRest
      ? `кор. отдых${recSuffix}`
      : isLongRest
        ? `дл. отдых${recSuffix}`
        : '';
    const rId = asStr(rr.id) || key;
    resourcesMap[rId] = {
      id: rId,
      name: rName,
      current,
      max,
      maxExpr,
      die: dieRaw,
      dieResolved,
      spendLimit,
      recoverMode,
      color,
      glyph,
      isShortRest,
      isLongRest,
      restLabel,
      notes: asStr(rr.notes),
    };
  }

  // Attunements & Proficiencies
  const attunements: LssParsedSheet['attunements'] = [];
  if (Array.isArray(sheet.attunementsList)) {
    sheet.attunementsList.forEach((a, idx) => {
      if (a && typeof a === 'object') {
        const ar = a as Record<string, unknown>;
        const val = asStr(ar.value);
        const id = asStr(ar.id) || `attune-${idx}`;
        if (val) attunements.push({ id, name: val, active: Boolean(ar.checked) });
      }
    });
  }

  const profObj = (sheet.prof && typeof sheet.prof === 'object' ? sheet.prof : {}) as Record<
    string,
    unknown
  >;
  const profFlags: string[] = [];
  const profFlagKeys: string[] = [];
  for (const [k, label] of Object.entries(PROF_FLAG_LABELS_RU)) {
    const checked =
      Boolean(unwrapVal(profObj[k])) ||
      bonuses.some((b) => b.target === `prof.${k}` && b.val > 0);
    if (checked) {
      profFlags.push(label);
      profFlagKeys.push(k);
    }
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
  const slotsByLevel: Record<number, { total: number; expended: number }> = {};
  const spellsSlotsObj = (
    sheet.spells && typeof sheet.spells === 'object' ? sheet.spells : {}
  ) as Record<string, unknown>;
  for (let lvl = 1; lvl <= 9; lvl++) {
    const entry = spellsSlotsObj[`slots-${lvl}`];
    const baseSlotVal =
      entry && typeof entry === 'object'
        ? (asNum((entry as Record<string, unknown>).value) ?? 0)
        : 0;
    const total = Math.max(0, applyBonusesToBase(baseSlotVal, bonuses, [`spellSlot.${lvl}`]));
    const expended = Math.min(
      total,
      Math.max(
        0,
        entry && typeof entry === 'object'
          ? (asNum((entry as Record<string, unknown>).filled) ?? 0)
          : 0
      )
    );
    slotsByLevel[lvl] = { total, expended };
    if (total > 0) {
      slots.push({ level: lvl, total, expended });
    }
  }

  const pactSlotsObj = (
    sheet.spellsPact && typeof sheet.spellsPact === 'object' ? sheet.spellsPact : {}
  ) as Record<string, unknown>;
  let pactSlots = { level: 1, total: 0, expended: 0 };
  for (let lvl = 1; lvl <= 9; lvl++) {
    const entry = pactSlotsObj[`slots-${lvl}`];
    const baseSlotVal =
      entry && typeof entry === 'object'
        ? (asNum((entry as Record<string, unknown>).value) ?? 0)
        : 0;
    const total = Math.max(0, applyBonusesToBase(baseSlotVal, bonuses, [`pactSlot.${lvl}`]));
    const expended = Math.min(
      total,
      Math.max(
        0,
        entry && typeof entry === 'object'
          ? (asNum((entry as Record<string, unknown>).filled) ?? 0)
          : 0
      )
    );
    if (total > 0) {
      pactSlots = { level: lvl, total, expended };
      slots.push({ level: lvl, total, expended, isPact: true });
    }
  }

  const topSpells = (
    root.spells && typeof root.spells === 'object' ? root.spells : {}
  ) as Record<string, unknown>;
  const preparedSlugs = Array.isArray(topSpells.prepared)
    ? topSpells.prepared.filter((s): s is string => typeof s === 'string')
    : [];

  const VALID_SPELL_CAST_MODES = new Set<SpellCastMode>([
    'slot',
    'at_will',
    'long_rest',
    'short_rest',
    'resource',
    'ritual_only',
    'custom',
  ]);

  // Per-spell cast configs stored in sheet.spellCastConfigs (keyed by "cat-<spellId>" or manual spell id)
  const rawCastConfigs = (
    sheet.spellCastConfigs && typeof sheet.spellCastConfigs === 'object'
      ? sheet.spellCastConfigs
      : {}
  ) as Record<string, unknown>;
  const castConfigs: Record<string, LssSpellCastConfig> = {};
  for (const [key, val] of Object.entries(rawCastConfigs)) {
    if (!val || typeof val !== 'object') continue;
    const cr = val as Record<string, unknown>;
    const rawMode = asStr(cr.mode) as SpellCastMode;
    const mode: SpellCastMode = VALID_SPELL_CAST_MODES.has(rawMode) ? rawMode : 'slot';
    const maxUses = Math.max(1, asNum(cr.maxUses) ?? 1);
    const used = Math.min(maxUses, Math.max(0, asNum(cr.used) ?? 0));
    castConfigs[key] = {
      mode,
      maxUses,
      used,
      resourceId: asStr(cr.resourceId),
      note: asStr(cr.note),
    };
  }

  // Manual spell rows stored inside sheet.manualSpells
  const manualSpellsRaw = Array.isArray(sheet.manualSpells) ? sheet.manualSpells : [];
  const manualSpells: LssManualSpellRow[] = [];
  manualSpellsRaw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const r = item as Record<string, unknown>;
    const spName = asStr(r.name);
    if (!spName) return;
    const rawMode = asStr(r.castMode) as SpellCastMode;
    manualSpells.push({
      id: asStr(r.id) || `mspell-${idx}`,
      level: Math.min(9, Math.max(0, asNum(r.level) ?? 0)),
      name: spName,
      castingTime: asStr(r.castingTime) || '1 д.',
      range: asStr(r.range) || '60 фт.',
      concentration: Boolean(r.concentration),
      ritual: Boolean(r.ritual),
      material: Boolean(r.material),
      notes: asStr(r.notes),
      castMode: VALID_SPELL_CAST_MODES.has(rawMode) ? rawMode : 'slot',
      castMaxUses: Math.max(1, asNum(r.castMaxUses) ?? 1),
      castResourceId: asStr(r.castResourceId),
      castNote: asStr(r.castNote),
    });
  });

  // Rich text blocks (memoized by valObj identity + resource summary so HP/stat/slot edits skip ProseMirror walks!)
  const resourceSig = Object.values(resourcesMap)
    .map((r) => `${r.id}:${r.current}/${r.max}`)
    .join('|');
  const textObj = (sheet.text && typeof sheet.text === 'object' ? sheet.text : {}) as Record<
    string,
    unknown
  >;
  const textBlocks: LssParsedSheet['textBlocks'] = [];
  const textByKey: LssParsedSheet['textByKey'] = {};
  for (const [key, rawBlock] of Object.entries(textObj)) {
    if (!rawBlock || typeof rawBlock !== 'object') continue;
    const br = rawBlock as Record<string, unknown>;
    if (br.isHidden === true) continue;
    const valObj = br.value;
    let nodes: LssRichParagraph[] = [];
    let plainText = '';

    if (valObj && typeof valObj === 'object') {
      const cached = richBlockMemo.get(valObj);
      if (cached && (cached.resSig === null || cached.resSig === resourceSig)) {
        nodes = cached.nodes;
        plainText = cached.plainText;
      } else {
        const vo = valObj as Record<string, unknown>;
        let usedRes = false;
        nodes = parseRichDocNodes(vo.data ?? vo, resourcesMap, () => {
          usedRes = true;
        });
        plainText = nodesToPlainText(nodes);
        richBlockMemo.set(valObj, {
          resSig: usedRes ? resourceSig : null,
          plainText,
          nodes,
        });
      }
    } else if (typeof valObj === 'string') {
      nodes = parseRichDocNodes(valObj, resourcesMap);
      plainText = nodesToPlainText(nodes);
    }

    const label =
      asStr(br.customLabel) || TEXT_BLOCK_LABELS_RU[key] || `Раздел (${key})`;
    const parsedEntry = {
      key,
      label,
      plainText,
      nodes,
    };
    textByKey[key] = parsedEntry;
    if (nodes.length > 0) {
      textBlocks.push(parsedEntry);
    }
  }

  // SubInfo & Physical calculations (Size, Carrying Capacity, High Jump, Long Jump)
  const subInfoMeta: Array<[string, string]> = [
    ['age', 'Возраст'],
    ['height', 'Рост'],
    ['weight', 'Вес'],
    ['eyes', 'Глаза'],
    ['skin', 'Кожа'],
    ['hair', 'Волосы'],
  ];
  const subInfo: Array<{ key: string; label: string; value: string }> = [];
  const subInfoMap: Record<string, string> = {};
  for (const [k, lbl] of subInfoMeta) {
    const val = asStr(subInfoObj[k]);
    subInfoMap[k] = val;
    if (val) subInfo.push({ key: k, label: lbl, value: val });
  }

  const size = asStr(info.size) || asStr(subInfoObj.size) || 'Средний';
  const sizeLower = size.toLowerCase();
  const carryMult = sizeLower.includes('крошеч')
    ? 0.5
    : sizeLower.includes('больш')
      ? 2
      : sizeLower.includes('огром')
        ? 4
        : sizeLower.includes('громад')
          ? 8
          : 1;
  const carryWeight = Math.round(abilities.str.score * 15 * carryMult);
  const pushDragLift = Math.round(abilities.str.score * 30 * carryMult);
  const highJumpFt = Math.max(0, 3 + abilities.str.mod);
  const longJumpFt = Math.max(0, abilities.str.score);

  const physical = {
    size,
    carryCapacity:
      asStr(subInfoObj.carryCustom) || `${carryWeight} / ${pushDragLift} фунт.`,
    highJump: asStr(subInfoObj.highJumpCustom) || `${highJumpFt} фут.`,
    longJump: asStr(subInfoObj.longJumpCustom) || `${longJumpFt} фут.`,
  };

  let avatarUrl: string | null = null;
  if (sheet.avatar && typeof sheet.avatar === 'object') {
    const av = sheet.avatar as Record<string, unknown>;
    avatarUrl = asStr(av.webp) || asStr(av.jpeg) || null;
  }

  const conditions = Array.isArray(sheet.conditions)
    ? sheet.conditions.filter((c): c is string => typeof c === 'string')
    : [];
  const exhaustion = Math.min(6, Math.max(0, asNum(sheet.exhaustion) ?? 0));
  const inspiration = Boolean(sheet.inspiration);

  return {
    edition,
    name,
    rawCharClass,
    classLabel,
    subclass,
    race,
    background,
    alignment,
    size,
    playerName,
    experience,
    level,
    proficiencyBonus,
    avatarUrl,
    inspiration,
    exhaustion,
    conditions,
    physical,
    deathSaves: {
      success: deathSuccess,
      fail: deathFail,
    },
    coins,
    subInfo,
    subInfoMap,
    abilities,
    skills,
    combat: {
      ac,
      acFormula,
      shieldEquipped,
      shieldMod: shieldModStr,
      initiative,
      initiativeRaw,
      speed,
      speedRaw,
      hitDie,
      hitDiceCurrent,
      darkvision,
      passivePerception,
      passiveInsight,
      passiveInvestigation,
      hpCurrent,
      hpTemp,
      hpMaxBase,
      hpMaxBonus,
      hpMaxComputed,
    },
    weapons,
    resources: Object.values(resourcesMap),
    attunements,
    profFlags,
    profFlagKeys,
    spellcasting: {
      baseAbility: baseCode,
      abilityMod: baseCode ? abilities[baseCode].mod : null,
      saveDc,
      attackBonus: spellAttackBonus,
      slotsByLevel,
      pactSlots,
      slots,
      preparedSlugs,
      manualSpells,
      castConfigs,
    },
    textBlocks,
    textByKey,
  };
}

export function computeRecoveredResourceCurrent(res: LssParsedResource): number {
  if (res.recoverMode === 'half_up') {
    return Math.min(res.max, res.current + Math.max(1, Math.ceil(res.max / 2)));
  }
  if (res.recoverMode === 'half_down') {
    return Math.min(res.max, res.current + Math.max(1, Math.floor(res.max / 2)));
  }
  if (res.recoverMode === 'one') {
    return Math.min(res.max, res.current + 1);
  }
  return res.max;
}

function randomDie(sides: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % sides) + 1;
}

export function rollD20WithModifier(
  modifier: number,
  mode: RollMode = 'normal'
): {
  rawD20: number;
  formula: string;
  breakdown: string;
  total: string;
  isCrit: boolean;
  critKind: 'success' | 'failure' | null;
} {
  const r1 = randomDie(20);
  const r2 = mode === 'normal' ? r1 : randomDie(20);
  const chosen =
    mode === 'advantage'
      ? Math.max(r1, r2)
      : mode === 'disadvantage'
        ? Math.min(r1, r2)
        : r1;

  const sum = chosen + modifier;
  const modPart = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`;
  const breakdownMod =
    modifier === 0 ? '' : modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;

  const diceFormulaPrefix =
    mode === 'advantage'
      ? '2к20kh1'
      : mode === 'disadvantage'
        ? '2к20kl1'
        : '1к20';

  const diceBreakdown =
    mode === 'normal' ? `[${chosen}]` : `[${r1}, ${r2} → ${chosen}]`;

  return {
    rawD20: chosen,
    formula: `${diceFormulaPrefix}${modPart}`,
    breakdown: `${diceBreakdown}${breakdownMod} = ${sum}`,
    total: String(sum),
    isCrit: chosen === 20 || chosen === 1,
    critKind: chosen === 20 ? 'success' : chosen === 1 ? 'failure' : null,
  };
}

export function rollDamageExpression(resolvedExpr: string): {
  numericTotal: number;
  formula: string;
  breakdown: string;
  total: string;
} {
  const expr = resolvedExpr.trim() || '1';
  const parts: string[] = [];
  let sum = 0;

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
    numericTotal: sum,
    formula: expr,
    breakdown: `${parts.join('')} = ${sum}`,
    total: String(sum),
  };
}
