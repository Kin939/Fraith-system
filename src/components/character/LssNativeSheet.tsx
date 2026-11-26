import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpCircle,
  BookOpen,
  Check,
  Coins,
  Crown,
  Dices,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Moon,
  Pencil,
  Plus,
  ScrollText,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { apiFetch, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { glyphToHudAssetKey } from '../../lib/hudIcons';
import { HudIcon } from '../common/HudIcon';
import {
  DND_CLASS_LABELS_RU,
  DND_HOMEBREW_CLASS_BY_KEY,
  DND_HOMEBREW_CLASSES_META,
  DND_OFFICIAL_CLASS_LABELS_RU,
  MAGIC_SCHOOL_LABELS_RU,
  normalizeDndClass,
} from '../../lib/lss';
import {
  ABILITY_META,
  AbilityCode,
  computeRecoveredResourceCurrent,
  createBlankLssStructures,
  DND_CONDITIONS_RU,
  ensureObj,
  formatSigned,
  getXpProgressInfo,
  LssManualSpellRow,
  LssMutableBundle,
  LssParsedResource,
  LssParsedSheet,
  LssParsedWeapon,
  LssRichParagraph,
  packLssStructures,
  parseLssSheetFromObjects,
  plainTextToLssDoc,
  RollMode,
  rollD20WithModifier,
  rollDamageExpression,
  setLssField,
  unwrapLssJsonMutable,
} from '../../lib/lssSheetParser';
import {
  LSS_RESOURCE_PRESETS,
  LssResourcePreset,
  RESOURCE_COLOR_STYLES,
  ResourceColorKey,
  ResourceRecoverMode,
} from '../../lib/lssResources';
import { formatSpellCastBadge, SPELL_CAST_MODE_OPTIONS } from '../../lib/spellCasting';
import { useCampaignStore } from '../../lib/store';
import {
  beginSheetNetworkSync,
  endSheetNetworkSync,
  markSheetLocalEdit,
} from '../../lib/syncTracker';
import type {
  CharacterProfile,
  JournalEntry,
  LearnedSpellRecord,
  SpellCastMode,
} from '../../lib/types';
import { FormattedText } from '../common/FormattedText';
import { JournalEditor } from './JournalEditor';

interface LssNativeSheetProps {
  profile: CharacterProfile;
  journal: JournalEntry | null;
  learnedSpells: LearnedSpellRecord[];
  canEdit: boolean;
  isDm: boolean;
  onQuickUploadFile: (file: File) => Promise<void>;
  onOpenImportModal: () => void;
  onSyncJson: (lssJson: unknown) => Promise<void>;
  onProfileUpdated?: (profile: CharacterProfile) => void;
}

type ClassicPageId = 'page1' | 'page2' | 'page3';

const HIT_DICE_OPTIONS = ['d6', 'd8', 'd10', 'd12'] as const;
const SIZE_OPTIONS = [
  'Крошечный',
  'Маленький',
  'Средний',
  'Большой',
  'Огромный',
  'Громадный',
] as const;

const STANDARD_HANDLED_TEXT_KEYS = new Set([
  'traits',
  'features',
  'attacks',
  'feats',
  'prof',
  'allies',
  'quests',
  'notes-1',
  'items',
  'appearance',
  'personality',
  'ideals',
  'bonds',
  'flaws',
  'background',
  'equipment',
]);

export const LssNativeSheet: React.FC<LssNativeSheetProps> = ({
  profile,
  journal,
  learnedSpells,
  canEdit,
  isDm,
  onQuickUploadFile,
  onOpenImportModal,
  onSyncJson,
  onProfileUpdated,
}) => {
  const pushToast = useCampaignStore((s) => s.pushToast);
  const jumpToSpellInCatalog = useCampaignStore((s) => s.jumpToSpellInCatalog);
  const updateLearnedSpellsInStore = useCampaignStore((s) => s.updateLearnedSpellsInStore);
  const updateCharacterProfileInStore = useCampaignStore((s) => s.updateCharacterProfileInStore);
  const mergeCharacterMetadataInStore = useCampaignStore((s) => s.mergeCharacterMetadataInStore);

  // Zero-lag in-memory bundle + monotonic mutation sequence + single-flight coalesced sync queue
  const initialParsed = useMemo(() => {
    if (!profile.rawLssJson) return { bundle: null, parsed: null };
    const bundle = unwrapLssJsonMutable(profile.rawLssJson);
    const parsed = parseLssSheetFromObjects(bundle.sheet, bundle.root);
    return { bundle, parsed };
    // Only evaluated on initial mount; external updates go through the guarded effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bundleRef = useRef<LssMutableBundle | null>(initialParsed.bundle);
  const liveSheetRef = useRef<LssParsedSheet | null>(initialParsed.parsed);
  const [sheet, setSheet] = useState<LssParsedSheet | null>(initialParsed.parsed);
  const [dirtySaving, setDirtySaving] = useState(false);

  const activePlayerIdRef = useRef(profile.playerId);
  const lastAdoptedRawJsonRef = useRef<string | null>(profile.rawLssJson ?? null);
  const mutationSeqRef = useRef(0);
  const syncedSeqRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);

  const adoptExternalRawJson = (nextRawJson: string | null) => {
    lastAdoptedRawJsonRef.current = nextRawJson;
    if (!nextRawJson) {
      bundleRef.current = null;
      liveSheetRef.current = null;
      setSheet(null);
      return;
    }
    const nextBundle = unwrapLssJsonMutable(nextRawJson);
    const nextParsed = parseLssSheetFromObjects(nextBundle.sheet, nextBundle.root);
    bundleRef.current = nextBundle;
    liveSheetRef.current = nextParsed;
    setSheet(nextParsed);
  };

  const flushSyncQueueRef = useRef<((keepaliveOnly?: boolean) => void) | null>(null);

  flushSyncQueueRef.current = (keepaliveOnly = false) => {
    const pid = activePlayerIdRef.current;
    const bundle = bundleRef.current;
    if (!bundle || mutationSeqRef.current <= syncedSeqRef.current) {
      setDirtySaving(false);
      return;
    }

    if (keepaliveOnly) {
      try {
        const packed = packLssStructures(bundle);
        void fetch(`/api/player/${pid}/sync-lss`, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lssJson: packed }),
        });
      } catch {
        // Best-effort unload flush
      }
      return;
    }

    if (syncInFlightRef.current) {
      // Single-flight: the currently running request will immediately re-flush in its `finally` block!
      return;
    }

    syncInFlightRef.current = true;
    const targetSeq = mutationSeqRef.current;
    const packed = packLssStructures(bundle);
    const serialized = JSON.stringify(packed);
    lastAdoptedRawJsonRef.current = serialized;
    beginSheetNetworkSync(pid, serialized);

    void apiFetch<{ profile: CharacterProfile }>(`/api/player/${pid}/sync-lss`, {
      method: 'POST',
      body: JSON.stringify({ lssJson: packed }),
    })
      .then((res) => {
        if (targetSeq > syncedSeqRef.current) {
          syncedSeqRef.current = targetSeq;
        }
        const caughtUp = mutationSeqRef.current === targetSeq;
        if (caughtUp) {
          // Record the exact server rawLssJson BEFORE updating store so our prop effect skips re-parsing!
          lastAdoptedRawJsonRef.current = res.profile.rawLssJson ?? serialized;
          updateCharacterProfileInStore(pid, res.profile);
        } else {
          // User clicked/typed again while this save was in flight: keep live bundle untouched!
          mergeCharacterMetadataInStore(pid, res.profile);
        }
      })
      .catch(() => {
        // Keep unsynced sequence so next interaction or manual refresh retries cleanly
      })
      .finally(() => {
        syncInFlightRef.current = false;
        const allCaughtUp = mutationSeqRef.current <= syncedSeqRef.current;
        endSheetNetworkSync(pid, allCaughtUp);
        if (!allCaughtUp) {
          // Coalesce any additional spam clicks that arrived during flight into ONE single follow-up request
          if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = window.setTimeout(() => {
            debounceTimerRef.current = null;
            flushSyncQueueRef.current?.(false);
          }, 120);
        } else {
          setDirtySaving(false);
        }
      });
  };

  // Adopt external profile changes ONLY when switching players or when idle (never revert active edits!)
  useEffect(() => {
    const incomingRaw = profile.rawLssJson ?? null;

    if (profile.playerId !== activePlayerIdRef.current) {
      // Flush previous player's pending changes before switching slots
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      flushSyncQueueRef.current?.(false);

      activePlayerIdRef.current = profile.playerId;
      mutationSeqRef.current = 0;
      syncedSeqRef.current = 0;
      syncInFlightRef.current = false;
      setDirtySaving(false);
      adoptExternalRawJson(incomingRaw);
      return;
    }

    // Same player slot: skip if identical to our own latest save OR if local edits are pending/in-flight!
    if (incomingRaw === lastAdoptedRawJsonRef.current) return;
    if (mutationSeqRef.current > syncedSeqRef.current || syncInFlightRef.current) return;

    adoptExternalRawJson(incomingRaw);
  }, [profile.playerId, profile.rawLssJson]);

  // Flush pending mutations on unmount (tab switch) or browser close (`pagehide`)
  useEffect(() => {
    const onPageHide = () => {
      flushSyncQueueRef.current?.(true);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      flushSyncQueueRef.current?.(false);
    };
  }, []);

  const commitMutation = (
    mutator: (sheetObj: Record<string, unknown>, rootObj: Record<string, unknown>) => void,
    quickFlush = false
  ) => {
    if (!canEdit) return;
    let bundle = bundleRef.current;
    if (!bundle) {
      bundle = unwrapLssJsonMutable(null);
      bundleRef.current = bundle;
    }

    // 1. Mutate live in-memory object directly (<0.05ms, zero JSON.stringify/parse!)
    mutator(bundle.sheet, bundle.root);

    // 2. Recompute derived view state synchronously so even 200Hz rapid clicks never miss a delta
    const nextParsed = parseLssSheetFromObjects(bundle.sheet, bundle.root);
    liveSheetRef.current = nextParsed;
    setSheet(nextParsed);

    // 3. Mark dirty & schedule coalesced single-flight save (240ms for clicks, 420ms for typing)
    mutationSeqRef.current += 1;
    markSheetLocalEdit(profile.playerId);
    setDirtySaving(true);

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    const delayMs = quickFlush ? 240 : 420;
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      flushSyncQueueRef.current?.(false);
    }, delayMs);
  };

  // Classic 3-page navigation & controls
  const [page, setPage] = useState<ClassicPageId>('page1');
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [diceDrawerOpen, setDiceDrawerOpen] = useState(false);
  const [customFormula, setCustomFormula] = useState('');
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [hpDeltaInput, setHpDeltaInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // DM-only XP Bar state
  const [xpInput, setXpInput] = useState('');
  const [xpMaxInput, setXpMaxInput] = useState('');
  const [xpSettingsOpen, setXpSettingsOpen] = useState(false);
  const [xpSaving, setXpSaving] = useState(false);

  // Weapon modal/inline form
  const [weaponFormOpen, setWeaponFormOpen] = useState(false);
  const [editingWeaponId, setEditingWeaponId] = useState<string | null>(null);
  const [wName, setWName] = useState('');
  const [wAbility, setWAbility] = useState<AbilityCode | 'none'>('str');
  const [wIsProf, setWIsProf] = useState(true);
  const [wExtraMod, setWExtraMod] = useState('0');
  const [wDmg, setWDmg] = useState('1к8+[STR]');
  const [wDmgType, setWDmgType] = useState('рубящий');
  const [wNotes, setWNotes] = useState('');

  // LSS Unique Resource modal / preset picker state
  const [resFormOpen, setResFormOpen] = useState(false);
  const [resPresetsOpen, setResPresetsOpen] = useState(false);
  const [editingResId, setEditingResId] = useState<string | null>(null);
  const [rName, setRName] = useState('');
  const [rMax, setRMax] = useState(2);
  const [rMaxExpr, setRMaxExpr] = useState('');
  const [rDie, setRDie] = useState('');
  const [rSpendLimit, setRSpendLimit] = useState(0);
  const [rRest, setRRest] = useState<'none' | 'short' | 'long'>('short');
  const [rRecoverMode, setRRecoverMode] = useState<ResourceRecoverMode>('all');
  const [rColor, setRColor] = useState<ResourceColorKey>('amber');
  const [rGlyph, setRGlyph] = useState('bolt');
  const [rNotes, setRNotes] = useState('');

  // Spell slots, manual spell row form & non-slot cast config modal
  const [configureSlotsOpen, setConfigureSlotsOpen] = useState(false);
  const [manualSpellFormOpen, setManualSpellFormOpen] = useState(false);
  const [msLevel, setMsLevel] = useState(0);
  const [msName, setMsName] = useState('');
  const [msTime, setMsTime] = useState('1 д.');
  const [msRange, setMsRange] = useState('60 фт.');
  const [msConc, setMsConc] = useState(false);
  const [msRitual, setMsRitual] = useState(false);
  const [msMat, setMsMat] = useState(false);
  const [msNotes, setMsNotes] = useState('');
  const [msCastMode, setMsCastMode] = useState<SpellCastMode>('slot');
  const [msCastMaxUses, setMsCastMaxUses] = useState(1);
  const [msCastResourceId, setMsCastResourceId] = useState('');
  const [msCastNote, setMsCastNote] = useState('');

  const [editingSpellCast, setEditingSpellCast] = useState<{
    configKey: string;
    catalogSpellId: number | null;
    manualSpellId: string | null;
    spellName: string;
    spellLevel: number;
    mode: SpellCastMode;
    maxUses: number;
    used: number;
    resourceId: string;
    note: string;
  } | null>(null);

  const [richPreviewMode, setRichPreviewMode] = useState(false);

  // Coins manager & attunement
  const [coinManageOpen, setCoinManageOpen] = useState(false);
  const [coinDelta, setCoinDelta] = useState('');
  const [coinType, setCoinType] = useState<'gp' | 'sp' | 'cp' | 'ep' | 'pp'>('gp');
  const [newAttunement, setNewAttunement] = useState('');

  // Portrait uploader
  const [portraitEditOpen, setPortraitEditOpen] = useState(false);
  const [portraitUrlDraft, setPortraitUrlDraft] = useState('');
  const [uploadingPortrait, setUploadingPortrait] = useState(false);

  // Generic rich-text block modal editor
  const [editingBlock, setEditingBlock] = useState<{
    key: string;
    title: string;
    text: string;
  } | null>(null);

  const sendRollToTable = async (params: {
    title: string;
    formula: string;
    breakdown: string;
    total: string;
    isCrit: boolean;
    critKind: 'success' | 'failure' | null;
  }) => {
    const heroName = sheet?.name || profile.characterName || `Игрок ${profile.playerId}`;
    pushToast({
      title: `${heroName}: ${params.title} — ${params.total}${
        params.critKind === 'success'
          ? ' (крит. успех)'
          : params.critKind === 'failure'
            ? ' (крит. провал)'
            : ''
      }`,
      message: `${params.formula} → ${params.breakdown}`,
      variant:
        params.critKind === 'success'
          ? 'success'
          : params.critKind === 'failure'
            ? 'warning'
            : 'info',
    });

    try {
      await apiFetch('/api/rolls', {
        method: 'POST',
        body: JSON.stringify({
          characterName: heroName,
          title: params.title,
          formula: params.formula,
          breakdown: params.breakdown,
          total: params.total,
          isCrit: params.isCrit,
          critKind: params.critKind,
        }),
      });
    } catch {
      // Toast already shown
    }
  };

  const handleD20Roll = (title: string, modifier: number) => {
    const res = rollD20WithModifier(modifier, rollMode);
    const modeSuffix =
      rollMode === 'advantage'
        ? ' (Преим.)'
        : rollMode === 'disadvantage'
          ? ' (Помеха)'
          : '';
    void sendRollToTable({
      title: `${title}${modeSuffix}`,
      formula: res.formula,
      breakdown: res.breakdown,
      total: res.total,
      isCrit: res.isCrit,
      critKind: res.critKind,
    });
  };

  const handleDamageRoll = (title: string, damageExpr: string) => {
    const res = rollDamageExpression(damageExpr);
    void sendRollToTable({
      title,
      formula: res.formula,
      breakdown: res.breakdown,
      total: res.total,
      isCrit: false,
      critKind: null,
    });
  };

  const handleCreateBlankSheet = async () => {
    if (!canEdit) return;
    const blankBundle = createBlankLssStructures('Новый герой');
    const blankPacked = packLssStructures(blankBundle);
    const serialized = JSON.stringify(blankPacked);
    lastAdoptedRawJsonRef.current = serialized;
    bundleRef.current = blankBundle;
    const nextParsed = parseLssSheetFromObjects(blankBundle.sheet, blankBundle.root);
    liveSheetRef.current = nextParsed;
    setSheet(nextParsed);
    setEditUnlocked(true);
    setHeroModalOpen(true);
    await onSyncJson(blankPacked);
    pushToast({
      title: 'Создан классический лист персонажа',
      message: 'Заполните имя, класс, характеристики и снаряжение прямо в листе.',
      variant: 'success',
    });
  };

  // Optimistic coalesced DM-only Experience Point handler (spamming +50/+100 is instant & never reverts!)
  const [optimisticXp, setOptimisticXp] = useState<number | null>(null);
  const pendingXpDeltaRef = useRef(0);
  const xpFlushTimerRef = useRef<number | null>(null);
  const xpInFlightRef = useRef(false);

  useEffect(() => {
    setOptimisticXp(null);
    pendingXpDeltaRef.current = 0;
  }, [profile.playerId]);

  const flushPendingXpDelta = useRef<(() => void) | null>(null);
  flushPendingXpDelta.current = () => {
    if (xpInFlightRef.current || pendingXpDeltaRef.current === 0) return;
    const deltaToSend = pendingXpDeltaRef.current;
    pendingXpDeltaRef.current = 0;
    xpInFlightRef.current = true;
    const pid = profile.playerId;

    void apiFetch<{ profile: CharacterProfile }>(`/api/dm/characters/${pid}/xp`, {
      method: 'POST',
      body: JSON.stringify({ delta: deltaToSend }),
    })
      .then((res) => {
        if (pendingXpDeltaRef.current === 0) {
          setOptimisticXp(null);
          mergeCharacterMetadataInStore(pid, res.profile);
          if (bundleRef.current) {
            const infoObj = ensureObj(bundleRef.current.sheet, 'info');
            setLssField(infoObj, 'experience', res.profile.experienceCurrent);
          }
        }
      })
      .catch((err) => {
        setOptimisticXp(null);
        pushToast({
          title: 'Ошибка изменения опыта',
          message: err instanceof Error ? err.message : 'Доступно только Мастеру',
          variant: 'error',
        });
      })
      .finally(() => {
        xpInFlightRef.current = false;
        if (pendingXpDeltaRef.current !== 0) {
          flushPendingXpDelta.current?.();
        }
      });
  };

  const handleDmUpdateXp = async (payload: {
    delta?: number;
    setXp?: number;
    setMaxXp?: number | null;
    levelUp?: boolean;
  }) => {
    if (!isDm) return;

    // Fast optimistic path for rapid +XP / -XP button clicks!
    if (
      typeof payload.delta === 'number' &&
      payload.setXp === undefined &&
      payload.setMaxXp === undefined &&
      !payload.levelUp
    ) {
      const baseCur = optimisticXp ?? profile.experienceCurrent ?? liveSheetRef.current?.experience ?? 0;
      const nextCur = Math.max(0, Math.trunc(baseCur + payload.delta));
      setOptimisticXp(nextCur);
      pendingXpDeltaRef.current += payload.delta;
      if (xpFlushTimerRef.current) window.clearTimeout(xpFlushTimerRef.current);
      xpFlushTimerRef.current = window.setTimeout(() => {
        xpFlushTimerRef.current = null;
        flushPendingXpDelta.current?.();
      }, 240);
      return;
    }

    setXpSaving(true);
    try {
      const res = await apiFetch<{ profile: CharacterProfile }>(
        `/api/dm/characters/${profile.playerId}/xp`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setOptimisticXp(null);
      mergeCharacterMetadataInStore(profile.playerId, res.profile);
      if (bundleRef.current) {
        const infoObj = ensureObj(bundleRef.current.sheet, 'info');
        setLssField(infoObj, 'experience', res.profile.experienceCurrent);
        if (payload.levelUp) {
          setLssField(infoObj, 'level', res.profile.level);
          const nextParsed = parseLssSheetFromObjects(
            bundleRef.current.sheet,
            bundleRef.current.root
          );
          liveSheetRef.current = nextParsed;
          setSheet(nextParsed);
        }
      }
      onProfileUpdated?.(res.profile);
      if (payload.levelUp) {
        pushToast({
          title: `[LEVEL UP] Уровень повышен до ${res.profile.level}!`,
          message: `Герой игрока #${profile.playerId} достиг ${res.profile.level} уровня.`,
          variant: 'success',
        });
      }
    } catch (err) {
      pushToast({
        title: 'Ошибка изменения опыта',
        message: err instanceof Error ? err.message : 'Доступно только Мастеру',
        variant: 'error',
      });
    } finally {
      setXpSaving(false);
    }
  };

  const adjustHp = (delta: number) => {
    const curSheet = liveSheetRef.current;
    if (!canEdit || !curSheet) return;
    const maxHp = curSheet.combat.hpMaxComputed;
    let nextTemp = curSheet.combat.hpTemp;
    let nextCur = curSheet.combat.hpCurrent;

    if (delta < 0) {
      let dmg = Math.abs(delta);
      if (nextTemp > 0) {
        const absorbed = Math.min(nextTemp, dmg);
        nextTemp -= absorbed;
        dmg -= absorbed;
      }
      nextCur = Math.max(0, nextCur - dmg);
    } else {
      nextCur = Math.min(maxHp, nextCur + delta);
    }

    commitMutation((s) => {
      const vit = ensureObj(s, 'vitality');
      setLssField(vit, 'hp-current', nextCur);
      setLssField(vit, 'hp-temp', nextTemp);
      if (nextCur > 0) {
        vit.deathSaves = { success: 0, fail: 0 };
      }
    }, true);
  };

  const handleSpendHitDie = () => {
    const curSheet = liveSheetRef.current;
    if (!canEdit || !curSheet || curSheet.combat.hitDiceCurrent <= 0) return;
    const dieFormula = curSheet.combat.hitDie.replace(/^(\d*)/, '1');
    const conMod = curSheet.abilities.con.mod;
    const expr =
      conMod === 0 ? dieFormula : conMod > 0 ? `${dieFormula}+${conMod}` : `${dieFormula}${conMod}`;
    const rolled = rollDamageExpression(expr);
    const healed = Math.max(1, rolled.numericTotal);
    const nextHp = Math.min(curSheet.combat.hpMaxComputed, curSheet.combat.hpCurrent + healed);
    const nextDice = Math.max(0, curSheet.combat.hitDiceCurrent - 1);

    commitMutation((s) => {
      const vit = ensureObj(s, 'vitality');
      setLssField(vit, 'hp-current', nextHp);
      setLssField(vit, 'hp-dice-current', nextDice);
    }, true);

    void sendRollToTable({
      title: `Кость хитов (+${healed} ХП)`,
      formula: rolled.formula,
      breakdown: rolled.breakdown,
      total: String(healed),
      isCrit: false,
      critKind: null,
    });
  };

  const handleShortRest = () => {
    if (!canEdit || !sheet) return;
    commitMutation((s) => {
      const resObj = ensureObj(s, 'resources');
      for (const [k, val] of Object.entries(resObj)) {
        if (val && typeof val === 'object') {
          const rr = val as Record<string, unknown>;
          if (rr.isShortRest) {
            const parsedRes = sheet.resources.find(
              (r) => r.id === (rr.id ?? k) || r.name === rr.name
            );
            if (parsedRes) {
              rr.current = computeRecoveredResourceCurrent(parsedRes);
            }
          }
        }
      }
      const pact = ensureObj(s, 'spellsPact');
      for (let lvl = 1; lvl <= 9; lvl++) {
        const entry = pact[`slots-${lvl}`];
        if (entry && typeof entry === 'object') {
          (entry as Record<string, unknown>).filled = 0;
        }
      }
      // Reset short_rest non-slot spells!
      const castCfgObj = ensureObj(s, 'spellCastConfigs');
      for (const [cfgKey, rawCfg] of Object.entries(castCfgObj)) {
        if (rawCfg && typeof rawCfg === 'object') {
          const cr = rawCfg as Record<string, unknown>;
          const matchingLearned = learnedSpells.find((lr) => `cat-${lr.spell.id}` === cfgKey);
          const effectiveMode =
            (typeof cr.mode === 'string' && cr.mode) || matchingLearned?.castMode || 'slot';
          if (effectiveMode === 'short_rest') {
            cr.used = 0;
          }
        }
      }
    }, true);

    pushToast({
      title: 'Короткий отдых завершён',
      message:
        'Восстановлены ресурсы короткого отдыха, заклинания «1/кор. отдых» и ячейки Магии Пакта.',
      variant: 'info',
    });
  };

  const handleLongRest = () => {
    if (!canEdit || !sheet) return;
    commitMutation((s) => {
      const vit = ensureObj(s, 'vitality');
      setLssField(vit, 'hp-current', sheet.combat.hpMaxComputed);
      setLssField(vit, 'hp-temp', 0);
      const regainedDice = Math.max(1, Math.floor(sheet.level / 2));
      setLssField(
        vit,
        'hp-dice-current',
        Math.min(sheet.level, sheet.combat.hitDiceCurrent + regainedDice)
      );
      vit.deathSaves = { success: 0, fail: 0 };

      const sp = ensureObj(s, 'spells');
      for (let lvl = 1; lvl <= 9; lvl++) {
        const entry = sp[`slots-${lvl}`];
        if (entry && typeof entry === 'object') {
          (entry as Record<string, unknown>).filled = 0;
        }
      }
      const pact = ensureObj(s, 'spellsPact');
      for (let lvl = 1; lvl <= 9; lvl++) {
        const entry = pact[`slots-${lvl}`];
        if (entry && typeof entry === 'object') {
          (entry as Record<string, unknown>).filled = 0;
        }
      }

      const resObj = ensureObj(s, 'resources');
      for (const [k, val] of Object.entries(resObj)) {
        if (val && typeof val === 'object') {
          const rr = val as Record<string, unknown>;
          if (rr.isShortRest || rr.isLongRest) {
            const parsedRes = sheet.resources.find(
              (r) => r.id === (rr.id ?? k) || r.name === rr.name
            );
            if (parsedRes) {
              rr.current = rr.isLongRest
                ? computeRecoveredResourceCurrent(parsedRes)
                : parsedRes.max;
            }
          }
        }
      }

      // Reset both long_rest and short_rest non-slot spells!
      const castCfgObj = ensureObj(s, 'spellCastConfigs');
      for (const [cfgKey, rawCfg] of Object.entries(castCfgObj)) {
        if (rawCfg && typeof rawCfg === 'object') {
          const cr = rawCfg as Record<string, unknown>;
          const matchingLearned = learnedSpells.find((lr) => `cat-${lr.spell.id}` === cfgKey);
          const effectiveMode =
            (typeof cr.mode === 'string' && cr.mode) || matchingLearned?.castMode || 'slot';
          if (effectiveMode === 'long_rest' || effectiveMode === 'short_rest') {
            cr.used = 0;
          }
        }
      }
    }, true);

    pushToast({
      title: 'Длинный отдых завершён',
      message:
        'Хиты, ячейки, кости хитов, уникальные ресурсы и заклинания «раз в отдых» восстановлены!',
      variant: 'success',
    });
  };

  const handleDeathSaveRoll = () => {
    if (!sheet) return;
    const res = rollD20WithModifier(0, rollMode);
    void sendRollToTable({
      title: 'Спасбросок от смерти',
      formula: res.formula,
      breakdown: res.breakdown,
      total: res.total,
      isCrit: res.isCrit,
      critKind: res.critKind,
    });

    if (!canEdit) return;
    commitMutation((s) => {
      const live = liveSheetRef.current ?? sheet;
      const vit = ensureObj(s, 'vitality');
      let succ = live.deathSaves.success;
      let fail = live.deathSaves.fail;

      if (res.rawD20 === 20) {
        setLssField(vit, 'hp-current', 1);
        vit.deathSaves = { success: 0, fail: 0 };
        return;
      }
      if (res.rawD20 === 1) {
        fail = Math.min(3, fail + 2);
      } else if (res.rawD20 >= 10) {
        succ = Math.min(3, succ + 1);
      } else {
        fail = Math.min(3, fail + 1);
      }
      vit.deathSaves = { success: succ, fail };
    }, true);
  };

  const openWeaponModalFor = (w?: LssParsedWeapon) => {
    if (w) {
      setEditingWeaponId(w.id);
      setWName(w.name);
      setWAbility(w.ability);
      setWIsProf(w.isProf);
      setWExtraMod(w.extraAttackMod || '0');
      setWDmg(w.damageRaw);
      setWDmgType(w.damageType);
      setWNotes(w.notes);
    } else {
      setEditingWeaponId(null);
      setWName('');
      setWAbility('str');
      setWIsProf(true);
      setWExtraMod('0');
      setWDmg('1к8+[STR]');
      setWDmgType('рубящий');
      setWNotes('');
    }
    setWeaponFormOpen(true);
  };

  const handleSaveWeapon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wName.trim()) return;
    const id = editingWeaponId || `wpn-${Date.now()}`;
    commitMutation((s) => {
      const list = Array.isArray(s.weaponsList) ? [...s.weaponsList] : [];
      const entry = {
        id,
        name: { value: wName.trim() },
        ability: wAbility,
        isProf: wIsProf,
        mod: { value: wExtraMod.trim() || '0' },
        dmg: { value: wDmg.trim() || '1к6' },
        dmgType: { value: wDmgType.trim() },
        notes: { value: wNotes.trim() },
      };
      const existingIdx = list.findIndex(
        (item) =>
          item &&
          typeof item === 'object' &&
          ((item as Record<string, unknown>).id === editingWeaponId ||
            ((item as Record<string, unknown>).name as Record<string, unknown>)?.value ===
              editingWeaponId)
      );
      if (editingWeaponId && existingIdx >= 0) {
        list[existingIdx] = entry;
      } else {
        list.push(entry);
      }
      s.weaponsList = list;
    }, true);
    setWeaponFormOpen(false);
  };

  const handleDeleteWeapon = (wId: string) => {
    commitMutation((s) => {
      const list = Array.isArray(s.weaponsList) ? s.weaponsList : [];
      s.weaponsList = list.filter((item, idx) => {
        if (!item || typeof item !== 'object') return false;
        const r = item as Record<string, unknown>;
        const itemId =
          typeof r.id === 'string' && r.id
            ? r.id
            : typeof (r.name as Record<string, unknown>)?.value === 'string'
              ? String((r.name as Record<string, unknown>).value)
              : `weapon-${idx}`;
        return itemId !== wId;
      });
    }, true);
  };

  const openResourceEditor = (res?: LssParsedResource) => {
    if (res) {
      setEditingResId(res.id);
      setRName(res.name);
      setRMax(res.max);
      setRMaxExpr(res.maxExpr);
      setRDie(res.die);
      setRSpendLimit(res.spendLimit);
      setRRest(res.isShortRest ? 'short' : res.isLongRest ? 'long' : 'none');
      setRRecoverMode(res.recoverMode);
      setRColor(res.color);
      setRGlyph(glyphToHudAssetKey(res.glyph || 'bolt'));
      setRNotes(res.notes);
    } else {
      setEditingResId(null);
      setRName('');
      setRMax(3);
      setRMaxExpr('');
      setRDie('');
      setRSpendLimit(0);
      setRRest('long');
      setRRecoverMode('all');
      setRColor('amber');
      setRGlyph('bolt');
      setRNotes('');
    }
    setResPresetsOpen(false);
    setResFormOpen(true);
  };

  const handleApplyResourcePreset = (preset: LssResourcePreset) => {
    if (!sheet || !canEdit) return;
    const built = preset.build({
      level: sheet.level,
      prof: sheet.proficiencyBonus,
    });
    const id = `res-${Date.now()}`;
    commitMutation((s) => {
      const resObj = ensureObj(s, 'resources');
      resObj[id] = {
        id,
        name: built.name,
        current: built.max,
        max: built.max,
        maxExpr: built.maxExpr,
        die: built.die,
        spendLimit: built.spendLimit,
        recoverMode: built.recoverMode,
        color: preset.color,
        glyph: preset.glyph,
        isShortRest: built.isShortRest,
        isLongRest: built.isLongRest,
        notes: built.notes,
      };
    }, true);
    setResPresetsOpen(false);
    pushToast({
      title: `Добавлен ресурс: ${built.name}`,
      message: built.die
        ? `Пул: ${built.max}, кость: ${built.die}`
        : `Зарядов: ${built.max}${built.spendLimit > 0 ? ` (лимит за раз: ${built.spendLimit})` : ''}`,
      variant: 'success',
    });
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName.trim()) return;
    const id = editingResId || `res-${Date.now()}`;
    commitMutation((s) => {
      const resObj = ensureObj(s, 'resources');
      const prev =
        editingResId && resObj[editingResId] && typeof resObj[editingResId] === 'object'
          ? (resObj[editingResId] as Record<string, unknown>)
          : null;
      const safeMax = Math.max(1, rMax);
      const nextCurrent = prev
        ? Math.min(safeMax, Math.max(0, Number(prev.current ?? safeMax)))
        : safeMax;
      resObj[id] = {
        ...(prev ?? {}),
        id,
        name: rName.trim(),
        current: editingResId ? nextCurrent : safeMax,
        max: safeMax,
        maxExpr: rMaxExpr.trim(),
        die: rDie.trim(),
        spendLimit: Math.max(0, rSpendLimit),
        recoverMode: rRecoverMode,
        color: rColor,
        glyph: glyphToHudAssetKey(rGlyph.trim() || 'bolt'),
        isShortRest: rRest === 'short',
        isLongRest: rRest === 'long',
        notes: rNotes.trim(),
      };
    }, true);
    setEditingResId(null);
    setResFormOpen(false);
  };

  const handleRollResourceDie = (res: LssParsedResource, spendCharge: boolean) => {
    const liveRes = liveSheetRef.current?.resources.find((x) => x.id === res.id) ?? res;
    if (!liveRes.dieResolved) return;
    if (spendCharge) {
      if (!canEdit) return;
      if (liveRes.current <= 0) {
        pushToast({
          title: 'Нет доступных костей/зарядов',
          message: `Ресурс «${liveRes.name}» исчерпан (0 / ${liveRes.max}).`,
          variant: 'warning',
        });
        return;
      }
      commitMutation((s) => {
        const ro = ensureObj(s, 'resources');
        const t = ensureObj(ro, liveRes.id);
        t.current = Math.max(0, liveRes.current - 1);
      }, true);
    }
    handleDamageRoll(
      `${liveRes.name}${spendCharge ? ' (-1 заряд)' : ''}`,
      liveRes.dieResolved
    );
  };

  const handleSpendResourceAmount = (res: LssParsedResource, delta: number) => {
    if (!canEdit) return;
    const liveRes = liveSheetRef.current?.resources.find((x) => x.id === res.id) ?? res;
    const abs = Math.abs(delta);
    if (delta < 0 && liveRes.spendLimit > 0 && abs > liveRes.spendLimit) {
      pushToast({
        title: 'Превышен лимит траты (Пси-лимит)',
        message: `За один раз нельзя потратить больше ${liveRes.spendLimit} ед. ресурса «${liveRes.name}».`,
        variant: 'warning',
      });
      return;
    }
    if (delta < 0 && liveRes.current < abs) {
      pushToast({
        title: 'Недостаточно зарядов',
        message: `В «${liveRes.name}» осталось ${liveRes.current} из ${abs} требуемых.`,
        variant: 'warning',
      });
      return;
    }
    const nextVal = Math.min(liveRes.max, Math.max(0, liveRes.current + delta));
    commitMutation((s) => {
      const ro = ensureObj(s, 'resources');
      const t = ensureObj(ro, liveRes.id);
      t.current = nextVal;
    }, true);
  };

  const resolveEffectiveSpellCast = (params: {
    configKey: string;
    spellLevel: number;
    defaultMode?: SpellCastMode;
    defaultMaxUses?: number;
    defaultResourceId?: string;
    defaultNote?: string;
  }) => {
    const localCfg = sheet?.spellcasting.castConfigs[params.configKey];
    const mode: SpellCastMode =
      params.spellLevel === 0 && (!localCfg || localCfg.mode === 'slot') && (!params.defaultMode || params.defaultMode === 'slot')
        ? 'at_will'
        : (localCfg?.mode ?? params.defaultMode ?? 'slot');
    const maxUses = Math.max(1, localCfg?.maxUses ?? params.defaultMaxUses ?? 1);
    const used = Math.min(maxUses, Math.max(0, localCfg?.used ?? 0));
    const resourceId = localCfg?.resourceId || params.defaultResourceId || '';
    const note = localCfg?.note ?? params.defaultNote ?? '';
    return { mode, maxUses, used, resourceId, note };
  };

  const handleCastSpellRow = (params: {
    configKey: string;
    spellName: string;
    spellLevel: number;
    mode: SpellCastMode;
    maxUses: number;
    used: number;
    resourceId: string;
    note: string;
  }) => {
    const liveSheet = liveSheetRef.current;
    if (!liveSheet) return;
    const heroName = liveSheet.name || profile.characterName || `Игрок ${profile.playerId}`;

    if (params.mode === 'at_will' || params.spellLevel === 0) {
      pushToast({
        title: `[CAST] ${heroName} творит «${params.spellName}»`,
        message: 'Неограниченное применение (ячейка не тратится).',
        variant: 'info',
      });
      return;
    }

    if (params.mode === 'ritual_only') {
      pushToast({
        title: `[RITUAL] ${heroName} проводит ритуал «${params.spellName}»`,
        message: '+10 минут к сотворению, ячейка заклинаний не тратится.',
        variant: 'info',
      });
      return;
    }

    if (!canEdit) return;

    if (
      params.mode === 'long_rest' ||
      params.mode === 'short_rest' ||
      params.mode === 'custom'
    ) {
      const liveCfg = liveSheet.spellcasting.castConfigs[params.configKey];
      const liveUsed = liveCfg ? liveCfg.used : params.used;
      const remaining = Math.max(0, params.maxUses - liveUsed);
      if (remaining <= 0) {
        pushToast({
          title: `Заряды «${params.spellName}» исчерпаны`,
          message:
            params.mode === 'short_rest'
              ? 'Восстановится после короткого или длинного отдыха.'
              : params.mode === 'long_rest'
                ? 'Восстановится после продолжительного отдыха.'
                : 'Свободных зарядов не осталось.',
          variant: 'warning',
        });
        return;
      }
      const nextUsed = Math.min(params.maxUses, liveUsed + 1);
      commitMutation((s) => {
        const cfgObj = ensureObj(s, 'spellCastConfigs');
        cfgObj[params.configKey] = {
          mode: params.mode,
          maxUses: params.maxUses,
          used: nextUsed,
          resourceId: params.resourceId,
          note: params.note,
        };
      }, true);
      pushToast({
        title: `[CAST] ${heroName} применяет «${params.spellName}»`,
        message: `Осталось применений: ${params.maxUses - nextUsed} / ${params.maxUses}${
          params.note ? ` (${params.note})` : ''
        }`,
        variant: 'success',
      });
      return;
    }

    if (params.mode === 'resource') {
      const targetRes =
        liveSheet.resources.find((r) => r.id === params.resourceId) ??
        liveSheet.resources.find(
          (r) => params.note && r.name.toLowerCase().includes(params.note.toLowerCase())
        );
      if (!targetRes) {
        pushToast({
          title: 'Не выбран уникальный ресурс',
          message: `Откройте настройки заклинания «${params.spellName}» и привяжите ресурс (напр. Пси-заряды).`,
          variant: 'warning',
        });
        return;
      }
      const cost = Math.max(1, params.maxUses);
      if (targetRes.spendLimit > 0 && cost > targetRes.spendLimit) {
        pushToast({
          title: 'Превышен Пси-лимит / лимит траты',
          message: `Стоимость (${cost}) выше лимита «${targetRes.name}» (${targetRes.spendLimit}).`,
          variant: 'warning',
        });
        return;
      }
      if (targetRes.current < cost) {
        pushToast({
          title: `Недостаточно ресурса «${targetRes.name}»`,
          message: `Нужно ${cost}, доступно ${targetRes.current} / ${targetRes.max}.`,
          variant: 'warning',
        });
        return;
      }
      const nextCurrent = Math.max(0, targetRes.current - cost);
      commitMutation((s) => {
        const ro = ensureObj(s, 'resources');
        const t = ensureObj(ro, targetRes.id);
        t.current = nextCurrent;
      }, true);
      pushToast({
        title: `[CAST] ${heroName} применяет «${params.spellName}»`,
        message: `Потрачено ${cost} из «${targetRes.name}» (осталось ${nextCurrent}/${targetRes.max}).`,
        variant: 'success',
      });
      return;
    }

    // Standard slot casting: find lowest available slot >= spellLevel (or Pact slot >= spellLevel)
    let chosenSlotLevel: number | null = null;
    for (let lvl = Math.max(1, params.spellLevel); lvl <= 9; lvl++) {
      const info = liveSheet.spellcasting.slotsByLevel[lvl];
      if (info && info.total - info.expended > 0) {
        chosenSlotLevel = lvl;
        break;
      }
    }
    const pact = liveSheet.spellcasting.pactSlots;
    const pactAvail = pact.total - pact.expended > 0 && pact.level >= params.spellLevel;

    if (chosenSlotLevel === null && !pactAvail) {
      pushToast({
        title: `Нет свободных ячеек ≥ ${params.spellLevel} круга`,
        message:
          'Настройте максимум ячеек выше или переключите заклинание на «1/дл. отдых» / «Неограниченно» в настройках заклинания.',
        variant: 'warning',
      });
      return;
    }

    if (
      pactAvail &&
      (chosenSlotLevel === null || pact.level <= chosenSlotLevel)
    ) {
      commitMutation((s) => {
        const pObj = ensureObj(s, 'spellsPact');
        const cur = ensureObj(pObj, `slots-${pact.level}`);
        cur.value = pact.total;
        cur.filled = Math.min(pact.total, pact.expended + 1);
      }, true);
      pushToast({
        title: `[CAST] ${heroName} сотворяет «${params.spellName}»`,
        message: `Потрачена ячейка Магии Пакта (${pact.level}-й круг).`,
        variant: 'success',
      });
    } else if (chosenSlotLevel !== null) {
      const slotInfo = liveSheet.spellcasting.slotsByLevel[chosenSlotLevel];
      commitMutation((s) => {
        const sp = ensureObj(s, 'spells');
        const cur = ensureObj(sp, `slots-${chosenSlotLevel}`);
        cur.value = slotInfo.total;
        cur.filled = Math.min(slotInfo.total, slotInfo.expended + 1);
      }, true);
      pushToast({
        title: `[CAST] ${heroName} сотворяет «${params.spellName}»`,
        message: `Потрачена ячейка ${chosenSlotLevel}-го круга.`,
        variant: 'success',
      });
    }
  };

  const handleSaveSpellCastConfigModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpellCast || !canEdit) return;
    const {
      configKey,
      catalogSpellId,
      manualSpellId,
      mode,
      maxUses,
      used,
      resourceId,
      note,
    } = editingSpellCast;
    const safeMax = Math.max(1, maxUses);
    const safeUsed = Math.min(safeMax, Math.max(0, used));

    commitMutation((s) => {
      const cfgObj = ensureObj(s, 'spellCastConfigs');
      cfgObj[configKey] = {
        mode,
        maxUses: safeMax,
        used: safeUsed,
        resourceId,
        note: note.trim(),
      };
      if (manualSpellId && Array.isArray(s.manualSpells)) {
        s.manualSpells = s.manualSpells.map((it) => {
          if (!it || typeof it !== 'object') return it;
          const r = it as Record<string, unknown>;
          if (r.id === manualSpellId) {
            return {
              ...r,
              castMode: mode,
              castMaxUses: safeMax,
              castResourceId: resourceId,
              castNote: note.trim(),
            };
          }
          return it;
        });
      }
    }, true);

    if (catalogSpellId !== null) {
      try {
        const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
          `/api/spells/${catalogSpellId}/learn-meta`,
          {
            method: 'PUT',
            body: JSON.stringify({
              playerId: profile.playerId,
              castMode: mode,
              castMaxUses: safeMax,
              castNote: note.trim(),
            }),
          }
        );
        updateLearnedSpellsInStore(profile.playerId, res.learnedSpells);
      } catch {
        // Sheet config already saved locally & synced via raw_lss_json
      }
    }

    setEditingSpellCast(null);
    pushToast({
      title: 'Способ применения сохранён',
      message: `Параметры «${editingSpellCast.spellName}» обновлены.`,
      variant: 'success',
    });
  };

  const handleAddManualSpell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msName.trim()) return;
    const id = `msp-${Date.now()}`;
    const effectiveMode: SpellCastMode = msLevel === 0 && msCastMode === 'slot' ? 'at_will' : msCastMode;
    const entry: LssManualSpellRow = {
      id,
      level: msLevel,
      name: msName.trim(),
      castingTime: msTime.trim() || '1 д.',
      range: msRange.trim() || '60 фт.',
      concentration: msConc,
      ritual: msRitual,
      material: msMat,
      notes: msNotes.trim(),
      castMode: effectiveMode,
      castMaxUses: Math.max(1, msCastMaxUses),
      castResourceId: msCastResourceId,
      castNote: msCastNote.trim(),
    };
    commitMutation((s) => {
      const list = Array.isArray(s.manualSpells) ? [...s.manualSpells] : [];
      list.push(entry);
      s.manualSpells = list;
      if (effectiveMode !== 'slot') {
        const cfgObj = ensureObj(s, 'spellCastConfigs');
        cfgObj[id] = {
          mode: effectiveMode,
          maxUses: Math.max(1, msCastMaxUses),
          used: 0,
          resourceId: msCastResourceId,
          note: msCastNote.trim(),
        };
      }
    }, true);
    setMsName('');
    setMsNotes('');
    setMsCastMode('slot');
    setMsCastMaxUses(1);
    setMsCastResourceId('');
    setMsCastNote('');
    setManualSpellFormOpen(false);
  };

  const handleUnlearnCatalogSpell = async (spellId: number, spellName: string) => {
    try {
      const endpoint = isDm
        ? `/api/dm/players/${profile.playerId}/spells/${spellId}/learn`
        : `/api/spells/${spellId}/learn`;
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(endpoint, {
        method: 'DELETE',
      });
      updateLearnedSpellsInStore(profile.playerId, res.learnedSpells);
      pushToast({
        title: 'Заклинание убрано из списка',
        message: `«${spellName}» удалено из изученных.`,
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось удалить заклинание',
        message: err instanceof Error ? err.message : 'Ошибка запроса',
        variant: 'error',
      });
    }
  };

  const handlePortraitFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPortrait(true);
    try {
      if (isDm) {
        const res = await uploadImageAsset(file, 'avatars');
        const url = resolveImageUrl(res.key, 'blades');
        commitMutation((s) => {
          s.avatar = { webp: url, jpeg: url };
        }, true);
      } else {
        // Compress client-side to compact Data URL so any player can set a portrait directly!
        const dataUrl = await resizeImageFileToDataUrl(file, 480, 0.82);
        commitMutation((s) => {
          s.avatar = { webp: dataUrl, jpeg: dataUrl };
        }, true);
      }
      setPortraitEditOpen(false);
      pushToast({
        title: 'Портрет обновлён',
        message: 'Изображение персонажа сохранено в листе.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки портрета',
        message: err instanceof Error ? err.message : 'Попробуйте другой файл',
        variant: 'error',
      });
    } finally {
      setUploadingPortrait(false);
      e.target.value = '';
    }
  };

  const openBlockEditor = (key: string, title: string) => {
    if (!canEdit || !sheet) return;
    const currentText = sheet.textByKey[key]?.plainText ?? '';
    setEditingBlock({ key, title, text: currentText });
  };

  // Empty Slot View
  if (!sheet) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void onQuickUploadFile(f);
        }}
        className={`p-8 sm:p-12 text-center space-y-5 transition-colors min-h-[420px] flex flex-col items-center justify-center ${
          dragOver ? 'bg-raised' : 'bg-bg'
        }`}
      >
        <div className="w-12 h-12 bg-surface border border-border flex items-center justify-center text-muted">
          <ScrollText className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="max-w-lg space-y-2">
          <h3 className="font-medium text-lg text-text">
            Лист персонажа D&amp;D 5e
          </h3>
          <p className="text-xs sm:text-sm text-secondary leading-relaxed">
            Создайте героя с нуля или перетащите файл{' '}
            <code className="text-text">.json</code> из Long Story Short. Характеристики, бой,
            портрет, заклинания, снаряжение и броски откроются прямо на сайте.
          </p>
        </div>

        {canEdit ? (
          <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => void handleCreateBlankSheet()}
              className="anime-btn-primary h-10 px-4 text-xs inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" strokeWidth={1.5} />
              <span>Создать с нуля</span>
            </button>

            <label className="hud-btn-secondary h-10 px-4 text-xs inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-muted" strokeWidth={1.5} />
              <span>Загрузить .json из LSS</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onQuickUploadFile(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onOpenImportModal}
              className="h-10 px-4 bg-surface border border-border hover:border-text/20 text-xs text-secondary hover:text-text transition-colors"
            >
              Вставить текст JSON
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted">
            Игрок ещё не создал персонажа. Нажмите «Только просмотр» выше, чтобы разрешить правку Мастером.
          </div>
        )}
      </div>
    );
  }

  const effectiveXp = optimisticXp ?? profile.experienceCurrent ?? sheet.experience ?? 0;
  const xpInfo = getXpProgressInfo(sheet.level, effectiveXp, profile.experienceMax ?? 0);
  const hpRatio = Math.min(
    100,
    Math.max(
      0,
      Math.round((sheet.combat.hpCurrent / Math.max(1, sheet.combat.hpMaxComputed)) * 100)
    )
  );

  // Extra custom text blocks not already placed in fixed classic frames
  const extraCustomBlocks = sheet.textBlocks.filter(
    (b) => !STANDARD_HANDLED_TEXT_KEYS.has(b.key)
  );

  const renderAbilityWithSkillsCard = (code: AbilityCode) => {
    const ab = sheet.abilities[code];
    const abilitySkills = sheet.skills.filter((s) => s.stat === code);

    return (
      <div key={code} className="sheet-frame overflow-hidden">
        <div className="sheet-frame__header">
          <span>{ab.fullRu}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditUnlocked((v) => !v)}
              className="text-muted hover:text-primary transition-colors"
              title="Изменить значение характеристики"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-3 space-y-2.5">
          {/* Classic Modifier Circle + Score Pill */}
          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => handleD20Roll(`Проверка: ${ab.fullRu}`, ab.checkBonus)}
              className="w-14 h-14 rounded-full bg-surface border-2 border-primary/65 hover:border-accent  flex flex-col items-center justify-center transition-transform hover:scale-105"
              title={`Бросить проверку ${ab.fullRu} (1к20${formatSigned(ab.checkBonus)})`}
            >
              <span className="font-anime font-semibold text-xl leading-none text-text">
                {formatSigned(ab.mod)}
              </span>
              <span className="text-[11px]  text-muted mt-0.5">мод</span>
            </button>

            <div className="flex flex-col items-center">
              {editUnlocked && canEdit ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      commitMutation((s) => {
                        const curBase = liveSheetRef.current?.abilities[code].baseScore ?? ab.baseScore;
                        const st = ensureObj(s, 'stats');
                        const cur = ensureObj(st, code);
                        cur.name = code;
                        cur.score = Math.max(1, curBase - 1);
                      }, true)
                    }
                    className="w-5 h-6 rounded bg-surface border border-border text-xs font-bold hover:border-primary"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={ab.baseScore}
                    onChange={(e) =>
                      commitMutation((s) => {
                        const st = ensureObj(s, 'stats');
                        const cur = ensureObj(st, code);
                        cur.name = code;
                        cur.score = Math.min(30, Math.max(1, Number(e.target.value) || 10));
                      })
                    }
                    className="anime-input w-12 py-0.5 px-1 text-center font-anime font-semibold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      commitMutation((s) => {
                        const curBase = liveSheetRef.current?.abilities[code].baseScore ?? ab.baseScore;
                        const st = ensureObj(s, 'stats');
                        const cur = ensureObj(st, code);
                        cur.name = code;
                        cur.score = Math.min(30, curBase + 1);
                      }, true)
                    }
                    className="w-5 h-6 rounded bg-surface border border-border text-xs font-bold hover:border-primary"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div className="px-3 py-1.5  bg-surface/85 border border-border text-center min-w-[52px]">
                  <div className="font-anime font-semibold text-base leading-none text-accent">
                    {ab.score}
                  </div>
                  <div className="text-[11px]  text-muted mt-0.5">
                    знач.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Saving Throw + Nested Governing Skills (exact Classic LSS grouping!) */}
          <div className="pt-2 border-t border-border/70 space-y-1">
            {/* Save Row */}
            <div
              className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                ab.saveProf
                  ? 'bg-accent/15 text-accent font-semibold border border-accent/30'
                  : 'hover:bg-surface/70 text-text/90'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    commitMutation((s) => {
                      const sv = ensureObj(s, 'saves');
                      const cur = ensureObj(sv, code);
                      cur.name = code;
                      cur.isProf = !ab.saveProf;
                    }, true)
                  }
                  className="w-4 h-4 flex items-center justify-center shrink-0 hover:scale-125 transition-transform"
                  title="Владение спасброском"
                >
                  {ab.saveProf ? '●' : '○'}
                </button>
                <button
                  type="button"
                  onClick={() => handleD20Roll(`Спасбросок: ${ab.fullRu}`, ab.saveBonus)}
                  className="text-left truncate font-semibold hover:text-primary"
                >
                  Спасбросок
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleD20Roll(`Спасбросок: ${ab.fullRu}`, ab.saveBonus)}
                className="font-mono font-bold text-xs shrink-0 hover:text-primary"
              >
                {formatSigned(ab.saveBonus)}
              </button>
            </div>

            {/* Governing Skills */}
            {abilitySkills.map((sk) => (
              <div
                key={sk.key}
                className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                  sk.profLevel > 0
                    ? 'bg-primary/12 text-text font-medium'
                    : 'hover:bg-surface/65 text-muted hover:text-text'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      commitMutation((s) => {
                        const skObj = ensureObj(s, 'skills');
                        const cur = ensureObj(skObj, sk.key);
                        cur.name = sk.key;
                        cur.baseStat = sk.stat;
                        cur.isProf = ((sk.profLevel + 1) % 3) as 0 | 1 | 2;
                      }, true)
                    }
                    className={`w-4 h-4 flex items-center justify-center shrink-0 hover:scale-125 transition-transform ${
                      sk.profLevel === 2
                        ? 'text-amber-300 font-bold'
                        : sk.profLevel === 1
                          ? 'text-primary font-bold'
                          : 'text-muted/60'
                    }`}
                    title="Переключить: Нет (○) → Владение (●) → Компетентность (◆)"
                  >
                    {sk.profLevel === 2 ? '◆' : sk.profLevel === 1 ? '●' : '○'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleD20Roll(`Навык: ${sk.labelRu}`, sk.total)}
                    className="text-left truncate hover:text-primary"
                  >
                    {sk.labelRu}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleD20Roll(`Навык: ${sk.labelRu}`, sk.total)}
                  className="font-mono font-bold text-xs text-text shrink-0 hover:text-accent"
                >
                  {formatSigned(sk.total)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-5 space-y-4">
      {/* Classic Page Switcher + Roll Mode + Compact Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border">
        {/* 3 Classic Pages */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'page1', label: '1. Основа и Бой', icon: <Swords className="w-3.5 h-3.5" /> },
              {
                id: 'page2',
                label: '2. Портрет и Заметки',
                icon: <ImageIcon className="w-3.5 h-3.5" />,
              },
              {
                id: 'page3',
                label: `3. Магия и Снаряжение`,
                icon: <Sparkles className="w-3.5 h-3.5" />,
              },
            ] as const
          ).map((tab) => {
            const active = page === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPage(tab.id)}
                className={`px-3.5 py-2  text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'anime-btn-primary'
                    : 'bg-bg/75 border border-border text-muted hover:text-text hover:border-primary/40'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Roll Mode + Quick Dice Tray + Edit Numbers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {dirtySaving && (
            <span className="text-[11px] text-accent  mr-1">Сохранение...</span>
          )}

          <div className="inline-flex items-center bg-bg/85 p-0.5  border border-border">
            {(
              [
                { id: 'normal', label: '1к20', cls: 'bg-primary/25 text-text border-primary/50' },
                {
                  id: 'advantage',
                  label: 'Преим.',
                  cls: 'bg-emerald-500/25 text-emerald-200 border-emerald-500/50',
                },
                {
                  id: 'disadvantage',
                  label: 'Помеха',
                  cls: 'bg-rose-500/25 text-rose-200 border-rose-500/50',
                },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setRollMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border border-transparent transition-colors ${
                  rollMode === m.id ? m.cls : 'text-muted hover:text-text'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDiceDrawerOpen((v) => !v)}
            className={`px-2.5 py-1.5  border text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
              diceDrawerOpen
                ? 'bg-accent/20 border-accent/50 text-accent'
                : 'bg-bg/75 border-border text-muted hover:text-text'
            }`}
            title="Быстрые кубики к4..к100 и своя формула"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Кубики</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditUnlocked((v) => !v)}
              className={`px-3 py-1.5  border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                editUnlocked
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                  : 'bg-bg/75 border-border text-muted hover:text-text'
              }`}
              title="Редактировать числа характеристик, КД, скорости и максимума ХП прямо в ячейках"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editUnlocked ? 'Готово' : 'Править числа'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Polyhedral Dice Bar */}
      {diceDrawerOpen && (
        <div className="p-2.5 hud-cut-sm bg-bg/85 border border-accent/35 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted px-1">Быстрый бросок:</span>
            {([4, 6, 8, 10, 12, 20, 100] as const).map((sides) => (
              <button
                key={sides}
                type="button"
                onClick={() => {
                  if (sides === 20) handleD20Roll('Бросок к20', 0);
                  else handleDamageRoll(`Бросок к${sides}`, `1к${sides}`);
                }}
                className="px-2.5 py-1 rounded-lg bg-surface hover:bg-primary/20 border border-border hover:border-primary/50 text-xs font-mono font-bold text-text"
              >
                к{sides}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customFormula.trim()) return;
              handleDamageRoll(`Формула (${customFormula.trim()})`, customFormula.trim());
              setCustomFormula('');
            }}
            className="flex items-center gap-1.5"
          >
            <input
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              placeholder="Своя формула: 2к6+4"
              className="anime-input w-40 py-1 px-2.5 text-xs font-mono"
            />
            <button type="submit" className="anime-btn-primary px-3 py-1 text-xs">
              Бросить
            </button>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CLASSIC PAGE 1: IDENTITY + XP BAR + STATS/SKILLS + COMBAT & FEATURES  */}
      {/* ===================================================================== */}
      {page === 'page1' && (
        <div className="space-y-4">
          {/* Classic Top Header Strip */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
            {/* Left Identity Plaque (Name + Background / Class / Species / Subclass + Level Circle) */}
            <div className="xl:col-span-5 sheet-frame p-3.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Character Name */}
                <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-1.5">
                  <div className="min-w-0">
                    <div className="font-anime font-semibold text-lg sm:text-xl text-text truncate">
                      {sheet.name}
                    </div>
                    <div className="text-[11px]  text-muted">
                      Имя персонажа
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setHeroModalOpen(true)}
                      className="p-1.5 rounded-lg bg-surface border border-border hover:border-primary text-muted hover:text-primary shrink-0"
                      title="Редактировать имя, класс, вид, подкласс и уровень"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 2x2 Classic Fields: Background | Class / Species | Subclass */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="border-b border-border/60 pb-1 min-w-0">
                    <div className="text-xs font-semibold text-text truncate">
                      {sheet.background || '—'}
                    </div>
                    <div className="text-[11px]  text-muted">
                      Предыстория
                    </div>
                  </div>
                  <div className="border-b border-border/60 pb-1 min-w-0">
                    <div className="text-xs font-bold text-accent truncate">
                      {sheet.classLabel || '—'}
                    </div>
                    <div className="text-[11px]  text-muted">Класс</div>
                  </div>
                  <div className="border-b border-border/60 pb-1 min-w-0">
                    <div className="text-xs font-semibold text-text truncate">
                      {sheet.race || '—'}
                    </div>
                    <div className="text-[11px]  text-muted">Вид / Раса</div>
                  </div>
                  <div className="border-b border-border/60 pb-1 min-w-0">
                    <div className="text-xs font-semibold text-primary truncate">
                      {sheet.subclass || '—'}
                    </div>
                    <div className="text-[11px]  text-muted">Подкласс</div>
                  </div>
                </div>
              </div>

              {/* Classic Level Medallion */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setHeroModalOpen(true)}
                className="w-20 h-20 rounded-full bg-surface border-2 border-primary/70  flex flex-col items-center justify-center shrink-0 hover:border-accent transition-colors"
                title="Уровень персонажа"
              >
                <span className="font-anime font-semibold text-2xl leading-none text-text">
                  {sheet.level}
                </span>
                <span className="text-[11px]  text-muted mt-1">
                  Уровень
                </span>
              </button>
            </div>

            {/* Right Classic Vitality Strip: AC Shield | HP | Hit Dice | Death Saves */}
            <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-12 gap-2.5">
              {/* Armor Class Shield */}
              <div className="col-span-1 sm:col-span-3 sheet-frame sheet-frame--accent p-3 flex flex-col items-center justify-between text-center">
                <div className="text-[11px] font-semibold  text-muted">
                  Класс защиты
                </div>

                {editUnlocked && canEdit ? (
                  <input
                    value={sheet.combat.acFormula}
                    onChange={(e) =>
                      commitMutation((s) => {
                        const vit = ensureObj(s, 'vitality');
                        setLssField(vit, 'ac', e.target.value);
                      })
                    }
                    placeholder="10+[DEX]"
                    className="anime-input w-full py-1 px-1.5 text-xs text-center font-mono my-1"
                  />
                ) : (
                  <div className="font-anime font-semibold text-3xl text-primary flex items-center gap-1 my-0.5">
                    <Shield className="w-5 h-5 text-accent" />
                    <span>{sheet.combat.ac}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    commitMutation((s) => {
                      const vit = ensureObj(s, 'vitality');
                      vit.shield = {
                        value: !sheet.combat.shieldEquipped,
                        mod: sheet.combat.shieldMod || '2',
                      };
                    }, true)
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                    sheet.combat.shieldEquipped
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-surface/70 border-border text-muted hover:text-text'
                  }`}
                >
                  Щит {sheet.combat.shieldEquipped ? '+2' : 'нет'}
                </button>
              </div>

              {/* Hit Points Box */}
              <div className="col-span-1 sm:col-span-4 sheet-frame p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-semibold  text-muted">
                  <span>Хиты</span>
                  {sheet.combat.hpTemp > 0 && (
                    <span className="text-cyan-300">+{sheet.combat.hpTemp} врем.</span>
                  )}
                </div>

                {editUnlocked && canEdit ? (
                  <div className="grid grid-cols-3 gap-1 my-1 text-center">
                    <div>
                      <input
                        type="number"
                        min={0}
                        value={sheet.combat.hpCurrent}
                        onChange={(e) =>
                          commitMutation((s) => {
                            const vit = ensureObj(s, 'vitality');
                            setLssField(vit, 'hp-current', Math.max(0, Number(e.target.value)));
                          })
                        }
                        className="anime-input w-full py-0.5 px-1 text-xs text-center"
                      />
                      <div className="text-[11px] text-muted">Тек.</div>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={1}
                        value={sheet.combat.hpMaxBase}
                        onChange={(e) =>
                          commitMutation((s) => {
                            const vit = ensureObj(s, 'vitality');
                            setLssField(vit, 'hp-max', Math.max(1, Number(e.target.value)));
                          })
                        }
                        className="anime-input w-full py-0.5 px-1 text-xs text-center"
                      />
                      <div className="text-[11px] text-muted">Макс.</div>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        value={sheet.combat.hpTemp}
                        onChange={(e) =>
                          commitMutation((s) => {
                            const vit = ensureObj(s, 'vitality');
                            setLssField(vit, 'hp-temp', Math.max(0, Number(e.target.value)));
                          })
                        }
                        className="anime-input w-full py-0.5 px-1 text-xs text-center"
                      />
                      <div className="text-[11px] text-cyan-300">Врем.</div>
                    </div>
                  </div>
                ) : (
                  <div className="my-1 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={`font-anime font-semibold text-2xl leading-none ${
                          sheet.combat.hpCurrent === 0 ? 'text-rose-400' : 'text-emerald-300'
                        }`}
                      >
                        {sheet.combat.hpCurrent}
                      </span>
                      <span className="text-xs text-muted font-bold">
                        / {sheet.combat.hpMaxComputed} макс.
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className={`h-full transition-colors duration-300 ${
                          hpRatio <= 25
                            ? 'bg-rose-500'
                            : hpRatio <= 55
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                        }`}
                        style={{ width: `${hpRatio}%` }}
                      />
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="flex items-center gap-1 pt-1">
                    <input
                      type="number"
                      min={1}
                      value={hpDeltaInput}
                      onChange={(e) => setHpDeltaInput(e.target.value)}
                      placeholder="±ХП"
                      className="anime-input w-12 py-0.5 px-1.5 text-[11px] text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const n = Math.abs(Number(hpDeltaInput)) || 1;
                        adjustHp(-n);
                        setHpDeltaInput('');
                      }}
                      className="flex-1 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-bold text-rose-200"
                      title="Нанести урон (по пустому полю — -1)"
                    >
                      Урон
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const n = Math.abs(Number(hpDeltaInput)) || 1;
                        adjustHp(n);
                        setHpDeltaInput('');
                      }}
                      className="flex-1 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-200"
                      title="Исцелить (по пустому полю — +1)"
                    >
                      Леч.
                    </button>
                  </div>
                )}
              </div>

              {/* Hit Dice Box */}
              <div className="col-span-1 sm:col-span-2 sheet-frame p-3 flex flex-col items-center justify-between text-center">
                <div className="text-[11px] font-semibold  text-muted">
                  Кости хитов
                </div>

                <div className="font-anime font-semibold text-lg text-text">
                  {sheet.combat.hitDiceCurrent} / {sheet.level}
                </div>

                <div className="w-full flex items-center justify-center gap-1">
                  <select
                    disabled={!canEdit}
                    value={sheet.combat.hitDie}
                    onChange={(e) =>
                      commitMutation((s) => {
                        const vit = ensureObj(s, 'vitality');
                        setLssField(vit, 'hit-die', e.target.value);
                      }, true)
                    }
                    className="bg-surface border border-border rounded-md px-1.5 py-0.5 text-[11px] font-bold text-accent focus:outline-none"
                  >
                    {HIT_DICE_OPTIONS.map((hd) => (
                      <option key={hd} value={hd}>
                        {hd}
                      </option>
                    ))}
                  </select>

                  {canEdit && sheet.combat.hitDiceCurrent > 0 && (
                    <button
                      type="button"
                      onClick={handleSpendHitDie}
                      className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold inline-flex items-center justify-center"
                      title="Потратить 1 кость хитов для броска исцеления"
                    >
                      <HudIcon asset="dice" size="xs" />
                    </button>
                  )}
                </div>
              </div>

              {/* Death Saves Box (Always visible in top-right, just like Classic LSS!) */}
              <div className="col-span-1 sm:col-span-3 sheet-frame p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold  text-muted">
                    Спас. смерти
                  </span>
                  <button
                    type="button"
                    onClick={handleDeathSaveRoll}
                    className="text-[11px] text-rose-300 hover:text-rose-200 font-bold inline-flex items-center gap-0.5"
                    title="Бросить спасбросок от смерти (1к20)"
                  >
                    <Dices className="w-3 h-3" />
                    <span>1к20</span>
                  </button>
                </div>

                <div className="space-y-1.5 my-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 font-semibold">Успехи</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3].map((i) => {
                        const filled = sheet.deathSaves.success >= i;
                        return (
                          <button
                            key={`ds-s-${i}`}
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              commitMutation((s) => {
                                const vit = ensureObj(s, 'vitality');
                                vit.deathSaves = {
                                  success: filled ? i - 1 : i,
                                  fail: sheet.deathSaves.fail,
                                };
                              }, true)
                            }
                            className={`w-3.5 h-3.5 rotate-45 border transition-colors ${
                              filled
                                ? 'bg-emerald-400 border-emerald-200 shadow-sm'
                                : 'bg-surface border-border hover:border-emerald-400'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-rose-300 font-semibold">Провалы</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3].map((i) => {
                        const filled = sheet.deathSaves.fail >= i;
                        return (
                          <button
                            key={`ds-f-${i}`}
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              commitMutation((s) => {
                                const vit = ensureObj(s, 'vitality');
                                vit.deathSaves = {
                                  success: sheet.deathSaves.success,
                                  fail: filled ? i - 1 : i,
                                };
                              }, true)
                            }
                            className={`w-3.5 h-3.5 rotate-45 border transition-colors ${
                              filled
                                ? 'bg-rose-500 border-rose-200 shadow-sm'
                                : 'bg-surface border-border hover:border-rose-400'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MASTER-ONLY EXPERIENCE BAR ON PAGE 1 */}
          <div className="sheet-frame px-4 py-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-anime font-semibold  text-[11px] text-text">
                  Шкала опыта (XP)
                </span>
                <span className="font-mono font-bold text-accent">
                  {xpInfo.currentXp.toLocaleString('ru-RU')} /{' '}
                  {xpInfo.targetXp.toLocaleString('ru-RU')} XP
                </span>
                <span className="text-[11px] text-muted">
                  ({sheet.level >= 20 ? 'Макс. 20 ур.' : `Ур. ${sheet.level} → ${sheet.level + 1} • ${xpInfo.percent}%`})
                </span>
              </div>

              {isDm ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {xpInfo.canLevelUp && (
                    <button
                      type="button"
                      disabled={xpSaving}
                      onClick={() => void handleDmUpdateXp({ levelUp: true })}
                      className="px-2.5 py-1 bg-warning/15 hover:bg-warning/25 border border-warning/40 text-warning text-xs font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Повысить до {sheet.level + 1} ур.</span>
                    </button>
                  )}

                  {[-100, 50, 100, 250, 500, 1000].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => void handleDmUpdateXp({ delta })}
                      className="px-2 py-0.5 text-xs font-mono border border-border bg-surface hover:bg-raised text-secondary hover:text-text transition-colors tabular-nums"
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setXpMaxInput(
                        profile.experienceMax > 0 ? String(profile.experienceMax) : ''
                      );
                      setXpSettingsOpen((v) => !v);
                    }}
                    className="p-1 bg-surface border border-border text-muted hover:text-text transition-colors"
                    title="Точное управление опытом и порогом уровня"
                  >
                    <Settings2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted">
                  Начисляется Мастером
                </span>
              )}
            </div>

            {/* Quiet XP Progress Track */}
            <div className="w-full h-1.5 bg-deep overflow-hidden">
              <div
                className="h-full transition-colors bg-primary"
                style={{ width: `${xpInfo.percent}%` }}
              />
            </div>

            {/* Expandable DM Exact XP & Custom Threshold Controls */}
            {isDm && xpSettingsOpen && (
              <div className="pt-2 border-t border-border/70 flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="number"
                  min={0}
                  value={xpInput}
                  onChange={(e) => setXpInput(e.target.value)}
                  placeholder="Число XP..."
                  className="anime-input w-28 py-1 px-2 text-xs"
                />
                <button
                  type="button"
                  disabled={!xpInput || xpSaving}
                  onClick={() => {
                    const n = Number(xpInput);
                    if (Number.isFinite(n)) void handleDmUpdateXp({ delta: n });
                    setXpInput('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-accent/20 border border-accent/40 text-accent font-bold text-[11px]"
                >
                  Прибавить
                </button>
                <button
                  type="button"
                  disabled={xpInput === '' || xpSaving}
                  onClick={() => {
                    const n = Number(xpInput);
                    if (Number.isFinite(n)) void handleDmUpdateXp({ setXp: Math.max(0, n) });
                    setXpInput('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-primary text-[11px] font-semibold"
                >
                  Установить XP
                </button>

                <span className="text-border mx-1">|</span>

                <input
                  type="number"
                  min={1}
                  value={xpMaxInput}
                  onChange={(e) => setXpMaxInput(e.target.value)}
                  placeholder={`Порог (авто: ${xpInfo.targetXp})`}
                  className="anime-input w-44 py-1 px-2 text-xs"
                />
                <button
                  type="button"
                  disabled={xpSaving}
                  onClick={() => {
                    const trimmed = xpMaxInput.trim();
                    if (!trimmed) {
                      void handleDmUpdateXp({ setMaxXp: null });
                    } else {
                      const n = Number(trimmed);
                      if (Number.isFinite(n) && n > 0) void handleDmUpdateXp({ setMaxXp: n });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-accent text-[11px] font-semibold"
                >
                  Задать порог
                </button>
              </div>
            )}
          </div>

          {/* CLASSIC 3-COLUMN BODY (matching image-3.png!) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* COLUMN 1: Proficiency, STR, DEX, CON, Exhaustion, ВТОРОЙ ШАНС, Armor/Weapon/Tool Proficiencies */}
            <div className="lg:col-span-3 space-y-3">
              {/* Proficiency Bonus Plaque */}
              <div className="sheet-frame px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold  text-muted">
                  Бонус владения
                </span>
                <span className="px-3 py-1  bg-primary/20 border border-primary/45 font-anime font-semibold text-base text-primary">
                  {formatSigned(sheet.proficiencyBonus)}
                </span>
              </div>

              {renderAbilityWithSkillsCard('str')}
              {renderAbilityWithSkillsCard('dex')}
              {renderAbilityWithSkillsCard('con')}

              {/* Exhaustion 6 Checkboxes */}
              <div className="sheet-frame p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold  text-muted">
                  <span>Истощение</span>
                  {sheet.exhaustion > 0 && (
                    <span className="text-rose-400">Ступень {sheet.exhaustion}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  {[1, 2, 3, 4, 5, 6].map((lvl) => {
                    const active = sheet.exhaustion >= lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          commitMutation((s) => {
                            s.exhaustion = active && sheet.exhaustion === lvl ? lvl - 1 : lvl;
                          }, true)
                        }
                        className={`flex-1 h-6 rounded-md border text-[11px] font-bold transition-colors ${
                          active
                            ? 'bg-rose-500/30 border-rose-400 text-rose-200'
                            : 'bg-surface border-border text-muted/60 hover:border-rose-400/50'
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ВТОРОЙ ШАНС (replaces Heroic Inspiration per user instruction!) */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  commitMutation((s) => {
                    s.inspiration = !sheet.inspiration;
                  }, true)
                }
                className={`w-full sheet-frame p-3 flex items-center justify-between transition-colors ${
                  sheet.inspiration
                    ? 'neon-border bg-accent/15'
                    : 'hover:border-accent/45'
                }`}
                title="Активировать или потратить «Второй шанс» персонажа"
              >
                <div className="text-left">
                  <div className="text-[11px] font-semibold  text-text">
                    Второй шанс
                  </div>
                  <div className="text-[11px] text-muted">
                    {sheet.inspiration ? 'Активен — готов к использованию' : 'Не активен'}
                  </div>
                </div>
                <div
                  className={`w-8 h-8 border-2 flex items-center justify-center transition-colors ${
                    sheet.inspiration
                      ? 'bg-primary/25 border-primary text-primary  scale-105'
                      : 'bg-surface border-border opacity-40'
                  }`}
                >
                  <HudIcon asset="spark" size="sm" />
                </div>
              </button>

              {/* Equipment Proficiencies & Tools/Languages (Bottom-Left Classic Box) */}
              <div className="sheet-frame overflow-hidden">
                <div className="sheet-frame__header">
                  <span>Владение снаряжением и языки</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        openBlockEditor('prof', 'Владение инструментами и языками')
                      }
                      className="text-muted hover:text-accent"
                      title="Редактировать инструменты и языки"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-3 space-y-2.5 text-xs">
                  <div className="space-y-1">
                    <div className="text-[11px]  text-muted font-bold">
                      Доспехи
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['armor-light', 'Лёгкие'],
                          ['armor-medium', 'Средние'],
                          ['armor-heavy', 'Тяжёлые'],
                          ['armor-label', 'Щит'],
                        ] as const
                      ).map(([k, lbl]) => {
                        const on = sheet.profFlagKeys.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              commitMutation((s) => {
                                const pr = ensureObj(s, 'prof');
                                setLssField(pr, k, !on);
                              }, true)
                            }
                            className={`px-2 py-0.5 rounded-md text-[11px] border inline-flex items-center gap-1 ${
                              on
                                ? 'bg-primary/20 border-primary/50 text-text font-semibold'
                                : 'bg-surface/60 border-border text-muted'
                            }`}
                          >
                            <span className="text-[11px] text-primary">{on ? '◆' : '◇'}</span>
                            <span>{lbl}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px]  text-muted font-bold">
                      Оружие
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['weapon-simple', 'Простое'],
                          ['weapon-martial', 'Воинское'],
                          ['weapon-other', 'Другое'],
                        ] as const
                      ).map(([k, lbl]) => {
                        const on = sheet.profFlagKeys.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            disabled={!canEdit}
                            onClick={() =>
                              commitMutation((s) => {
                                const pr = ensureObj(s, 'prof');
                                setLssField(pr, k, !on);
                              }, true)
                            }
                            className={`px-2 py-0.5 rounded-md text-[11px] border inline-flex items-center gap-1 ${
                              on
                                ? 'bg-primary/20 border-primary/50 text-text font-semibold'
                                : 'bg-surface/60 border-border text-muted'
                            }`}
                          >
                            <span className="text-[11px] text-primary">{on ? '◆' : '◇'}</span>
                            <span>{lbl}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 space-y-1">
                    <div className="text-[11px]  text-muted font-bold">
                      Инструменты и языки
                    </div>
                    <div className="sheet-grid-paper rounded-lg p-2 min-h-[48px] text-xs text-text/90 whitespace-pre-line">
                      {sheet.textByKey.prof?.plainText || (
                        <span className="text-muted/60">Общий...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 2: INT, WIS, CHA with their nested Skills */}
            <div className="lg:col-span-3 space-y-3">
              {renderAbilityWithSkillsCard('int')}
              {renderAbilityWithSkillsCard('wis')}
              {renderAbilityWithSkillsCard('cha')}
            </div>

            {/* COLUMN 3: Initiative/Speed/Passive/Conditions + Weapons Table + Resources + Features & Feats */}
            <div className="lg:col-span-6 space-y-3.5">
              {/* Top 4 Combat Plaques */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Initiative */}
                <div className="sheet-frame p-2.5 text-center">
                  <div className="text-[11px] font-semibold  text-muted">
                    Инициатива
                  </div>
                  {editUnlocked && canEdit ? (
                    <input
                      value={sheet.combat.initiativeRaw}
                      onChange={(e) =>
                        commitMutation((s) => {
                          const vit = ensureObj(s, 'vitality');
                          setLssField(vit, 'initiative', e.target.value);
                        })
                      }
                      className="anime-input w-full py-0.5 px-1 text-xs text-center font-mono mt-1"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleD20Roll('Инициатива', sheet.combat.initiative)}
                      className="mt-1 font-anime font-semibold text-xl text-primary hover:text-accent inline-flex items-center gap-1"
                      title="Нажмите для броска инициативы"
                    >
                      <span>{formatSigned(sheet.combat.initiative)}</span>
                      <Dices className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Speed */}
                <div className="sheet-frame p-2.5 text-center">
                  <div className="text-[11px] font-semibold  text-muted">
                    Скорость
                  </div>
                  {editUnlocked && canEdit ? (
                    <input
                      value={sheet.combat.speedRaw}
                      onChange={(e) =>
                        commitMutation((s) => {
                          const vit = ensureObj(s, 'vitality');
                          setLssField(vit, 'speed', e.target.value);
                        })
                      }
                      className="anime-input w-full py-0.5 px-1 text-xs text-center mt-1"
                    />
                  ) : (
                    <div className="mt-1 font-anime font-semibold text-lg text-text">
                      {sheet.combat.speed}
                    </div>
                  )}
                </div>

                {/* Passive Perception */}
                <div
                  className="sheet-frame p-2.5 text-center"
                  title={`Пассивная Проницательность: ${sheet.combat.passiveInsight} • Пассивный Анализ: ${sheet.combat.passiveInvestigation}`}
                >
                  <div className="text-[11px] font-semibold  text-muted">
                    П. Восприятие
                  </div>
                  <div className="mt-1 font-anime font-semibold text-xl text-text">
                    {sheet.combat.passivePerception}
                  </div>
                </div>

                {/* Conditions Plaque */}
                <button
                  type="button"
                  onClick={() => setConditionsOpen((v) => !v)}
                  className={`sheet-frame p-2.5 text-center transition-colors ${
                    sheet.conditions.length > 0 ? 'border-rose-500/60 bg-rose-500/10' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold  text-muted">
                    Состояния
                  </div>
                  <div className="mt-1 text-xs font-bold truncate text-rose-300">
                    {sheet.conditions.length > 0
                      ? sheet.conditions.join(', ')
                      : 'Норма'}
                  </div>
                </button>
              </div>

              {/* Rest Buttons Bar */}
              {canEdit && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleShortRest}
                    className="px-3 py-1  bg-surface border border-border hover:border-accent text-[11px] font-semibold text-muted hover:text-accent inline-flex items-center gap-1"
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Короткий отдых</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLongRest}
                    className="px-3 py-1  bg-primary/15 border border-primary/40 hover:bg-primary/25 text-[11px] font-semibold text-primary inline-flex items-center gap-1"
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Длинный отдых</span>
                  </button>
                </div>
              )}

              {conditionsOpen && (
                <div className="p-3 hud-cut-sm bg-surface/95 border border-rose-500/40 flex flex-wrap gap-1.5">
                  {DND_CONDITIONS_RU.map((cond) => {
                    const active = sheet.conditions.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          commitMutation((s) => {
                            const cur = Array.isArray(s.conditions)
                              ? s.conditions.filter((x): x is string => typeof x === 'string')
                              : [];
                            s.conditions = active
                              ? cur.filter((x) => x !== cond)
                              : [...cur, cond];
                          }, true)
                        }
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                          active
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                            : 'bg-bg/70 border-border text-muted hover:text-text'
                        }`}
                      >
                        {cond}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Classic Weapons & Cantrips Table */}
              <div className="sheet-frame overflow-hidden">
                <div className="sheet-frame__header">
                  <span>Оружие и боевые заговоры</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openWeaponModalFor()}
                      className="px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-[11px] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Добавить</span>
                    </button>
                  )}
                </div>

                {weaponFormOpen && canEdit && (
                  <form
                    onSubmit={handleSaveWeapon}
                    className="p-3 bg-surface/95 border-b border-border space-y-2.5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        required
                        value={wName}
                        onChange={(e) => setWName(e.target.value)}
                        placeholder="Название оружия"
                        className="anime-input py-1.5 px-2.5 text-xs"
                      />
                      <select
                        value={wAbility}
                        onChange={(e) => {
                          const val = e.target.value as AbilityCode | 'none';
                          setWAbility(val);
                          if (!editingWeaponId && val !== 'none') {
                            setWDmg(`1к8+[${val.toUpperCase()}]`);
                          }
                        }}
                        className="anime-input py-1.5 px-2.5 text-xs"
                      >
                        {(Object.keys(ABILITY_META) as AbilityCode[]).map((c) => (
                          <option key={c} value={c}>
                            {ABILITY_META[c].fullRu} ({ABILITY_META[c].shortRu})
                          </option>
                        ))}
                        <option value="none">Без хар-ки</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] flex items-center gap-1 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={wIsProf}
                            onChange={(e) => setWIsProf(e.target.checked)}
                          />
                          <span>БМ</span>
                        </label>
                        <input
                          value={wExtraMod}
                          onChange={(e) => setWExtraMod(e.target.value)}
                          placeholder="+мод (0)"
                          className="anime-input w-full py-1.5 px-2 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        required
                        value={wDmg}
                        onChange={(e) => setWDmg(e.target.value)}
                        placeholder="Урон: 1к8+[STR]"
                        className="anime-input py-1.5 px-2.5 text-xs font-mono"
                      />
                      <input
                        value={wDmgType}
                        onChange={(e) => setWDmgType(e.target.value)}
                        placeholder="Вид урона (рубящий)"
                        className="anime-input py-1.5 px-2.5 text-xs"
                      />
                      <input
                        value={wNotes}
                        onChange={(e) => setWNotes(e.target.value)}
                        placeholder="Заметки / свойства"
                        className="anime-input py-1.5 px-2.5 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setWeaponFormOpen(false)}
                        className="px-2.5 py-1 rounded-lg border border-border text-xs text-muted"
                      >
                        Отмена
                      </button>
                      <button type="submit" className="anime-btn-primary px-3 py-1 text-xs">
                        Сохранить
                      </button>
                    </div>
                  </form>
                )}

                <div className="p-2.5 overflow-x-auto">
                  {sheet.weapons.length === 0 ? (
                    <div className="text-xs text-muted py-3 text-center">
                      Оружие не добавлено. Нажмите «+ Добавить» для создания строки атаки.
                    </div>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-[11px]  text-muted border-b border-border/70">
                          <th className="text-left py-1 px-1.5">Название</th>
                          <th className="text-center py-1 px-1.5">Попадание</th>
                          <th className="text-center py-1 px-1.5">Урон / Вид</th>
                          <th className="text-left py-1 px-1.5">Заметки</th>
                          {canEdit && <th className="w-12" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {sheet.weapons.map((w) => (
                          <tr key={w.id} className="hover:bg-surface/50">
                            <td className="py-1.5 px-1.5 font-semibold text-text">{w.name}</td>
                            <td className="py-1.5 px-1.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  handleD20Roll(`Атака: ${w.name}`, w.attackBonus)
                                }
                                className="px-2 py-0.5 rounded-md bg-primary/20 hover:bg-primary/30 border border-primary/40 font-mono font-bold text-primary"
                              >
                                {formatSigned(w.attackBonus)}
                              </button>
                            </td>
                            <td className="py-1.5 px-1.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDamageRoll(`Урон (${w.name})`, w.damageResolved)
                                }
                                className="px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 font-mono font-bold text-rose-300"
                              >
                                {w.damageResolved}
                              </button>
                              {w.damageType && (
                                <span className="block text-[11px] text-muted">
                                  {w.damageType}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-[11px] text-muted">{w.notes}</td>
                            {canEdit && (
                              <td className="py-1.5 px-1 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openWeaponModalFor(w)}
                                  className="p-1 text-muted hover:text-primary"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteWeapon(w.id)}
                                  className="p-1 text-muted hover:text-rose-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* LSS-Style Unique Resources, Rogue Dice & Mystic Psi Pools */}
              <div className="sheet-frame overflow-hidden">
                <div className="sheet-frame__header">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Уникальные ресурсы, кости и пси-заряды (LSS)</span>
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setResFormOpen(false);
                          setResPresetsOpen((v) => !v);
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-400/35 text-[11px] font-bold inline-flex items-center gap-1"
                        title="Быстро добавить готовый шаблон: Кости плута, Пси-заряды мистика, Кости превосходства, Ци, Магус..."
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Шаблоны LSS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (resFormOpen && !editingResId) {
                            setResFormOpen(false);
                          } else {
                            openResourceEditor();
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/35 text-[11px] font-bold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Свой ресурс</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Preset Gallery (Rogue Dice, Mystic Psi Charges, Classic & Homebrew) */}
                {resPresetsOpen && canEdit && (
                  <div className="p-3 bg-surface/95 border-b border-border space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-anime font-bold text-[11px]  text-cyan-300">
                        Выберите готовый шаблон уникального ресурса (авторасчёт под {sheet.level} ур.):
                      </span>
                      <button
                        type="button"
                        onClick={() => setResPresetsOpen(false)}
                        className="text-muted hover:text-text"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                      {LSS_RESOURCE_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => handleApplyResourcePreset(preset)}
                          className="p-2 bg-bg/80 hover:bg-primary/15 border border-border hover:border-primary/50 text-left flex items-start gap-2 transition-colors"
                        >
                          <HudIcon asset={preset.glyph} size="sm" className="mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-text truncate">
                              {preset.title}
                            </div>
                            <div className="text-[11px] text-muted leading-snug">
                              {preset.subtitle}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom / Edit LSS Unique Resource Form */}
                {resFormOpen && canEdit && (
                  <form
                    onSubmit={handleSaveResource}
                    className="p-3 bg-surface/95 border-b border-border space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-anime font-bold text-xs text-amber-300">
                        {editingResId
                          ? 'Настройка уникального ресурса'
                          : 'Новый уникальный ресурс / пул костей'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setResFormOpen(false);
                          setEditingResId(null);
                        }}
                        className="text-muted hover:text-text"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <select
                        value={glyphToHudAssetKey(rGlyph)}
                        onChange={(e) => setRGlyph(e.target.value)}
                        title="Иконка ресурса"
                        className="anime-input sm:col-span-2 py-1.5 px-2 text-xs"
                      >
                        <option value="bolt">Импульс</option>
                        <option value="dice">Кубик d20</option>
                        <option value="orb">Пси-сфера</option>
                        <option value="blades">Клинки</option>
                        <option value="spark">Искра</option>
                        <option value="flame">Пламя</option>
                        <option value="shield">Эгида</option>
                        <option value="skull">Череп</option>
                        <option value="dragon">Дракон</option>
                      </select>
                      <input
                        required
                        value={rName}
                        onChange={(e) => setRName(e.target.value)}
                        placeholder="Название (напр. Кости Скрытой атаки / Пси-заряды)"
                        className="anime-input sm:col-span-6 py-1.5 px-2.5 text-xs"
                      />
                      <select
                        value={rColor}
                        onChange={(e) => setRColor(e.target.value as ResourceColorKey)}
                        className="anime-input sm:col-span-4 py-1.5 px-2 text-xs"
                      >
                        <option value="amber">Золотой / Янтарь</option>
                        <option value="cyan">Пси-голубой</option>
                        <option value="violet">Мистический фиолетовый</option>
                        <option value="crimson">Кроваво-алый</option>
                        <option value="emerald">Алхимический изумруд</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] text-muted mb-0.5">Макс. зарядов</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={rMax}
                          onChange={(e) => setRMax(Math.max(1, Number(e.target.value) || 1))}
                          className="anime-input w-full py-1 px-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted mb-0.5">
                          Авто-формула макс.
                        </label>
                        <input
                          value={rMaxExpr}
                          onChange={(e) => setRMaxExpr(e.target.value)}
                          placeholder="2*[PROF] / [LVL]"
                          className="anime-input w-full py-1 px-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted mb-0.5">
                          Кость ресурса (опц.)
                        </label>
                        <input
                          value={rDie}
                          onChange={(e) => setRDie(e.target.value)}
                          placeholder="1к6 / 3к6 / 1к8"
                          className="anime-input w-full py-1 px-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-muted mb-0.5">
                          Лимит за раз (Пси)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={rSpendLimit}
                          onChange={(e) => setRSpendLimit(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0 = нет"
                          className="anime-input w-full py-1 px-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={rRest}
                        onChange={(e) => setRRest(e.target.value as 'none' | 'short' | 'long')}
                        className="anime-input py-1.5 px-2 text-xs"
                      >
                        <option value="short">Восст.: Короткий отдых</option>
                        <option value="long">Восст.: Длинный отдых</option>
                        <option value="none">Восст.: Вручную</option>
                      </select>

                      <select
                        value={rRecoverMode}
                        onChange={(e) => setRRecoverMode(e.target.value as ResourceRecoverMode)}
                        disabled={rRest === 'none'}
                        className="anime-input py-1.5 px-2 text-xs"
                      >
                        <option value="all">Восстанавливать все</option>
                        <option value="half_up">Половину (округл. вверх ½↑)</option>
                        <option value="half_down">Половину (округл. вниз ½↓)</option>
                        <option value="one">+1 заряд за отдых</option>
                      </select>

                      <input
                        value={rNotes}
                        onChange={(e) => setRNotes(e.target.value)}
                        placeholder="Краткая памятка / правило..."
                        className="anime-input py-1.5 px-2 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResFormOpen(false);
                          setEditingResId(null);
                        }}
                        className="px-3 py-1 rounded-lg border border-border text-muted"
                      >
                        Отмена
                      </button>
                      <button type="submit" className="anime-btn-primary px-4 py-1 text-xs">
                        {editingResId ? 'Сохранить изменения' : 'Добавить ресурс'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="p-2.5">
                  {sheet.resources.length === 0 ? (
                    <div className="text-[11px] text-muted text-center py-2.5">
                      Нет уникальных ресурсов. Нажмите «Шаблоны LSS», чтобы в 1 клик добавить Кости
                      плута, Пси-заряды мистика, Кости воина, Ци и др.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {sheet.resources.map((r) => {
                        const style = RESOURCE_COLOR_STYLES[r.color] ?? RESOURCE_COLOR_STYLES.amber;
                        const pct = Math.min(
                          100,
                          Math.max(0, Math.round((r.current / Math.max(1, r.max)) * 100))
                        );
                        const psiQuickSteps =
                          r.spendLimit > 0
                            ? [1, 2, 3, 5, 6, 7].filter((n) => n <= r.spendLimit)
                            : [];

                        return (
                          <div
                            key={r.id}
                            className="p-3  bg-surface/80 border border-border space-y-2 flex flex-col justify-between"
                          >
                            {/* Top Row: Title + Meta + Counter + Edit/Delete */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <HudIcon asset={r.glyph} size="xs" />
                                  <span className="text-xs font-semibold text-text truncate">
                                    {r.name}
                                  </span>
                                  {r.spendLimit > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-bold text-cyan-200">
                                      Лимит: {r.spendLimit}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted flex items-center gap-1.5 flex-wrap mt-0.5">
                                  {r.restLabel && <span>↻ {r.restLabel}</span>}
                                  {r.maxExpr && (
                                    <span className="font-mono opacity-70">({r.maxExpr})</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleSpendResourceAmount(r, -1)}
                                    className="w-5 h-5 rounded bg-bg border border-border text-xs font-bold hover:border-primary"
                                    title="Потратить 1"
                                  >
                                    -
                                  </button>
                                )}
                                <span
                                  className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${style.badge}`}
                                >
                                  {r.current} / {r.max}
                                </span>
                                {canEdit && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSpendResourceAmount(r, 1)}
                                      className="w-5 h-5 rounded bg-bg border border-border text-xs font-bold hover:border-primary"
                                      title="Восстановить 1"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openResourceEditor(r)}
                                      className="p-0.5 text-muted hover:text-accent"
                                      title="Настроить ресурс"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        commitMutation((s) => {
                                          const ro = ensureObj(s, 'resources');
                                          delete ro[r.id];
                                        }, true)
                                      }
                                      className="p-0.5 text-muted hover:text-rose-400"
                                      title="Удалить ресурс"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Interactive LSS Pips (max <= 10) OR Psi/Energy Progress Bar (max > 10) */}
                            {r.max <= 10 ? (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {Array.from({ length: r.max }).map((_, idx) => {
                                  const filled = idx < r.current;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      disabled={!canEdit}
                                      onClick={() => {
                                        const nextCur = filled ? idx : idx + 1;
                                        commitMutation((s) => {
                                          const ro = ensureObj(s, 'resources');
                                          const t = ensureObj(ro, r.id);
                                          t.current = nextCur;
                                        }, true);
                                      }}
                                      className={`w-3.5 h-3.5 rotate-45 border transition-colors ${
                                        filled ? style.pipFilled : style.pipEmpty
                                      }`}
                                      title={`Заряд ${idx + 1} из ${r.max}`}
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="w-full h-2 rounded-full bg-bg border border-border/80 overflow-hidden">
                                  <div
                                    className={`h-full transition-colors duration-300 ${style.bar}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Mystic Psi-Limit Quick-Spend Strip & Resource Die Rollers */}
                            {(psiQuickSteps.length > 0 || r.dieResolved) && (
                              <div className="flex items-center justify-between gap-1.5 flex-wrap pt-0.5">
                                {psiQuickSteps.length > 0 && canEdit && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[11px] uppercase text-muted">Трата:</span>
                                    {psiQuickSteps.map((step) => (
                                      <button
                                        key={step}
                                        type="button"
                                        disabled={r.current < step}
                                        onClick={() => handleSpendResourceAmount(r, -step)}
                                        className="px-1.5 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-35 border border-cyan-400/40 text-[11px] font-mono font-bold text-cyan-200"
                                      >
                                        -{step}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {r.dieResolved && (
                                  <div className="flex items-center gap-1 flex-wrap ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleRollResourceDie(r, false)}
                                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold inline-flex items-center gap-1 transition-colors ${style.rollBtn}`}
                                      title="Бросить кость ресурса без траты заряда (напр. Скрытая атака)"
                                    >
                                      <Dices className="w-3 h-3" />
                                      <span>{r.dieResolved}</span>
                                    </button>
                                    {canEdit && r.max > 1 && (
                                      <button
                                        type="button"
                                        disabled={r.current <= 0}
                                        onClick={() => handleRollResourceDie(r, true)}
                                        className="px-2 py-0.5 bg-primary/20 hover:bg-primary/30 disabled:opacity-35 border border-primary/45 text-[11px] font-bold text-primary inline-flex items-center gap-1"
                                        title="Потратить 1 кость из пула и сразу бросить её в лог"
                                      >
                                        <span>-1</span>
                                        <HudIcon asset="dice" size="xs" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {r.notes && (
                              <div className="text-[11px] text-muted border-t border-border/50 pt-1">
                                <FormattedText text={r.notes} characterName={sheet.name} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* УМЕНИЯ И СПОСОБНОСТИ (Classic Graph-Paper Box) */}
              <ClassicTextBox
                title="Умения и способности"
                primaryNodes={sheet.textByKey.traits?.nodes}
                secondaryNodes={sheet.textByKey.features?.nodes}
                canEdit={canEdit}
                onEdit={() => {
                  const targetKey =
                    sheet.textByKey.traits?.nodes?.length || !sheet.textByKey.features?.nodes?.length
                      ? 'traits'
                      : 'features';
                  openBlockEditor(targetKey, 'Умения и способности');
                }}
                minHeight="min-h-[210px]"
              />

              {/* Bottom 2-Column Split: АТАКИ И ЗАКЛИНАНИЯ | ЧЕРТЫ (FEATS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ClassicTextBox
                  title="Атаки и особые приёмы"
                  primaryNodes={sheet.textByKey.attacks?.nodes}
                  canEdit={canEdit}
                  onEdit={() => openBlockEditor('attacks', 'Атаки и особые приёмы')}
                  minHeight="min-h-[150px]"
                />
                <ClassicTextBox
                  title="Черты (Feats)"
                  primaryNodes={sheet.textByKey.feats?.nodes}
                  canEdit={canEdit}
                  onEdit={() => openBlockEditor('feats', 'Черты (Feats)')}
                  minHeight="min-h-[150px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CLASSIC PAGE 2: PORTRAIT, ALLIES, GOALS, EXTRA FEATURES & JOURNAL     */}
      {/* ===================================================================== */}
      {page === 'page2' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: PORTRAIT + GOALS & QUESTS */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sheet-frame overflow-hidden">
                <div className="sheet-frame__header">
                  <span>Портрет</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setPortraitUrlDraft(sheet.avatarUrl || '');
                        setPortraitEditOpen((v) => !v);
                      }}
                      className="text-muted hover:text-accent inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {portraitEditOpen && canEdit && (
                  <div className="p-3 bg-surface/95 border-b border-border space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <label className="anime-btn-primary px-3 py-1.5 text-xs cursor-pointer inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingPortrait ? 'Загрузка...' : 'Загрузить файл'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePortraitFileUpload}
                          className="hidden"
                        />
                      </label>
                      {sheet.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            commitMutation((s) => {
                              delete s.avatar;
                            }, true);
                            setPortraitEditOpen(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 text-xs"
                        >
                          Убрать
                        </button>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitMutation((s) => {
                          s.avatar = {
                            webp: portraitUrlDraft.trim(),
                            jpeg: portraitUrlDraft.trim(),
                          };
                        }, true);
                        setPortraitEditOpen(false);
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        value={portraitUrlDraft}
                        onChange={(e) => setPortraitUrlDraft(e.target.value)}
                        placeholder="Или вставьте URL изображения..."
                        className="anime-input flex-1 py-1 px-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1 rounded-lg bg-accent/20 border border-accent/40 text-accent font-bold"
                      >
                        ОК
                      </button>
                    </form>
                  </div>
                )}

                <div className="p-3 flex items-center justify-center bg-bg/60 min-h-[300px]">
                  {sheet.avatarUrl ? (
                    <img
                      src={sheet.avatarUrl}
                      alt={sheet.name}
                      className="max-h-[420px] w-full object-contain  border border-border/70"
                    />
                  ) : (
                    <div className="text-center space-y-2 text-muted py-12">
                      <ImageIcon className="w-10 h-10 mx-auto text-primary/40" />
                      <div className="text-xs">Портрет не загружен</div>
                    </div>
                  )}
                </div>
              </div>

              <ClassicTextBox
                title="Цели и задачи"
                primaryNodes={sheet.textByKey.quests?.nodes}
                canEdit={canEdit}
                onEdit={() => openBlockEditor('quests', 'Цели и задачи')}
                minHeight="min-h-[200px]"
              />
            </div>

            {/* Right Column: ALLIES & ORGANIZATIONS + ADDITIONAL FEATURES + TREASURES */}
            <div className="lg:col-span-7 space-y-4">
              <ClassicTextBox
                title="Союзники и организации"
                primaryNodes={sheet.textByKey.allies?.nodes}
                canEdit={canEdit}
                onEdit={() => openBlockEditor('allies', 'Союзники и организации')}
                minHeight="min-h-[190px]"
              />

              <ClassicTextBox
                title="Дополнительные способности и умения"
                primaryNodes={sheet.textByKey['notes-1']?.nodes}
                secondaryNodes={
                  sheet.textByKey.traits?.nodes?.length ? sheet.textByKey.features?.nodes : undefined
                }
                canEdit={canEdit}
                onEdit={() =>
                  openBlockEditor('notes-1', 'Дополнительные способности и умения')
                }
                minHeight="min-h-[190px]"
              />

              <ClassicTextBox
                title="Сокровища и редкие диковинки"
                primaryNodes={sheet.textByKey.items?.nodes}
                canEdit={canEdit}
                onEdit={() => openBlockEditor('items', 'Сокровища и редкие диковинки')}
                minHeight="min-h-[140px]"
              />

              {extraCustomBlocks.map((b) => (
                <ClassicTextBox
                  key={b.key}
                  title={b.label}
                  primaryNodes={b.nodes}
                  canEdit={canEdit}
                  onEdit={() => openBlockEditor(b.key, b.label)}
                  minHeight="min-h-[110px]"
                />
              ))}
            </div>
          </div>

          {/* Personal Campaign Journal integrated cleanly at bottom of Page 2 */}
          <JournalEditor
            key={`journal-${profile.playerId}`}
            playerId={profile.playerId}
            journal={journal}
            readOnly={!canEdit}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* CLASSIC PAGE 3: SPELLCASTING, PHYSICAL, PREPARED SPELLS & EQUIPMENT   */}
      {/* ===================================================================== */}
      {page === 'page3' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left 8 Columns: Spellcasting Header + Physical Stats + Slots + Spells Table */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Spellcasting Ability / Mod / Save DC / Attack Bonus Box */}
              <div className="md:col-span-4 sheet-frame p-3 space-y-2.5">
                <div>
                  <select
                    disabled={!canEdit}
                    value={sheet.spellcasting.baseAbility ?? ''}
                    onChange={(e) =>
                      commitMutation((s) => {
                        const si = ensureObj(s, 'spellsInfo');
                        si.base = { code: e.target.value };
                      }, true)
                    }
                    className="anime-input w-full py-1.5 px-2 text-xs font-bold"
                  >
                    <option value="">Без базовой хар-ки</option>
                    <option value="int">Интеллект (ИНТ)</option>
                    <option value="wis">Мудрость (МДР)</option>
                    <option value="cha">Харизма (ХАР)</option>
                  </select>
                  <div className="text-[11px]  text-muted mt-0.5 px-1">
                    Характеристика заклинателя
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-border/60 text-xs">
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface/75 border border-border">
                    <span className="text-[11px] uppercase text-muted font-bold">
                      Модификатор
                    </span>
                    <span className="font-anime font-semibold text-base text-text">
                      {sheet.spellcasting.abilityMod !== null
                        ? formatSigned(sheet.spellcasting.abilityMod)
                        : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface/75 border border-border">
                    <span className="text-[11px] uppercase text-muted font-bold">
                      Сл спасброска
                    </span>
                    <span className="font-anime font-semibold text-base text-primary">
                      {sheet.spellcasting.saveDc ?? '—'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={sheet.spellcasting.attackBonus === null}
                    onClick={() =>
                      handleD20Roll(
                        'Атака заклинанием',
                        sheet.spellcasting.attackBonus ?? 0
                      )
                    }
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/40 disabled:opacity-50"
                  >
                    <span className="text-[11px] uppercase text-accent font-bold inline-flex items-center gap-1">
                      <Dices className="w-3.5 h-3.5" />
                      <span>Бонус атаки</span>
                    </span>
                    <span className="font-anime font-semibold text-base text-accent">
                      {sheet.spellcasting.attackBonus !== null
                        ? formatSigned(sheet.spellcasting.attackBonus)
                        : '—'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right 8 Columns of Top Magic Header: 4 Physical Plaques + 1–9 Spell Slots */}
              <div className="md:col-span-8 space-y-3">
                {/* SIZE | CARRYING CAPACITY | HIGH JUMP | LONG JUMP (matching image-5.png!) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="sheet-frame p-2.5 text-center">
                    <div className="text-[11px] font-semibold  text-muted">
                      Размер
                    </div>
                    {canEdit ? (
                      <select
                        value={sheet.physical.size}
                        onChange={(e) =>
                          commitMutation((s) => {
                            const info = ensureObj(s, 'info');
                            setLssField(info, 'size', e.target.value);
                          }, true)
                        }
                        className="mt-1 bg-transparent font-anime font-bold text-xs text-text text-center focus:outline-none"
                      >
                        {SIZE_OPTIONS.map((sz) => (
                          <option key={sz} value={sz} className="bg-surface text-text">
                            {sz}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 font-anime font-bold text-xs text-text">
                        {sheet.physical.size}
                      </div>
                    )}
                  </div>

                  <div className="sheet-frame p-2.5 text-center">
                    <div className="text-[11px] font-semibold  text-muted">
                      Грузоподъёмн.
                    </div>
                    <div className="mt-1 font-anime font-semibold text-xs text-text">
                      {sheet.physical.carryCapacity}
                    </div>
                  </div>

                  <div className="sheet-frame p-2.5 text-center">
                    <div className="text-[11px] font-semibold  text-muted">
                      Прыжок В.
                    </div>
                    <div className="mt-1 font-anime font-semibold text-xs text-text">
                      {sheet.physical.highJump}
                    </div>
                  </div>

                  <div className="sheet-frame p-2.5 text-center">
                    <div className="text-[11px] font-semibold  text-muted">
                      Прыжок Д.
                    </div>
                    <div className="mt-1 font-anime font-semibold text-xs text-text">
                      {sheet.physical.longJump}
                    </div>
                  </div>
                </div>

                {/* Classic 3-Column Spell Slots Matrix (1-3 | 4-6 | 7-9 + Pact) */}
                <div className="sheet-frame overflow-hidden">
                  <div className="sheet-frame__header">
                    <span>Ячейки заклинаний</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setConfigureSlotsOpen((v) => !v)}
                        className="text-[11px] text-accent hover:underline font-bold"
                      >
                        {configureSlotsOpen ? 'Готово' : 'Максимум ячеек'}
                      </button>
                    )}
                  </div>

                  {configureSlotsOpen && canEdit && (
                    <div className="p-3 bg-surface/95 border-b border-border space-y-2">
                      <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                          <div key={lvl} className="text-center">
                            <div className="text-[11px] text-muted">{lvl}-й</div>
                            <input
                              type="number"
                              min={0}
                              max={9}
                              value={sheet.spellcasting.slotsByLevel[lvl]?.total ?? 0}
                              onChange={(e) => {
                                const total = Math.max(
                                  0,
                                  Math.min(9, Number(e.target.value) || 0)
                                );
                                commitMutation((s) => {
                                  const sp = ensureObj(s, 'spells');
                                  const cur = ensureObj(sp, `slots-${lvl}`);
                                  cur.value = total;
                                  if (Number(cur.filled ?? 0) > total) cur.filled = total;
                                });
                              }}
                              className="anime-input w-full py-0.5 px-1 text-xs text-center"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/60">
                        <span className="text-muted">Ячейки Пакта:</span>
                        <select
                          value={sheet.spellcasting.pactSlots.level}
                          onChange={(e) => {
                            const nextLvl = Number(e.target.value);
                            commitMutation((s) => {
                              const pact: Record<string, unknown> = {};
                              pact[`slots-${nextLvl}`] = {
                                value: sheet.spellcasting.pactSlots.total,
                                filled: sheet.spellcasting.pactSlots.expended,
                              };
                              s.spellsPact = pact;
                            }, true);
                          }}
                          className="anime-input py-0.5 px-2 text-xs"
                        >
                          {[1, 2, 3, 4, 5].map((l) => (
                            <option key={l} value={l}>
                              {l}-й круг
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={6}
                          value={sheet.spellcasting.pactSlots.total}
                          onChange={(e) => {
                            const total = Math.max(0, Math.min(6, Number(e.target.value) || 0));
                            commitMutation((s) => {
                              const pact: Record<string, unknown> = {};
                              pact[`slots-${sheet.spellcasting.pactSlots.level}`] = {
                                value: total,
                                filled: Math.min(total, sheet.spellcasting.pactSlots.expended),
                              };
                              s.spellsPact = pact;
                            });
                          }}
                          className="anime-input w-14 py-0.5 px-1.5 text-xs text-center"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      [1, 2, 3],
                      [4, 5, 6],
                      [7, 8, 9],
                    ].map((colLevels, colIdx) => (
                      <div key={colIdx} className="space-y-1.5">
                        {colLevels.map((lvl) => {
                          const info = sheet.spellcasting.slotsByLevel[lvl] ?? {
                            total: 0,
                            expended: 0,
                          };
                          const available = Math.max(0, info.total - info.expended);
                          return (
                            <div
                              key={lvl}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-surface/60 border border-border/60"
                            >
                              <span className="font-bold text-muted w-8">{lvl}-й</span>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {info.total === 0 ? (
                                  <span className="text-[11px] text-muted/50">—</span>
                                ) : (
                                  Array.from({ length: info.total }).map((_, idx) => {
                                    const free = idx < available;
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() => {
                                          const nextAvail = free ? idx : idx + 1;
                                          const nextExp = Math.max(0, info.total - nextAvail);
                                          commitMutation((s) => {
                                            const sp = ensureObj(s, 'spells');
                                            const cur = ensureObj(sp, `slots-${lvl}`);
                                            cur.value = info.total;
                                            cur.filled = nextExp;
                                          }, true);
                                        }}
                                        className={`w-3.5 h-3.5 rotate-45 border transition-colors ${
                                          free
                                            ? 'bg-primary border-accent shadow-sm'
                                            : 'bg-bg border-border'
                                        }`}
                                      />
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {sheet.spellcasting.pactSlots.total > 0 && (
                    <div className="px-3 pb-3">
                      <div className="px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/35 flex items-center justify-between text-xs">
                        <span className="font-bold text-accent">
                          Магия Пакта ({sheet.spellcasting.pactSlots.level}-й круг)
                        </span>
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: sheet.spellcasting.pactSlots.total }).map(
                            (_, idx) => {
                              const avail =
                                sheet.spellcasting.pactSlots.total -
                                sheet.spellcasting.pactSlots.expended;
                              const free = idx < avail;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => {
                                    const nextAvail = free ? idx : idx + 1;
                                    const nextExp = Math.max(
                                      0,
                                      sheet.spellcasting.pactSlots.total - nextAvail
                                    );
                                    commitMutation((s) => {
                                      const pact = ensureObj(s, 'spellsPact');
                                      const cur = ensureObj(
                                        pact,
                                        `slots-${sheet.spellcasting.pactSlots.level}`
                                      );
                                      cur.value = sheet.spellcasting.pactSlots.total;
                                      cur.filled = nextExp;
                                    }, true);
                                  }}
                                  className={`w-3.5 h-3.5 rotate-45 border ${
                                    free
                                      ? 'bg-accent border-white'
                                      : 'bg-bg border-border'
                                  }`}
                                />
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CANTRIPS & PREPARED SPELLS TABLE (Classic Page 3 Table + dnd.su Learned Spells!) */}
            <div className="sheet-frame overflow-hidden">
              <div className="sheet-frame__header">
                <div className="flex items-center gap-2">
                  <span>Заговоры и подготовленные заклинания</span>
                  <span className="px-2 py-0.2 rounded bg-primary/20 text-primary text-[11px] font-mono">
                    Изучено: {learnedSpells.length} / {profile.maxSpells}
                  </span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setManualSpellFormOpen((v) => !v)}
                    className="px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 text-[11px] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Записать вручную</span>
                  </button>
                )}
              </div>

              {manualSpellFormOpen && canEdit && (
                <form
                  onSubmit={handleAddManualSpell}
                  className="p-3 bg-surface/95 border-b border-border space-y-2 text-xs"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <select
                      value={msLevel}
                      onChange={(e) => setMsLevel(Number(e.target.value))}
                      className="anime-input py-1 px-2 text-xs"
                    >
                      <option value={0}>Заговор (0)</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                        <option key={l} value={l}>
                          {l} уровень
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      value={msName}
                      onChange={(e) => setMsName(e.target.value)}
                      placeholder="Название заклинания"
                      className="anime-input sm:col-span-2 py-1 px-2 text-xs"
                    />
                    <input
                      value={msTime}
                      onChange={(e) => setMsTime(e.target.value)}
                      placeholder="Время (1 д.)"
                      className="anime-input py-1 px-2 text-xs"
                    />
                    <input
                      value={msRange}
                      onChange={(e) => setMsRange(e.target.value)}
                      placeholder="Дистанция"
                      className="anime-input py-1 px-2 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/50">
                    <select
                      value={msCastMode}
                      onChange={(e) => setMsCastMode(e.target.value as SpellCastMode)}
                      className="anime-input py-1 px-2 text-xs"
                    >
                      {SPELL_CAST_MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {msCastMode === 'resource' ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={msCastResourceId}
                          onChange={(e) => setMsCastResourceId(e.target.value)}
                          className="anime-input flex-1 py-1 px-2 text-xs"
                        >
                          <option value="">Привязать ресурс...</option>
                          {sheet.resources.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.current}/{r.max})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={msCastMaxUses}
                          onChange={(e) =>
                            setMsCastMaxUses(Math.max(1, Number(e.target.value) || 1))
                          }
                          title="Стоимость в зарядах"
                          className="anime-input w-14 py-1 px-1.5 text-center text-xs"
                        />
                      </div>
                    ) : SPELL_CAST_MODE_OPTIONS.find((o) => o.value === msCastMode)?.usesCounter ? (
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={msCastMaxUses}
                        onChange={(e) =>
                          setMsCastMaxUses(Math.max(1, Number(e.target.value) || 1))
                        }
                        placeholder="Кол-во раз"
                        className="anime-input py-1 px-2 text-xs"
                      />
                    ) : (
                      <div className="text-[11px] text-muted self-center px-1">
                        Без траты ячеек
                      </div>
                    )}

                    <input
                      value={msCastNote}
                      onChange={(e) => setMsCastNote(e.target.value)}
                      placeholder="Источник (напр. Расовое / Черта / Артефакт)"
                      className="anime-input py-1 px-2 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={msConc}
                          onChange={(e) => setMsConc(e.target.checked)}
                        />
                        <span>Концентрация (К)</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={msRitual}
                          onChange={(e) => setMsRitual(e.target.checked)}
                        />
                        <span>Ритуал (Р)</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={msMat}
                          onChange={(e) => setMsMat(e.target.checked)}
                        />
                        <span>Материальный (М)</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                      <input
                        value={msNotes}
                        onChange={(e) => setMsNotes(e.target.value)}
                        placeholder="Заметки / урон..."
                        className="anime-input flex-1 py-1 px-2 text-xs"
                      />
                      <button type="submit" className="anime-btn-primary px-3 py-1 text-xs">
                        Добавить
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="p-3 overflow-x-auto">
                {learnedSpells.length === 0 && sheet.spellcasting.manualSpells.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted space-y-2">
                    <div>
                      Изученных заклинаний пока нет. Откройте вкладку «Заклинания», чтобы изучить
                      заклинания из справочника dnd.su, или добавьте строку вручную.
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-[11px]  text-muted border-b border-border/80">
                        <th className="text-left py-1.5 px-1.5 w-10">Ур.</th>
                        <th className="text-left py-1.5 px-1.5">Название</th>
                        <th className="text-left py-1.5 px-1.5">Применение / Заряды</th>
                        <th className="text-left py-1.5 px-1.5">Время / Дист.</th>
                        <th className="text-center py-1.5 px-1.5">К•Р•М</th>
                        <th className="text-left py-1.5 px-1.5">Школа / Заметки</th>
                        <th className="w-20 text-right py-1.5 px-1.5">Действ.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {/* Learned Spells from dnd.su */}
                      {[...learnedSpells]
                        .sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name, 'ru'))
                        .map((rec) => {
                          const sp = rec.spell;
                          const hasMat = Boolean(sp.components?.includes('М'));
                          const cfgKey = `cat-${sp.id}`;
                          const eff = resolveEffectiveSpellCast({
                            configKey: cfgKey,
                            spellLevel: sp.level,
                            defaultMode: rec.castMode,
                            defaultMaxUses: rec.castMaxUses,
                            defaultNote: rec.castNote,
                          });
                          const linkedRes =
                            eff.mode === 'resource'
                              ? sheet.resources.find((r) => r.id === eff.resourceId)
                              : undefined;
                          const badge = formatSpellCastBadge(
                            eff.mode,
                            sp.level,
                            eff.maxUses,
                            linkedRes ? `${linkedRes.name}` : eff.note
                          );
                          const usesPips =
                            eff.mode === 'long_rest' ||
                            eff.mode === 'short_rest' ||
                            eff.mode === 'custom';
                          const remainingUses = Math.max(0, eff.maxUses - eff.used);

                          return (
                            <tr key={cfgKey} className="hover:bg-surface/60">
                              <td className="py-1.5 px-1.5 font-mono font-bold text-primary">
                                {sp.level === 0 ? 'Заг.' : sp.level}
                              </td>
                              <td className="py-1.5 px-1.5 font-semibold text-text">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => jumpToSpellInCatalog(sp.id)}
                                    className="hover:text-accent text-left inline-flex items-center gap-1"
                                    title="Открыть полное описание заклинания в справочнике"
                                  >
                                    <span>{sp.name}</span>
                                    <ExternalLink className="w-3 h-3 text-accent shrink-0" />
                                  </button>
                                  {rec.grantedByDm && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
                                      DM
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold ${badge.className}`}
                                  >
                                    {badge.text}
                                  </span>
                                  {usesPips && eff.maxUses <= 6 && (
                                    <div className="inline-flex items-center gap-1">
                                      {Array.from({ length: eff.maxUses }).map((_, idx) => {
                                        const free = idx < remainingUses;
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            disabled={!canEdit}
                                            onClick={() => {
                                              const nextRem = free ? idx : idx + 1;
                                              const nextUsed = Math.max(
                                                0,
                                                eff.maxUses - nextRem
                                              );
                                              commitMutation((s) => {
                                                const cfgObj = ensureObj(s, 'spellCastConfigs');
                                                cfgObj[cfgKey] = {
                                                  mode: eff.mode,
                                                  maxUses: eff.maxUses,
                                                  used: nextUsed,
                                                  resourceId: eff.resourceId,
                                                  note: eff.note,
                                                };
                                              }, true);
                                            }}
                                            className={`w-3 h-3 rotate-45 border transition-colors ${
                                              free
                                                ? 'bg-emerald-400 border-emerald-100'
                                                : 'bg-bg border-border'
                                            }`}
                                          />
                                        );
                                      })}
                                    </div>
                                  )}
                                  {usesPips && eff.maxUses > 6 && (
                                    <span className="font-mono text-[11px] text-emerald-300">
                                      {remainingUses}/{eff.maxUses}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-1.5 text-[11px] text-muted">
                                <div>{sp.castingTime}</div>
                                <div className="text-[11px] opacity-75">{sp.spellRange}</div>
                              </td>
                              <td className="py-1.5 px-1.5 text-center font-mono text-[11px]">
                                <span
                                  className={
                                    sp.concentration ? 'text-amber-300 font-bold' : 'text-muted/35'
                                  }
                                >
                                  {sp.concentration ? '◆К' : '◇К'}
                                </span>{' '}
                                <span
                                  className={
                                    sp.ritual ? 'text-cyan-300 font-bold' : 'text-muted/35'
                                  }
                                >
                                  {sp.ritual ? '◆Р' : '◇Р'}
                                </span>{' '}
                                <span
                                  className={hasMat ? 'text-primary font-bold' : 'text-muted/35'}
                                >
                                  {hasMat ? '◆М' : '◇М'}
                                </span>
                              </td>
                              <td className="py-1.5 px-1.5 text-[11px] text-muted">
                                <div>{MAGIC_SCHOOL_LABELS_RU[sp.school] || sp.school}</div>
                                {eff.note && (
                                  <div className="text-[11px] text-accent truncate max-w-[160px]">
                                    {eff.note}
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 px-1 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCastSpellRow({
                                      configKey: cfgKey,
                                      spellName: sp.name,
                                      spellLevel: sp.level,
                                      ...eff,
                                    })
                                  }
                                  className="px-2 py-0.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-[11px] font-bold text-primary mr-1 inline-flex items-center gap-1"
                                  title="Применить заклинание (с учётом ячеек / зарядов отдыха / ресурса / ∞)"
                                >
                                  <HudIcon asset="spark" size="xs" />
                                  <span>Каст</span>
                                </button>
                                {canEdit && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSpellCast({
                                          configKey: cfgKey,
                                          catalogSpellId: sp.id,
                                          manualSpellId: null,
                                          spellName: sp.name,
                                          spellLevel: sp.level,
                                          ...eff,
                                        })
                                      }
                                      className="p-1 text-muted hover:text-accent"
                                      title="Изменить способ применения (1/дл. отдых, за ресурс, неограниченно...)"
                                    >
                                      <Settings2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleUnlearnCatalogSpell(sp.id, sp.name)}
                                      className="p-1 text-muted hover:text-rose-400"
                                      title="Убрать заклинание"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                      {/* Manual Spell Rows */}
                      {sheet.spellcasting.manualSpells.map((ms) => {
                        const eff = resolveEffectiveSpellCast({
                          configKey: ms.id,
                          spellLevel: ms.level,
                          defaultMode: ms.castMode,
                          defaultMaxUses: ms.castMaxUses,
                          defaultResourceId: ms.castResourceId,
                          defaultNote: ms.castNote,
                        });
                        const linkedRes =
                          eff.mode === 'resource'
                            ? sheet.resources.find((r) => r.id === eff.resourceId)
                            : undefined;
                        const badge = formatSpellCastBadge(
                          eff.mode,
                          ms.level,
                          eff.maxUses,
                          linkedRes ? linkedRes.name : eff.note
                        );
                        const usesPips =
                          eff.mode === 'long_rest' ||
                          eff.mode === 'short_rest' ||
                          eff.mode === 'custom';
                        const remainingUses = Math.max(0, eff.maxUses - eff.used);

                        return (
                          <tr key={ms.id} className="hover:bg-surface/60">
                            <td className="py-1.5 px-1.5 font-mono font-bold text-accent">
                              {ms.level === 0 ? 'Заг.' : ms.level}
                            </td>
                            <td className="py-1.5 px-1.5 font-semibold text-text">{ms.name}</td>
                            <td className="py-1.5 px-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold ${badge.className}`}
                                >
                                  {badge.text}
                                </span>
                                {usesPips && eff.maxUses <= 6 && (
                                  <div className="inline-flex items-center gap-1">
                                    {Array.from({ length: eff.maxUses }).map((_, idx) => {
                                      const free = idx < remainingUses;
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          disabled={!canEdit}
                                          onClick={() => {
                                            const nextRem = free ? idx : idx + 1;
                                            const nextUsed = Math.max(
                                              0,
                                              eff.maxUses - nextRem
                                            );
                                            commitMutation((s) => {
                                              const cfgObj = ensureObj(s, 'spellCastConfigs');
                                              cfgObj[ms.id] = {
                                                mode: eff.mode,
                                                maxUses: eff.maxUses,
                                                used: nextUsed,
                                                resourceId: eff.resourceId,
                                                note: eff.note,
                                              };
                                            }, true);
                                          }}
                                          className={`w-3 h-3 rotate-45 border transition-colors ${
                                            free
                                              ? 'bg-emerald-400 border-emerald-100'
                                              : 'bg-bg border-border'
                                          }`}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-1.5 text-[11px] text-muted">
                              <div>{ms.castingTime}</div>
                              <div className="text-[11px] opacity-75">{ms.range}</div>
                            </td>
                            <td className="py-1.5 px-1.5 text-center font-mono text-[11px]">
                              <span className={ms.concentration ? 'text-amber-300 font-bold' : 'text-muted/35'}>
                                {ms.concentration ? '◆К' : '◇К'}
                              </span>{' '}
                              <span className={ms.ritual ? 'text-cyan-300 font-bold' : 'text-muted/35'}>
                                {ms.ritual ? '◆Р' : '◇Р'}
                              </span>{' '}
                              <span className={ms.material ? 'text-primary font-bold' : 'text-muted/35'}>
                                {ms.material ? '◆М' : '◇М'}
                              </span>
                            </td>
                            <td className="py-1.5 px-1.5 text-[11px] text-muted">
                              <FormattedText text={ms.notes} characterName={sheet.name} />
                              {eff.note && (
                                <div className="text-[11px] text-accent">{eff.note}</div>
                              )}
                            </td>
                            <td className="py-1.5 px-1 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCastSpellRow({
                                    configKey: ms.id,
                                    spellName: ms.name,
                                    spellLevel: ms.level,
                                    ...eff,
                                  })
                                }
                                className="px-2 py-0.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-[11px] font-bold text-primary mr-1 inline-flex items-center gap-1"
                              >
                                <HudIcon asset="spark" size="xs" />
                                <span>Каст</span>
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingSpellCast({
                                        configKey: ms.id,
                                        catalogSpellId: null,
                                        manualSpellId: ms.id,
                                        spellName: ms.name,
                                        spellLevel: ms.level,
                                        ...eff,
                                      })
                                    }
                                    className="p-1 text-muted hover:text-accent"
                                    title="Изменить способ применения"
                                  >
                                    <Settings2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      commitMutation((s) => {
                                        const list = Array.isArray(s.manualSpells)
                                          ? s.manualSpells
                                          : [];
                                        s.manualSpells = list.filter(
                                          (it) =>
                                            it &&
                                            typeof it === 'object' &&
                                            (it as Record<string, unknown>).id !== ms.id
                                        );
                                      }, true)
                                    }
                                    className="p-1 text-muted hover:text-rose-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right 4 Columns: APPEARANCE | BACKSTORY & PERSONALITY + ALIGNMENT | EQUIPMENT & ATTUNEMENT | COINS */}
          <div className="lg:col-span-4 space-y-4">
            {/* APPEARANCE */}
            <div className="sheet-frame overflow-hidden">
              <div className="sheet-frame__header">
                <span>Внешность</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openBlockEditor('appearance', 'Описание внешности')}
                    className="text-muted hover:text-accent"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="p-3 space-y-2.5 text-xs">
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['age', 'Возраст'],
                      ['height', 'Рост'],
                      ['weight', 'Вес'],
                      ['eyes', 'Глаза'],
                      ['skin', 'Кожа'],
                      ['hair', 'Волосы'],
                    ] as const
                  ).map(([k, lbl]) => (
                    <div key={k} className="p-1.5 rounded-lg bg-surface/65 border border-border/70">
                      <div className="text-[11px] uppercase text-muted">{lbl}</div>
                      {canEdit ? (
                        <input
                          value={sheet.subInfoMap[k] ?? ''}
                          onChange={(e) =>
                            commitMutation((s) => {
                              const sub = ensureObj(s, 'subInfo');
                              setLssField(sub, k, e.target.value);
                            })
                          }
                          placeholder="—"
                          className="w-full bg-transparent text-xs font-semibold text-text focus:outline-none"
                        />
                      ) : (
                        <div className="text-xs font-semibold text-text truncate">
                          {sheet.subInfoMap[k] || '—'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {sheet.textByKey.appearance?.plainText && (
                  <div className="sheet-grid-paper rounded-lg p-2.5 text-xs text-text/90">
                    <FormattedText
                      text={sheet.textByKey.appearance.plainText}
                      characterName={sheet.name}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* BACKSTORY & PERSONALITY + ALIGNMENT */}
            <div className="sheet-frame overflow-hidden">
              <div className="sheet-frame__header">
                <span>Предыстория и личные качества</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      openBlockEditor('background', 'Предыстория и личные качества')
                    }
                    className="text-muted hover:text-accent"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="p-3 space-y-2 text-xs">
                <div className="sheet-grid-paper rounded-lg p-2.5 min-h-[120px] space-y-2">
                  {(['personality', 'ideals', 'bonds', 'flaws', 'background'] as const).map(
                    (k) => {
                      const entry = sheet.textByKey[k];
                      if (!entry?.plainText) return null;
                      return (
                        <div key={k}>
                          {k !== 'background' && (
                            <span className="text-[11px] font-bold uppercase text-accent block">
                              {entry.label}:
                            </span>
                          )}
                          <FormattedText text={entry.plainText} characterName={sheet.name} />
                        </div>
                      );
                    }
                  )}
                  {!sheet.textByKey.background?.plainText &&
                    !sheet.textByKey.personality?.plainText && (
                      <span className="text-muted/60">Запишите историю и черты характера...</span>
                    )}
                </div>

                <div className="pt-1 border-t border-border/70">
                  <div className="text-[11px]  text-muted">
                    Мировоззрение
                  </div>
                  {canEdit ? (
                    <input
                      value={sheet.alignment}
                      onChange={(e) =>
                        commitMutation((s) => {
                          const info = ensureObj(s, 'info');
                          setLssField(info, 'alignment', e.target.value);
                        })
                      }
                      placeholder="Нейтрально-добрый..."
                      className="w-full bg-transparent text-xs font-bold text-text border-b border-border/60 focus:border-primary py-0.5 focus:outline-none"
                    />
                  ) : (
                    <div className="text-xs font-bold text-text">{sheet.alignment || '—'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* EQUIPMENT + ATTUNEMENT (matching image-6.png!) */}
            <div className="sheet-frame overflow-hidden">
              <div className="sheet-frame__header">
                <span>Снаряжение</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openBlockEditor('equipment', 'Снаряжение и инвентарь')}
                    className="text-muted hover:text-accent"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="p-3 space-y-3 text-xs">
                <div className="sheet-grid-paper rounded-lg p-2.5 min-h-[140px]">
                  {sheet.textByKey.equipment?.nodes?.length ? (
                    <RichNodesView nodes={sheet.textByKey.equipment.nodes} />
                  ) : (
                    <span className="text-muted/60">Список предметов и экипировки...</span>
                  )}
                </div>

                {/* Attunement Diamonds */}
                <div className="pt-2 border-t border-border/70 space-y-2">
                  <div className="text-[11px] font-semibold  text-muted">
                    Настройка на магические предметы
                  </div>

                  {sheet.attunements.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-surface/70 border border-border"
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          commitMutation((s) => {
                            const list = Array.isArray(s.attunementsList)
                              ? [...s.attunementsList]
                              : [];
                            s.attunementsList = list.map((it, idx) => {
                              if (!it || typeof it !== 'object') return it;
                              const r = it as Record<string, unknown>;
                              const rId = typeof r.id === 'string' ? r.id : `attune-${idx}`;
                              return rId === att.id ? { ...r, checked: !att.active } : r;
                            });
                          }, true)
                        }
                        className="flex items-center gap-2 text-left min-w-0 flex-1"
                      >
                        <span className={att.active ? 'text-accent font-bold' : 'text-muted'}>
                          {att.active ? '◆' : '◇'}
                        </span>
                        <span className="truncate text-text">{att.name}</span>
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            commitMutation((s) => {
                              const list = Array.isArray(s.attunementsList)
                                ? s.attunementsList
                                : [];
                              s.attunementsList = list.filter((it, idx) => {
                                if (!it || typeof it !== 'object') return false;
                                const r = it as Record<string, unknown>;
                                const rId = typeof r.id === 'string' ? r.id : `attune-${idx}`;
                                return rId !== att.id;
                              });
                            }, true)
                          }
                          className="text-muted hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {canEdit && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newAttunement.trim()) return;
                        commitMutation((s) => {
                          const list = Array.isArray(s.attunementsList)
                            ? [...s.attunementsList]
                            : [];
                          list.push({
                            id: `att-${Date.now()}`,
                            checked: true,
                            value: newAttunement.trim(),
                          });
                          s.attunementsList = list;
                        }, true);
                        setNewAttunement('');
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        value={newAttunement}
                        onChange={(e) => setNewAttunement(e.target.value)}
                        placeholder="+ Предмет настройки..."
                        className="anime-input flex-1 py-1 px-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-accent text-xs font-bold"
                      >
                        +
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* COINS BOX (ММ | СМ | ЗМ | ЭМ | ПМ + «Управлять», matching image-6.png!) */}
            <div className="sheet-frame overflow-hidden">
              <div className="sheet-frame__header">
                <span className="inline-flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Монеты</span>
                </span>
              </div>

              <div className="p-3 space-y-2.5">
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {(
                    [
                      { key: 'cp', label: 'ММ', color: 'text-orange-300' },
                      { key: 'sp', label: 'СМ', color: 'text-slate-200' },
                      { key: 'gp', label: 'ЗМ', color: 'text-amber-300' },
                      { key: 'ep', label: 'ЭМ', color: 'text-indigo-300' },
                      { key: 'pp', label: 'ПМ', color: 'text-cyan-300' },
                    ] as const
                  ).map(({ key, label, color }) => (
                    <div
                      key={key}
                      className="p-2  bg-surface/80 border border-border"
                    >
                      <div className={`text-[11px] font-semibold ${color}`}>{label}</div>
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          value={sheet.coins[key]}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            commitMutation((s) => {
                              const cObj = ensureObj(s, 'coins');
                              setLssField(cObj, key, val);
                            });
                          }}
                          className="w-full bg-transparent text-center font-anime font-semibold text-sm mt-0.5 focus:outline-none"
                        />
                      ) : (
                        <div className="font-anime font-semibold text-sm mt-0.5">
                          {sheet.coins[key]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCoinManageOpen((v) => !v)}
                      className="w-full py-1.5  bg-primary/15 hover:bg-primary/25 border border-primary/40 text-xs font-bold text-primary transition-colors"
                    >
                      Управлять
                    </button>

                    {coinManageOpen && (
                      <div className="p-2.5  bg-surface border border-border flex items-center gap-1.5 text-xs">
                        <input
                          type="number"
                          min={1}
                          value={coinDelta}
                          onChange={(e) => setCoinDelta(e.target.value)}
                          placeholder="Сумма"
                          className="anime-input w-20 py-1 px-2 text-xs text-center"
                        />
                        <select
                          value={coinType}
                          onChange={(e) =>
                            setCoinType(e.target.value as 'gp' | 'sp' | 'cp' | 'ep' | 'pp')
                          }
                          className="anime-input py-1 px-2 text-xs"
                        >
                          <option value="gp">ЗМ</option>
                          <option value="sp">СМ</option>
                          <option value="cp">ММ</option>
                          <option value="ep">ЭМ</option>
                          <option value="pp">ПМ</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const n = Math.abs(Number(coinDelta));
                            if (!n) return;
                            commitMutation((s) => {
                              const curCoin = liveSheetRef.current?.coins[coinType] ?? sheet.coins[coinType];
                              const cObj = ensureObj(s, 'coins');
                              setLssField(cObj, coinType, curCoin + n);
                            }, true);
                            setCoinDelta('');
                          }}
                          className="flex-1 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const n = Math.abs(Number(coinDelta));
                            if (!n) return;
                            commitMutation((s) => {
                              const curCoin = liveSheetRef.current?.coins[coinType] ?? sheet.coins[coinType];
                              const cObj = ensureObj(s, 'coins');
                              setLssField(
                                cObj,
                                coinType,
                                Math.max(0, curCoin - n)
                              );
                            }, true);
                            setCoinDelta('');
                          }}
                          className="flex-1 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold"
                        >
                          -
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rich Text Block Editor Modal (with SelectionFormatToolbar + Live Preview!) */}
      {editingBlock && canEdit && (
        <div
          onClick={() => {
            setEditingBlock(null);
            setRichPreviewMode(false);
          }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel neon-border hud-cut max-w-2xl w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-anime font-semibold text-base uppercase tracking-wide text-primary">
                  {editingBlock.title}
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Выделите фрагмент текста для появления панели вёрстки (жирный, курсив, списки, цвет, броски кубиков)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRichPreviewMode((v) => !v)}
                  className={`px-3 py-1  border text-xs font-semibold transition-colors ${
                    richPreviewMode
                      ? 'bg-accent/20 border-accent/50 text-accent'
                      : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {richPreviewMode ? 'Редактор' : 'Предпросмотр'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBlock(null);
                    setRichPreviewMode(false);
                  }}
                  className="p-1.5  border border-border text-muted hover:text-text"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {richPreviewMode ? (
              <div className="sheet-grid-paper hud-cut-sm p-4 min-h-[220px] max-h-[380px] overflow-y-auto border border-border">
                {editingBlock.text.trim() ? (
                  <FormattedText
                    text={editingBlock.text}
                    characterName={sheet.name}
                    className="text-xs"
                  />
                ) : (
                  <span className="text-xs text-muted">Пусто...</span>
                )}
              </div>
            ) : (
              <textarea
                rows={11}
                value={editingBlock.text}
                onChange={(e) => setEditingBlock({ ...editingBlock, text: e.target.value })}
                placeholder="Выделите текст для жирного **шрифта**, *курсива*, __подчёркивания__, заголовков ###, списков • или бросков [roll: 2к6+3]..."
                className="anime-input w-full text-xs leading-relaxed"
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingBlock(null);
                  setRichPreviewMode(false);
                }}
                className="px-4 py-2  border border-border text-xs text-muted"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  const { key, text } = editingBlock;
                  commitMutation((s) => {
                    const txt = ensureObj(s, 'text');
                    const block = ensureObj(txt, key);
                    block.value = plainTextToLssDoc(text);
                  }, true);
                  setEditingBlock(null);
                  setRichPreviewMode(false);
                }}
                className="anime-btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Сохранить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Slot / Innate / Resource-Powered / At-Will Spell Configuration Modal */}
      {editingSpellCast && canEdit && (
        <div
          onClick={() => setEditingSpellCast(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void handleSaveSpellCastConfigModal(e)}
            className="glass-panel neon-border hud-cut max-w-md w-full p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-anime font-semibold text-base text-primary">
                  Способ применения заклинания
                </h3>
                <p className="text-xs text-accent font-semibold mt-0.5">
                  «{editingSpellCast.spellName}» ({editingSpellCast.spellLevel === 0 ? 'Заговор' : `${editingSpellCast.spellLevel} ур.`})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSpellCast(null)}
                className="p-1.5  border border-border text-muted hover:text-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-muted mb-1">Как расходуется заклинание</label>
                <select
                  value={editingSpellCast.mode}
                  onChange={(e) =>
                    setEditingSpellCast({
                      ...editingSpellCast,
                      mode: e.target.value as SpellCastMode,
                    })
                  }
                  className="anime-input w-full py-2 px-3 text-xs"
                >
                  {SPELL_CAST_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {editingSpellCast.mode === 'resource' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-muted mb-1">Уникальный ресурс (LSS)</label>
                    <select
                      value={editingSpellCast.resourceId}
                      onChange={(e) =>
                        setEditingSpellCast({
                          ...editingSpellCast,
                          resourceId: e.target.value,
                        })
                      }
                      className="anime-input w-full py-1.5 px-2 text-xs"
                    >
                      <option value="">Выберите ресурс из листа...</option>
                      {sheet.resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.current}/{r.max})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted mb-1">Цена (ед.)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editingSpellCast.maxUses}
                      onChange={(e) =>
                        setEditingSpellCast({
                          ...editingSpellCast,
                          maxUses: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="anime-input w-full py-1.5 px-2 text-xs text-center"
                    />
                  </div>
                </div>
              )}

              {(editingSpellCast.mode === 'long_rest' ||
                editingSpellCast.mode === 'short_rest' ||
                editingSpellCast.mode === 'custom') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-muted mb-1">Макс. применений</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editingSpellCast.maxUses}
                      onChange={(e) => {
                        const m = Math.max(1, Number(e.target.value) || 1);
                        setEditingSpellCast({
                          ...editingSpellCast,
                          maxUses: m,
                          used: Math.min(m, editingSpellCast.used),
                        });
                      }}
                      className="anime-input w-full py-1.5 px-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted mb-1">Уже потрачено</label>
                    <input
                      type="number"
                      min={0}
                      max={editingSpellCast.maxUses}
                      value={editingSpellCast.used}
                      onChange={(e) =>
                        setEditingSpellCast({
                          ...editingSpellCast,
                          used: Math.min(
                            editingSpellCast.maxUses,
                            Math.max(0, Number(e.target.value) || 0)
                          ),
                        })
                      }
                      className="anime-input w-full py-1.5 px-2 text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-muted mb-1">
                  Источник / опция (черта, раса, мистическое воззвание, предмет)
                </label>
                <input
                  value={editingSpellCast.note}
                  onChange={(e) =>
                    setEditingSpellCast({ ...editingSpellCast, note: e.target.value })
                  }
                  placeholder="Напр.: Поцелованный феей / Тифлинг / Доспех теней (∞)..."
                  className="anime-input w-full py-1.5 px-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSpellCast(null)}
                className="px-4 py-2  border border-border text-muted"
              >
                Отмена
              </button>
              <button type="submit" className="anime-btn-primary px-5 py-2 text-xs">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hero Identity Modal (No XP input for players — XP is Master-only!) */}
      {heroModalOpen && canEdit && (
        <HeroIdentityModal
          sheet={sheet}
          onClose={() => setHeroModalOpen(false)}
          onSave={(updates) => {
            commitMutation((s) => {
              setLssField(s, 'name', updates.name);
              const info = ensureObj(s, 'info');
              setLssField(info, 'charClass', updates.charClass);
              setLssField(info, 'charSubclass', updates.subclass);
              setLssField(info, 'race', updates.race);
              setLssField(info, 'level', updates.level);
              setLssField(info, 'background', updates.background);
              setLssField(info, 'alignment', updates.alignment);
            }, true);
            setHeroModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

const RichNodesView: React.FC<{ nodes: LssRichParagraph[]; characterName?: string }> = React.memo(
  ({ nodes, characterName }) => (
    <div className="space-y-2 text-xs text-text/90 leading-relaxed">
      {nodes.map((node, idx) => {
        if (node.kind === 'divider') {
          return <hr key={idx} className="border-border/70 my-2" />;
        }
        if (node.kind === 'bullet') {
          return (
            <ul key={idx} className="list-disc pl-4 space-y-1 marker:text-primary">
              {node.items?.map((it, i) => (
                <li key={i}>
                  <FormattedText text={it} characterName={characterName} />
                </li>
              ))}
            </ul>
          );
        }
        if (node.kind === 'ordered') {
          return (
            <ol key={idx} className="list-decimal pl-4 space-y-1 marker:text-accent">
              {node.items?.map((it, i) => (
                <li key={i}>
                  <FormattedText text={it} characterName={characterName} />
                </li>
              ))}
            </ol>
          );
        }
        if (node.kind === 'spoiler') {
          return (
            <details
              key={idx}
              className=" bg-surface/80 border border-border px-3 py-2"
            >
              <summary className="cursor-pointer font-semibold text-accent">
                {node.title}
              </summary>
              <div className="mt-1.5 text-text/90">
                <FormattedText text={node.text} characterName={characterName} />
              </div>
            </details>
          );
        }
        return <FormattedText key={idx} text={node.text} characterName={characterName} />;
      })}
    </div>
  )
);

interface ClassicTextBoxProps {
  title: string;
  primaryNodes?: LssRichParagraph[];
  secondaryNodes?: LssRichParagraph[];
  canEdit: boolean;
  onEdit: () => void;
  minHeight?: string;
}

const ClassicTextBox: React.FC<ClassicTextBoxProps> = ({
  title,
  primaryNodes,
  secondaryNodes,
  canEdit,
  onEdit,
  minHeight = 'min-h-[140px]',
}) => {
  const combined = useMemo(() => {
    if (!secondaryNodes?.length) return primaryNodes ?? [];
    if (!primaryNodes?.length) return secondaryNodes;
    return [...primaryNodes, ...secondaryNodes];
  }, [primaryNodes, secondaryNodes]);
  return (
    <div className="sheet-frame overflow-hidden">
      <div className="sheet-frame__header">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span>{title}</span>
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-muted hover:text-accent transition-colors"
            title={`Редактировать «${title}»`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className={`p-3 sheet-grid-paper ${minHeight}`}>
        {combined.length === 0 ? (
          <div className="text-xs text-muted/55">Нажмите на карандаш в углу, чтобы заполнить...</div>
        ) : (
          <RichNodesView nodes={combined} />
        )}
      </div>
    </div>
  );
};

interface HeroIdentityModalProps {
  sheet: LssParsedSheet;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    charClass: string;
    subclass: string;
    race: string;
    level: number;
    background: string;
    alignment: string;
  }) => void;
}

const HeroIdentityModal: React.FC<HeroIdentityModalProps> = ({ sheet, onClose, onSave }) => {
  const [name, setName] = useState(sheet.name);
  const [charClass, setCharClass] = useState(sheet.rawCharClass || 'Fighter');
  const [subclass, setSubclass] = useState(sheet.subclass);
  const [race, setRace] = useState(sheet.race);
  const [level, setLevel] = useState(sheet.level);
  const [background, setBackground] = useState(sheet.background);
  const [alignment, setAlignment] = useState(sheet.alignment);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name: name.trim() || 'Герой',
            charClass: charClass.trim(),
            subclass: subclass.trim(),
            race: race.trim(),
            level: Math.min(20, Math.max(1, level)),
            background: background.trim(),
            alignment: alignment.trim(),
          });
        }}
        className="glass-panel neon-border hud-cut max-w-lg w-full p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-anime font-semibold text-lg">Шапка персонажа</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5  border border-border text-muted hover:text-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Имя персонажа</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Уровень (1–20)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Класс</label>
            {(() => {
              const normCls = normalizeDndClass(charClass);
              const matchedKey =
                charClass in DND_CLASS_LABELS_RU
                  ? charClass
                  : normCls && normCls in DND_CLASS_LABELS_RU && !charClass.includes('/')
                    ? normCls
                    : 'custom';
              const hbMeta = matchedKey !== 'custom' ? DND_HOMEBREW_CLASS_BY_KEY[matchedKey] : undefined;

              return (
                <>
                  <select
                    value={matchedKey}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCharClass('');
                      } else {
                        setCharClass(e.target.value);
                      }
                    }}
                    className="anime-input w-full text-xs"
                  >
                    <optgroup label="Официальные классы (D&D 5e)">
                      {Object.entries(DND_OFFICIAL_CLASS_LABELS_RU).map(([en, ru]) => (
                        <option key={en} value={en}>
                          {ru}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Homebrew классы (dnd.su — 15 классов)">
                      {DND_HOMEBREW_CLASSES_META.map((hb) => (
                        <option key={hb.key} value={hb.key}>
                          {hb.labelRu} (HB • {hb.source})
                        </option>
                      ))}
                    </optgroup>
                    <option value="custom">Свой / мультикласс...</option>
                  </select>
                  {hbMeta && (
                    <a
                      href={hbMeta.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] text-purple-300 hover:text-primary underline decoration-dotted"
                    >
                      <span>Открыть описание класса «{hbMeta.labelRu}» на dnd.su</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {matchedKey === 'custom' && (
                    <input
                      value={charClass}
                      onChange={(e) => setCharClass(e.target.value)}
                      placeholder="Например: Магус 5 / Колдун 2"
                      className="anime-input w-full text-xs mt-1.5"
                    />
                  )}
                </>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Подкласс</label>
            <input
              list="hero-subclass-suggestions"
              value={subclass}
              onChange={(e) => setSubclass(e.target.value)}
              placeholder="Орден Демиургов / Мастер боевых искусств..."
              className="anime-input w-full text-xs"
            />
            {(() => {
              const normCls = normalizeDndClass(charClass);
              const hbMeta = normCls ? DND_HOMEBREW_CLASS_BY_KEY[normCls] : undefined;
              if (!hbMeta || hbMeta.archetypes.length === 0) return null;
              return (
                <datalist id="hero-subclass-suggestions">
                  {hbMeta.archetypes.map((arch) => (
                    <option key={arch} value={arch} />
                  ))}
                </datalist>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Вид / Раса</label>
            <input
              value={race}
              onChange={(e) => setRace(e.target.value)}
              placeholder="Человек / Эльф..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Предыстория</label>
            <input
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Разорённый / Солдат..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Мировоззрение</label>
            <input
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
              placeholder="Нейтрально-добрый..."
              className="anime-input w-full text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2  border border-border text-xs text-muted"
          >
            Отмена
          </button>
          <button type="submit" className="anime-btn-primary px-5 py-2 text-xs">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
};

async function resizeImageFileToDataUrl(
  file: File,
  maxDim = 480,
  quality = 0.82
): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      el.src = bitmapUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/webp', quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
