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
  maxSpells: number;
  lssEmbedUrl: string;
  coins: CharacterCoins;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  lssNotes: string;
  hasRawLssJson: boolean;
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
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Illusion'
  | 'Necromancy'
  | 'Transmutation';

export type DndClass =
  | 'Wizard'
  | 'Cleric'
  | 'Sorcerer'
  | 'Warlock'
  | 'Bard'
  | 'Druid'
  | 'Paladin'
  | 'Ranger';

export interface Spell {
  id: number;
  name: string;
  level: number;
  school: MagicSchool | string;
  classes: string[];
  castingTime: string;
  spellRange: string;
  components: string;
  duration: string;
  description: string;
  source: string;
  isHomebrew: boolean;
  createdBy: number | null;
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
  | 'lss:health'
  | 'theme:updated';

export interface CampaignWsMessage<T = unknown> {
  type: CampaignWsEventType;
  payload: T;
  senderId?: number;
  timestamp: number;
}
