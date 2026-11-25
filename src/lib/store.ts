import { create } from 'zustand';
import { apiFetch } from './api';
import { applyThemeToDocument, DEFAULT_ANIME_THEME } from './theme';
import type {
  AuthUser,
  BestiaryCreature,
  CharacterProfile,
  JournalEntry,
  LearnedSpellRecord,
  PlayerId,
  PurchasedTalent,
  Quest,
  RollLogEntry,
  Spell,
  TalentNode,
  ThemeVariables,
} from './types';

export type CampaignTabId = 'character' | 'quests' | 'bestiary' | 'spells' | 'talents' | 'dm';

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

  wsConnected: boolean;
  onlineUsers: OnlineMember[];

  charactersById: Partial<Record<PlayerId, CharacterProfile>>;
  journalsById: Partial<Record<PlayerId, JournalEntry>>;
  learnedSpellsById: Partial<Record<PlayerId, LearnedSpellRecord[]>>;

  quests: Quest[];
  bestiary: BestiaryCreature[];
  spells: Spell[];
  inspirationPoints: number;
  talentNodes: TalentNode[];
  talentPurchases: PurchasedTalent[];
  rolls: RollLogEntry[];
  toasts: ToastNotice[];

  setUser: (user: AuthUser | null) => void;
  setAuthReady: (ready: boolean) => void;
  setActiveTab: (tab: CampaignTabId) => void;
  setDmSelectedPlayerId: (playerId: PlayerId) => void;
  jumpToSpellInCatalog: (spellId: number) => void;
  clearHighlightedSpell: () => void;

  setWsConnected: (connected: boolean) => void;
  setOnlineUsers: (online: OnlineMember[]) => void;

  setQuests: (quests: Quest[]) => void;
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
  updateJournalInStore: (playerId: PlayerId, journal: JournalEntry) => void;
  updateLearnedSpellsInStore: (playerId: PlayerId, learned: LearnedSpellRecord[]) => void;

  prependRoll: (roll: RollLogEntry) => void;
  setRolls: (rolls: RollLogEntry[]) => void;
  applyLiveTheme: (theme: ThemeVariables) => void;

  pushToast: (notice: Omit<ToastNotice, 'id'>) => void;
  dismissToast: (id: string) => void;

  bootstrapCampaignData: () => Promise<void>;
  refreshBestiary: () => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  user: null,
  authReady: false,
  activeTab: 'character',
  dmSelectedPlayerId: 1,
  highlightedSpellId: null,

  wsConnected: false,
  onlineUsers: [],

  charactersById: {},
  journalsById: {},
  learnedSpellsById: {},

  quests: [],
  bestiary: [],
  spells: [],
  inspirationPoints: 0,
  talentNodes: [],
  talentPurchases: [],
  rolls: [],
  toasts: [],

  setUser: (user) => {
    applyThemeToDocument(user?.theme ?? DEFAULT_ANIME_THEME);
    set((state) => ({
      user,
      activeTab:
        user?.role !== 'dm' && state.activeTab === 'dm' ? 'character' : state.activeTab,
    }));
  },
  setAuthReady: (authReady) => set({ authReady }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setDmSelectedPlayerId: (dmSelectedPlayerId) => set({ dmSelectedPlayerId }),

  jumpToSpellInCatalog: (spellId) => set({ activeTab: 'spells', highlightedSpellId: spellId }),
  clearHighlightedSpell: () => set({ highlightedSpellId: null }),

  setWsConnected: (wsConnected) => set({ wsConnected }),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  setQuests: (quests) => set({ quests }),
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

  applyLiveTheme: (theme) => {
    applyThemeToDocument(theme);
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

    const targetPlayerId: PlayerId = user.role === 'dm' ? get().dmSelectedPlayerId : (user.playerId ?? 1);

    const [questsRes, bestiaryRes, spellsRes, talentsRes, rollsRes, charRes, allCharsRes] =
      await Promise.all([
        apiFetch<{ quests: Quest[] }>('/api/quests'),
        apiFetch<{ creatures: BestiaryCreature[] }>('/api/bestiary'),
        apiFetch<{ spells: Spell[]; learnedSpellIds: number[] }>('/api/spells'),
        apiFetch<{
          inspirationPoints: number;
          nodes: TalentNode[];
          purchases: PurchasedTalent[];
        }>('/api/talents'),
        apiFetch<{ rolls: RollLogEntry[] }>('/api/rolls'),
        apiFetch<{
          profile: CharacterProfile | null;
          journal: JournalEntry;
          learnedSpells: LearnedSpellRecord[];
        }>(`/api/player/${targetPlayerId}`),
        apiFetch<{ characters: CharacterProfile[] }>('/api/characters'),
      ]);

    const charMap: Partial<Record<PlayerId, CharacterProfile>> = {};
    for (const c of allCharsRes.characters) {
      charMap[c.playerId] = c;
    }
    if (charRes.profile) {
      charMap[targetPlayerId] = charRes.profile;
    }

    set((s) => ({
      quests: questsRes.quests,
      bestiary: bestiaryRes.creatures,
      spells: spellsRes.spells,
      inspirationPoints: talentsRes.inspirationPoints,
      talentNodes: talentsRes.nodes,
      talentPurchases: talentsRes.purchases,
      rolls: rollsRes.rolls,
      charactersById: { ...s.charactersById, ...charMap },
      journalsById: { ...s.journalsById, [targetPlayerId]: charRes.journal },
      learnedSpellsById: { ...s.learnedSpellsById, [targetPlayerId]: charRes.learnedSpells },
    }));
  },

  refreshBestiary: async () => {
    const bestiaryRes = await apiFetch<{ creatures: BestiaryCreature[] }>('/api/bestiary');
    set({ bestiary: bestiaryRes.creatures });
  },
}));
