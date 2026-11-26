import { create } from 'zustand';
import { apiFetch } from './api';
import {
  applyThemeToDocument,
  DEFAULT_ANIME_THEME,
  getUserThemeSlot,
  syncAllAccountThemes,
} from './theme';
import type {
  AuthUser,
  BestiaryCreature,
  CampaignNpc,
  CharacterProfile,
  ChatMessage,
  ChatPoll,
  CustomCampaignEmoji,
  JournalEntry,
  LearnedSpellRecord,
  NextSessionBanner,
  PlayerId,
  PurchasedTalent,
  EntityNote,
  NoteEntityKind,
  Quest,
  RollLogEntry,
  Spell,
  TalentNode,
  ThemeVariables,
} from './types';

export type CampaignTabId =
  | 'character'
  | 'quests'
  | 'bestiary'
  | 'spells'
  | 'connections'
  | 'talents'
  | 'chat'
  | 'board'
  | 'dm';

export interface TypingMember {
  userId: number;
  displayName: string;
  expiresAt: number;
}

export interface OnlineMember {
  userId: number;
  username: string;
  displayName: string;
  role: 'dm' | 'player';
  playerId: number | null;
}

export interface ToastNotice {
  id: string;
  title: string;
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

interface CampaignState {
  user: AuthUser | null;
  authReady: boolean;
  activeTab: CampaignTabId;
  dmSelectedPlayerId: PlayerId;
  highlightedSpellId: number | null;
  dmFocusQuestId: number | null;

  wsConnected: boolean;
  onlineUsers: OnlineMember[];

  charactersById: Partial<Record<PlayerId, CharacterProfile>>;
  journalsById: Partial<Record<PlayerId, JournalEntry>>;
  learnedSpellsById: Partial<Record<PlayerId, LearnedSpellRecord[]>>;

  quests: Quest[];
  /**
   * Party notes per entity, keyed `${kind}:${id}` (loaded on demand and kept in
   * sync over the websocket). One feed serves quests, NPCs and bestiary cards.
   */
  entityNotes: Record<string, EntityNote[]>;
  npcs: CampaignNpc[];
  bestiary: BestiaryCreature[];
  spells: Spell[];
  inspirationPoints: number;
  talentNodes: TalentNode[];
  talentPurchases: PurchasedTalent[];
  rolls: RollLogEntry[];
  chatMessages: ChatMessage[];
  customEmojis: CustomCampaignEmoji[];
  nextSession: NextSessionBanner | null;
  unreadChatCount: number;
  typingUsers: TypingMember[];
  toasts: ToastNotice[];

  setUser: (user: AuthUser | null) => void;
  setAuthReady: (ready: boolean) => void;
  setActiveTab: (tab: CampaignTabId) => void;
  setDmSelectedPlayerId: (playerId: PlayerId) => void;
  jumpToSpellInCatalog: (spellId: number) => void;
  clearHighlightedSpell: () => void;
  focusQuestInDm: (questId: number) => void;
  clearFocusQuest: () => void;

  setWsConnected: (connected: boolean) => void;
  setOnlineUsers: (online: OnlineMember[]) => void;

  setQuests: (quests: Quest[]) => void;
  setEntityNotes: (kind: NoteEntityKind, entityId: number, notes: EntityNote[]) => void;
  setNpcs: (npcs: CampaignNpc[]) => void;
  setBestiary: (creatures: BestiaryCreature[]) => void;
  setSpells: (spells: Spell[]) => void;
  setTalentsBundle: (bundle: {
    inspirationPoints: number;
    nodes: TalentNode[];
    purchases: PurchasedTalent[];
  }) => void;
  setInspirationPoints: (points: number) => void;

  setCharacterBundle: (
    playerId: PlayerId,
    bundle: {
      profile: CharacterProfile | null;
      journal: JournalEntry;
      learnedSpells: LearnedSpellRecord[];
    }
  ) => void;
  updateCharacterProfileInStore: (playerId: PlayerId, profile: CharacterProfile) => void;
  mergeCharacterMetadataInStore: (playerId: PlayerId, profile: CharacterProfile) => void;
  applyPlayerAvatar: (playerId: PlayerId, avatarUrl: string | null, userId?: number | null) => void;
  updateJournalInStore: (playerId: PlayerId, journal: JournalEntry) => void;
  updateLearnedSpellsInStore: (playerId: PlayerId, learned: LearnedSpellRecord[]) => void;

  prependRoll: (roll: RollLogEntry) => void;
  setRolls: (rolls: RollLogEntry[]) => void;

