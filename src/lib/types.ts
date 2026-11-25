export type UserRole = 'dm' | 'player';
export type PlayerId = 1 | 2 | 3;

export interface ThemeVariables {
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
  glow: string;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  role: UserRole;
  playerId: PlayerId | null;
  avatarKey?: string | null;
  theme: ThemeVariables;
}

export interface CharacterCoins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface CharacterProfile {
  playerId: PlayerId;
  characterName: string;
  charClass: string;
  subclass: string;
  race: string;
  level: number;
  experienceCurrent: number;
  experienceMax: number;
  maxSpells: number;
  lssEmbedUrl: string;
  coins: CharacterCoins;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  lssNotes: string;
  hasRawLssJson: boolean;
  rawLssJson?: string | null;
  lastSyncedAt: string | null;
}

export interface JournalEntry {
  playerId: PlayerId;
  title: string;
  content: string;
  updatedAt: string;
}

export type QuestStatus = 'active' | 'completed' | 'failed' | 'available';

export interface QuestParameters {
  location?: string;
  giver?: string;
  difficulty?: string;
  deadline?: string;
  [key: string]: string | undefined;
}

export interface Quest {
  id: number;
  title: string;
  shortDesc: string;
  fullDesc: string;
  reward: string;
  parameters: QuestParameters;
  progressCurrent: number;
  progressTarget: number;
  imageKey: string | null;
  status: QuestStatus;
  createdAt: string;
}

export interface BestiaryCreature {
  id: number;
  name: string;
  cr: string;
  crNumeric: number;
  creatureType: string;
  ac: number;
  hp: string;
  description: string;
  imageKey: string | null;
  isRevealed: boolean;
  sortOrder: number;
}

export type MagicSchool =
  | 'Воплощение'
  | 'Вызов'
  | 'Иллюзия'
  | 'Некромантия'
  | 'Ограждение'
  | 'Очарование'
  | 'Преобразование'
  | 'Прорицание'
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Illusion'
  | 'Necromancy'
  | 'Transmutation';

export interface SpellSourceBadge {
  code: string;
  title: string;
  href?: string;
}

export interface Spell {
  id: number;
  slug?: string;
  url?: string;
  name: string;
  nameSort?: string;
  nameEn?: string;
  level: number;
  school: MagicSchool | string;
  schoolIcon?: string;
  typeLine?: string;
  ritual?: boolean;
  concentration?: boolean;
  componentsBadge?: string;
  classes: string[];
  classesTce?: string[];
  subclasses?: string;
  castingTime: string;
  spellRange: string;
  components: string;
  duration: string;
  description: string;
  descriptionHtml?: string;
  source: string;
  sourceTitle?: string;
  sourceBadges?: SpellSourceBadge[];
  isHomebrew: boolean;
  createdBy: number | null;
  // Optional dnd.su exact filter vectors
  fClass?: number[];
  fClassTce?: number[];
  fArchetype?: number[];
  fSource?: number[];
  fSchool?: number[];
  fConc?: number[];
  fRitual?: number[];
  fComp?: string;
  fCast?: string[];
  fDam?: number[];
}

export interface DndsuFilterOption {
  title: string;
  value: number | string;
}

export interface DndsuFilterGroup {
  title: string;
  list: DndsuFilterOption[];
}

export type DndsuCategoryFilters = Record<string, DndsuFilterGroup[]>;

export interface DndsuFiltersPayload {
  official: DndsuCategoryFilters;
  homebrew: DndsuCategoryFilters;
}

export interface LearnedSpellRecord {
  playerId: PlayerId;
  spellId: number;
  learnedAt: string;
  spell: Spell;
}

export interface TalentNode {
  id: number;
  title: string;
  description: string;
  imageKey: string | null;
  cost: number;
  positionX: number;
  positionY: number;
  parentId: number | null;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

export interface PurchasedTalent {
  playerId: PlayerId;
  talentId: number;
  purchasedAt: string;
}

export interface RollLogEntry {
  id?: number;
  playerId: PlayerId | null;
  characterName: string;
  title: string;
  formula: string;
  breakdown: string;
  total: string;
  isCrit: boolean;
  critKind?: 'success' | 'failure' | null;
  createdAt: string;
}

export type CampaignWsEventType =
  | 'connected'
  | 'presence:update'
  | 'quests:updated'
  | 'bestiary:updated'
  | 'spells:updated'
  | 'learned_spells:updated'
  | 'talents:updated'
  | 'inspiration:updated'
  | 'journal:updated'
  | 'character:updated'
  | 'lss:roll'
  | 'rolls:cleared'
  | 'lss:health'
  | 'theme:updated';

export interface DmManagedAccountInfo {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  playerId: PlayerId | null;
  plainPassword: string | null;
  updatedAt: string | null;
}

export interface CampaignWsMessage<T = unknown> {
  type: CampaignWsEventType;
  payload: T;
  senderId?: number;
  timestamp: number;
}
