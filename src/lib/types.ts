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
  /** Resolved portrait URL (uploaded avatar or character-sheet portrait) */
  avatarUrl?: string | null;
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
  /** Resolved portrait URL used for messenger avatars & roster cards */
  avatarUrl?: string | null;
}

export interface JournalEntry {
  playerId: PlayerId;
  title: string;
  content: string;
  updatedAt: string;
}

export type QuestStatus = 'active' | 'completed' | 'failed' | 'available';

export type TilePattern =
  // plain
  | 'none'
  // geometry
  | 'grid'
  | 'dots'
  | 'diagonal'
  | 'crosshatch'
  | 'diamonds'
  | 'hex'
  | 'triangles'
  | 'chevron'
  | 'stripes'
  | 'rings'
  | 'plaid'
  | 'blueprint'
  | 'circuit'
  | 'barcode'
  // magic
  | 'runes'
  | 'stars'
  | 'sparkles'
  | 'arcane'
  | 'nebula'
  | 'sigil'
  | 'pulse'
  // tech / HUD
  | 'scanlines'
  | 'crt'
  | 'datastream'
  | 'target'
  // danger
  | 'hazard'
  | 'flames'
  | 'cracks'
  // nature & materials
  | 'scales'
  | 'vines'
  | 'wood'
  | 'stone'
  | 'waves';

export type QuestTilePattern = TilePattern;

export interface QuestTileStyle {
  /** Hex accent used for the tile rim, glow & progress bar */
  accent: string | null;
  /** HUD emblem key (dice, dragon, skull, crown, …) */
  emblem: string | null;
  pattern: QuestTilePattern;
  isImportant: boolean;
}

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
  tileStyle: QuestTileStyle;
  /** Number of party notes attached to the quest (shown as a tile badge) */
  notesCount: number;
}

/**
 * A quest note written in first person by a member of the table.
 * Notes are always visible to the whole party (players + DM).
 */
export interface QuestNote {
  id: number;
  questId: number;
  authorId: number;
  /** Account display name */
  authorName: string;
  authorRole: UserRole;
  authorPlayerId: PlayerId | null;
  /** Character name the note is written as (players only) */
  authorCharacterName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}

export type NpcAttitude = 'friendly' | 'neutral' | 'wary' | 'hostile' | 'unknown';

/**
 * A campaign contact / NPC shown on the "Связи" tab.
 * The DM creates them hidden and reveals them to the party when the story needs it.
 */
export interface CampaignNpc {
  id: number;
  name: string;
  /** Profession, title or role in the story */
  role: string;
  faction: string;
  location: string;
  attitude: NpcAttitude;
  /** Public description — players see it once the NPC is revealed */
  description: string;
  /** DM-only intel, never sent to players */
  secretNotes: string;
  imageKey: string | null;
  isRevealed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
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

/** Talents reuse the quest tile styling vocabulary (accent / emblem / pattern / featured). */
export type TalentTileStyle = QuestTileStyle;

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
  tileStyle: TalentTileStyle;
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
  | 'quest_notes:updated'
  | 'npcs:updated'
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
  | 'chat:emojis_updated'
  | 'party:avatars_updated'
  | 'chat:typing';

export interface CustomCampaignEmoji {
  id: number;
  code: string;
  token: string;
  name: string;
  imageUrl: string;
  creatorId: number;
  createdAt: string;
}

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
  avatarUrl?: string | null;
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
  senderAvatarUrl?: string | null;
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
  /** Portrait of the author's character — drives the messenger avatar gutter */
  senderAvatarUrl?: string | null;
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