  setChatMessages: (messages: ChatMessage[]) => void;
  setCustomEmojis: (emojis: CustomCampaignEmoji[]) => void;
  upsertChatMessage: (message: ChatMessage, isIncomingFromOther?: boolean) => void;
  removeChatMessage: (messageId: number) => void;
  updateChatPollInStore: (poll: ChatPoll) => void;
  setNextSessionInStore: (nextSession: NextSessionBanner | null) => void;
  registerTypingUser: (userId: number, displayName: string) => void;

  applyLiveTheme: (theme: ThemeVariables) => void;

  pushToast: (notice: Omit<ToastNotice, 'id'>) => void;
  dismissToast: (id: string) => void;

  bootstrapCampaignData: () => Promise<void>;
  refreshBestiary: () => Promise<void>;
  refreshNpcs: () => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  user: null,
  authReady: false,
  activeTab: 'character',
  dmSelectedPlayerId: 1,
  highlightedSpellId: null,
  dmFocusQuestId: null,

  wsConnected: false,
  onlineUsers: [],

  charactersById: {},
  journalsById: {},
  learnedSpellsById: { 1: [], 2: [], 3: [] },

  quests: [],
  entityNotes: {},
  npcs: [],
  bestiary: [],
  spells: [],
  inspirationPoints: 0,
  talentNodes: [],
  talentPurchases: [],
  rolls: [],
  chatMessages: [],
  customEmojis: [],
  nextSession: null,
  unreadChatCount: 0,
  typingUsers: [],
  toasts: [],

  setUser: (user) => {
    applyThemeToDocument(user?.theme ?? DEFAULT_ANIME_THEME, getUserThemeSlot(user));
    if (!user) {
      set({
        user: null,
        activeTab: 'character',
        dmSelectedPlayerId: 1,
        charactersById: {},
        journalsById: {},
        learnedSpellsById: { 1: [], 2: [], 3: [] },
        entityNotes: {},
        npcs: [],
        chatMessages: [],
        customEmojis: [],
        nextSession: null,
        unreadChatCount: 0,
        typingUsers: [],
      });
      return;
    }
    set((state) => ({
      user,
      activeTab:
        user.role !== 'dm' && state.activeTab === 'dm' ? 'character' : state.activeTab,
    }));
  },
  setAuthReady: (authReady) => set({ authReady }),
  setActiveTab: (activeTab) =>
    set((s) => ({
      activeTab,
      unreadChatCount: activeTab === 'chat' ? 0 : s.unreadChatCount,
    })),
  setDmSelectedPlayerId: (dmSelectedPlayerId) => set({ dmSelectedPlayerId }),

  jumpToSpellInCatalog: (spellId) => set({ activeTab: 'spells', highlightedSpellId: spellId }),
  clearHighlightedSpell: () => set({ highlightedSpellId: null }),
  focusQuestInDm: (questId) => set({ activeTab: 'dm', dmFocusQuestId: questId }),
  clearFocusQuest: () => set({ dmFocusQuestId: null }),

  setWsConnected: (wsConnected) => set({ wsConnected }),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  setQuests: (quests) => set({ quests }),

  setEntityNotes: (kind, entityId, notes) =>
    set((s) => {
      const next: Partial<CampaignState> = {
        entityNotes: { ...s.entityNotes, [`${kind}:${entityId}`]: notes },
      };
      if (kind === 'quest') {
        next.quests = s.quests.map((q) =>
          q.id === entityId ? { ...q, notesCount: notes.length } : q
        );
      } else if (kind === 'npc') {
        next.npcs = s.npcs.map((n) =>
          n.id === entityId ? { ...n, notesCount: notes.length } : n
        );
      } else {
        next.bestiary = s.bestiary.map((b) =>
          b.id === entityId ? { ...b, notesCount: notes.length } : b
        );
      }
      return next;
    }),

  setNpcs: (npcs) => set({ npcs }),
  setBestiary: (bestiary) => set({ bestiary }),
  setSpells: (spells) => set({ spells }),
  setTalentsBundle: ({ inspirationPoints, nodes, purchases }) =>
    set({ inspirationPoints, talentNodes: nodes, talentPurchases: purchases }),
  setInspirationPoints: (inspirationPoints) => set({ inspirationPoints }),

  setCharacterBundle: (playerId, { profile, journal, learnedSpells }) =>
    set((s) => ({
      charactersById: profile
        ? { ...s.charactersById, [playerId]: profile }
        : s.charactersById,
      journalsById: { ...s.journalsById, [playerId]: journal },
      learnedSpellsById: { ...s.learnedSpellsById, [playerId]: learnedSpells },
    })),

