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

export type SpellCastMode =
  | 'slot'
  | 'at_will'
  | 'long_rest'
  | 'short_rest'
  | 'resource'
  | 'ritual_only'
  | 'custom';

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
  allowOffClassSpells?: boolean;
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
  castMode?: SpellCastMode;
  castMaxUses?: number;
  castNote?: string;
  grantedByDm?: boolean;
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
  | 'theme:updated'
  | 'chat:message_created'
  | 'chat:message_updated'
  | 'chat:message_deleted'
  | 'chat:poll_updated'
  | 'chat:session_updated'
  | 'chat:typing';

export type ChatAttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface ChatAttachment {
  key: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatAttachmentKind;
}

export interface ChatParticipantBadge {
  userId: number;
  displayName: string;
  role: UserRole;
  playerId: PlayerId | null;
}

export interface ChatReactionSummary {
  emoji: string;
  count: number;
  userIds: number[];
  users: ChatParticipantBadge[];
}

export type ChatPollKind = 'date' | 'general';

export interface ChatPollOption {
  id: number;
  pollId: number;
  label: string;
  dateIso: string | null;
  sortOrder: number;
  voteCount: number;
  userIds: number[];
  voters: ChatParticipantBadge[];
}

export interface ChatPoll {
  id: number;
  creatorId: number;
  creatorName: string;
  kind: ChatPollKind;
  question: string;
  allowMultiple: boolean;
  isAnonymous: boolean;
  allowAddOptions: boolean;
  isClosed: boolean;
  confirmedOptionId: number | null;
  totalVoters: number;
  options: ChatPollOption[];
  createdAt: string;
}

export interface ChatReplyPreview {
  id: number;
  senderDisplayName: string;
  senderRole: UserRole;
  senderPlayerId: PlayerId | null;
  content: string;
  hasAttachments: boolean;
  hasPoll: boolean;
}

export interface ChatMessage {
  id: number;
  userId: number;
  senderUsername: string;
  senderDisplayName: string;
  senderRole: UserRole;
  senderPlayerId: PlayerId | null;
  content: string;
  replyToId: number | null;
  replyPreview: ChatReplyPreview | null;
  attachments: ChatAttachment[];
  pollId: number | null;
  poll: ChatPoll | null;
  reactions: ChatReactionSummary[];
  isPinned: boolean;
  editedAt: string | null;
  createdAt: string;
}

export interface NextSessionBanner {
  campaignId: string;
  label: string;
  dateIso: string | null;
  note: string;
  pollId: number | null;
  updatedBy: number | null;
  updatedAt: string;
}

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