  updateCharacterProfileInStore: (playerId, profile) =>
    set((s) => ({
      charactersById: { ...s.charactersById, [playerId]: profile },
    })),

  applyPlayerAvatar: (playerId, avatarUrl, userId) =>
    set((s) => {
      const existing = s.charactersById[playerId];
      const nextUser =
        s.user &&
        (s.user.playerId === playerId || (typeof userId === 'number' && s.user.id === userId))
          ? { ...s.user, avatarUrl }
      : s.user;

      return {
        user: nextUser ?? null,
        charactersById: existing
          ? { ...s.charactersById, [playerId]: { ...existing, avatarUrl } }
          : s.charactersById,
        chatMessages: s.chatMessages.map((m) =>
          m.senderPlayerId === playerId ? { ...m, senderAvatarUrl: avatarUrl } : m
        ),
      };
    }),

  mergeCharacterMetadataInStore: (playerId, incoming) =>
    set((s) => {
      const existing = s.charactersById[playerId];
      if (!existing) {
        return { charactersById: { ...s.charactersById, [playerId]: incoming } };
      }
      return {
        charactersById: {
          ...s.charactersById,
          [playerId]: {
            ...existing,
            experienceCurrent: incoming.experienceCurrent,
            experienceMax: incoming.experienceMax,
            level: incoming.level,
            maxSpells: incoming.maxSpells,
            allowOffClassSpells: incoming.allowOffClassSpells,
            lastSyncedAt: incoming.lastSyncedAt,
          },
        },
      };
    }),

  updateJournalInStore: (playerId, journal) =>
    set((s) => ({
      journalsById: { ...s.journalsById, [playerId]: journal },
    })),

  updateLearnedSpellsInStore: (playerId, learned) =>
    set((s) => ({
      learnedSpellsById: { ...s.learnedSpellsById, [playerId]: learned },
    })),

  prependRoll: (roll) =>
    set((s) => ({
      rolls: [roll, ...s.rolls].slice(0, 25),
    })),

  setRolls: (rolls) => set({ rolls }),

  setChatMessages: (chatMessages) => set({ chatMessages }),
  setCustomEmojis: (customEmojis) => set({ customEmojis }),

  upsertChatMessage: (message, isIncomingFromOther = false) =>
    set((s) => {
      const idx = s.chatMessages.findIndex((m) => m.id === message.id);
      const isBrandNew = idx === -1;
      const nextMessages = isBrandNew
        ? [...s.chatMessages, message].sort((a, b) => a.id - b.id)
        : s.chatMessages.map((m) => (m.id === message.id ? message : m));

      // Also refresh replyPreview references if an edited message is quoted
      const syncedReplies = isBrandNew
        ? nextMessages
        : nextMessages.map((m) =>
            m.replyToId === message.id && m.replyPreview
              ? {
                  ...m,
                  replyPreview: {
                    ...m.replyPreview,
                    content: message.content,
                    hasAttachments: message.attachments.length > 0,
                    hasPoll: message.pollId !== null,
                  },
                }
              : m
          );

      const shouldIncrementUnread =
        isBrandNew && isIncomingFromOther && s.activeTab !== 'chat';

      return {
        chatMessages: syncedReplies,
        unreadChatCount: shouldIncrementUnread
          ? s.unreadChatCount + 1
          : s.unreadChatCount,
        typingUsers: isBrandNew
          ? s.typingUsers.filter((t) => t.userId !== message.userId)
          : s.typingUsers,
      };
    }),

  removeChatMessage: (messageId) =>
    set((s) => ({
      chatMessages: s.chatMessages
        .filter((m) => m.id !== messageId)
        .map((m) => (m.replyToId === messageId ? { ...m, replyPreview: null } : m)),
    })),

  updateChatPollInStore: (poll) =>
    set((s) => ({
      chatMessages: s.chatMessages.map((m) =>
        m.pollId === poll.id || m.poll?.id === poll.id ? { ...m, poll } : m
      ),
    })),

  setNextSessionInStore: (nextSession) => set({ nextSession }),

  registerTypingUser: (userId, displayName) => {
    const expiresAt = Date.now() + 4000;
    set((s) => {
      if (s.user?.id === userId) return s;
      const rest = s.typingUsers.filter((t) => t.userId !== userId && t.expiresAt > Date.now());
      return { typingUsers: [...rest, { userId, displayName, expiresAt }] };
    });
    window.setTimeout(() => {
      set((s) => ({
        typingUsers: s.typingUsers.filter((t) => t.expiresAt > Date.now()),
      }));
    }, 4200);
  },

  applyLiveTheme: (theme) => {
    const current = get().user;
    applyThemeToDocument(theme, getUserThemeSlot(current));
    set((s) => ({
      user: s.user ? { ...s.user, theme } : null,
    }));
  },

  pushToast: (notice) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...notice, id }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 4500);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  bootstrapCampaignData: async () => {
    const user = get().user;
    if (!user) return;

    const playerIdsToLoad: PlayerId[] =
      user.role === 'dm' ? [1, 2, 3] : [user.playerId ?? 1];

    if (user.role === 'dm') {
      void apiFetch<{ users: AuthUser[] }>('/api/dm/users')
        .then((r) => syncAllAccountThemes(r.users))
        .catch(() => {
          // Non-blocking fallback to default slot themes
        });
    }

    const [
      questsRes,
      bestiaryRes,
      spellsRes,
      talentsRes,
      rollsRes,
      allCharsRes,
      chatRes,
      npcsRes,
      ...playerBundles
    ] = await Promise.all([
      apiFetch<{ quests: Quest[] }>('/api/quests'),
      apiFetch<{ creatures: BestiaryCreature[] }>('/api/bestiary'),
      apiFetch<{ spells: Spell[]; learnedSpellIds: number[] }>('/api/spells'),
      apiFetch<{
        inspirationPoints: number;
        nodes: TalentNode[];
        purchases: PurchasedTalent[];
      }>('/api/talents'),
      apiFetch<{ rolls: RollLogEntry[] }>('/api/rolls'),
      apiFetch<{ characters: CharacterProfile[] }>('/api/characters'),
      apiFetch<{
        messages: ChatMessage[];
        nextSession: NextSessionBanner | null;
        partyUsers?: AuthUser[];
        customEmojis?: CustomCampaignEmoji[];
      }>('/api/chat').catch(() => ({
        messages: [] as ChatMessage[],
        nextSession: null as NextSessionBanner | null,
        partyUsers: [] as AuthUser[],
        customEmojis: [] as CustomCampaignEmoji[],
      })),
      apiFetch<{ npcs: CampaignNpc[] }>('/api/npcs').catch(() => ({
        npcs: [] as CampaignNpc[],
      })),
      ...playerIdsToLoad.map((pid) =>
        apiFetch<{
          profile: CharacterProfile | null;
          journal: JournalEntry;
          learnedSpells: LearnedSpellRecord[];
        }>(`/api/player/${pid}`)
      ),
    ]);

    if (Array.isArray(chatRes.partyUsers) && chatRes.partyUsers.length > 0) {
      syncAllAccountThemes(chatRes.partyUsers);
    }

    const charMap: Partial<Record<PlayerId, CharacterProfile>> = {};
    for (const c of allCharsRes.characters) {
      charMap[c.playerId] = c;
    }

    const journalMap: Partial<Record<PlayerId, JournalEntry>> = {};
    const learnedMap: Partial<Record<PlayerId, LearnedSpellRecord[]>> = {};

    playerIdsToLoad.forEach((pid, idx) => {
      const bundle = playerBundles[idx];
      if (!bundle) return;
      if (bundle.profile) {
        charMap[pid] = bundle.profile;
      }
      journalMap[pid] = bundle.journal;
      learnedMap[pid] = bundle.learnedSpells;
    });

    set((s) => ({
      quests: questsRes.quests,
      npcs: npcsRes.npcs,
      bestiary: bestiaryRes.creatures,
      spells: spellsRes.spells,
      inspirationPoints: talentsRes.inspirationPoints,
      talentNodes: talentsRes.nodes,
      talentPurchases: talentsRes.purchases,
      rolls: rollsRes.rolls,
      chatMessages: chatRes.messages,
      customEmojis: chatRes.customEmojis ?? [],
      nextSession: chatRes.nextSession,
      charactersById: { ...s.charactersById, ...charMap },
      journalsById: { ...s.journalsById, ...journalMap },
      learnedSpellsById: { ...s.learnedSpellsById, ...learnedMap },
    }));
  },

  refreshBestiary: async () => {
    const bestiaryRes = await apiFetch<{ creatures: BestiaryCreature[] }>('/api/bestiary');
    set({ bestiary: bestiaryRes.creatures });
  },

  refreshNpcs: async () => {
    const npcsRes = await apiFetch<{ npcs: CampaignNpc[] }>('/api/npcs');
    set({ npcs: npcsRes.npcs });
  },
}));
