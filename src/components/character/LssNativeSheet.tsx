import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Coins,
  Dices,
  Edit3,
  Eye,
  Flame,
  Heart,
  Moon,
  Pencil,
  Plus,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sun,
  Swords,
  Trash2,
  Upload,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { DND_CLASS_LABELS_RU } from '../../lib/lss';
import {
  ABILITY_META,
  AbilityCode,
  createBlankLssStructures,
  DEFAULT_EDITABLE_TEXT_KEYS,
  DND_CONDITIONS_RU,
  ensureObj,
  formatSigned,
  LssParsedWeapon,
  mutateLssRawJson,
  packLssStructures,
  parseFullLssSheet,
  plainTextToLssDoc,
  PROF_FLAG_LABELS_RU,
  RollMode,
  rollD20WithModifier,
  rollDamageExpression,
  setLssField,
  SKILL_META,
  TEXT_BLOCK_LABELS_RU,
} from '../../lib/lssSheetParser';
import { useCampaignStore } from '../../lib/store';
import type { CharacterProfile } from '../../lib/types';

interface LssNativeSheetProps {
  profile: CharacterProfile;
  canEdit: boolean;
  onQuickUploadFile: (file: File) => Promise<void>;
  onOpenImportModal: () => void;
  onSyncJson: (lssJson: unknown) => Promise<void>;
}

type SheetSubTab = 'stats' | 'combat' | 'magic' | 'features';

const HIT_DICE_OPTIONS = ['d6', 'd8', 'd10', 'd12'] as const;

export const LssNativeSheet: React.FC<LssNativeSheetProps> = ({
  profile,
  canEdit,
  onQuickUploadFile,
  onOpenImportModal,
  onSyncJson,
}) => {
  const pushToast = useCampaignStore((s) => s.pushToast);

  // Local optimistic raw JSON so edits feel instantaneous (0ms lag)
  const [localRawJson, setLocalRawJson] = useState<string | null>(profile.rawLssJson ?? null);
  const [dirtySaving, setDirtySaving] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const latestJsonObjRef = useRef<unknown>(null);

  useEffect(() => {
    setLocalRawJson(profile.rawLssJson ?? null);
  }, [profile.playerId, profile.rawLssJson]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const sheet = useMemo(() => parseFullLssSheet(localRawJson), [localRawJson]);

  const commitMutation = (
    mutator: (sheetObj: Record<string, unknown>, rootObj: Record<string, unknown>) => void,
    immediate = false
  ) => {
    if (!canEdit) return;
    const nextPacked = mutateLssRawJson(localRawJson, mutator);
    const serialized = JSON.stringify(nextPacked);
    setLocalRawJson(serialized);
    latestJsonObjRef.current = nextPacked;
    setDirtySaving(true);

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (immediate) {
      void onSyncJson(nextPacked).finally(() => setDirtySaving(false));
    } else {
      debounceTimerRef.current = window.setTimeout(() => {
        const payload = latestJsonObjRef.current;
        if (payload) {
          void onSyncJson(payload).finally(() => setDirtySaving(false));
        }
      }, 500);
    }
  };

  // UI state
  const [subTab, setSubTab] = useState<SheetSubTab>('stats');
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [customFormula, setCustomFormula] = useState('');
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [hpDeltaInput, setHpDeltaInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Weapon form state
  const [weaponFormOpen, setWeaponFormOpen] = useState(false);
  const [editingWeaponId, setEditingWeaponId] = useState<string | null>(null);
  const [wName, setWName] = useState('');
  const [wAbility, setWAbility] = useState<AbilityCode | 'none'>('str');
  const [wIsProf, setWIsProf] = useState(true);
  const [wExtraMod, setWExtraMod] = useState('0');
  const [wDmg, setWDmg] = useState('1к8+[STR]');
  const [wDmgType, setWDmgType] = useState('рубящий');
  const [wNotes, setWNotes] = useState('');

  // Resource form state
  const [resFormOpen, setResFormOpen] = useState(false);
  const [rName, setRName] = useState('');
  const [rMax, setRMax] = useState(3);
  const [rRest, setRRest] = useState<'none' | 'short' | 'long'>('long');

  // Spell slots config state
  const [configureSlotsOpen, setConfigureSlotsOpen] = useState(false);

  // Text block inline editing state
  const [editingBlockKey, setEditingBlockKey] = useState<string | null>(null);
  const [editingBlockText, setEditingBlockText] = useState('');
  const [newSectionKey, setNewSectionKey] = useState<string>('features');

  // New Attunement input
  const [newAttunement, setNewAttunement] = useState('');

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
      title: `🎲 ${heroName}: ${params.title} — ${params.total}${
        params.critKind === 'success'
          ? ' 💥 КРИТ!'
          : params.critKind === 'failure'
            ? ' 💀 ПРОВАЛ!'
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
    const blank = packLssStructures(createBlankLssStructures('Новый герой'));
    setLocalRawJson(JSON.stringify(blank));
    setEditUnlocked(true);
    setHeroModalOpen(true);
    await onSyncJson(blank);
    pushToast({
      title: 'Создан новый лист персонажа',
      message: 'Заполните имя, класс, характеристики, навыки и снаряжение прямо на сайте.',
      variant: 'success',
    });
  };

  const adjustHp = (delta: number) => {
    if (!canEdit || !sheet) return;
    const maxHp = sheet.combat.hpMaxComputed;
    let nextTemp = sheet.combat.hpTemp;
    let nextCur = sheet.combat.hpCurrent;

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
    if (!canEdit || !sheet || sheet.combat.hitDiceCurrent <= 0) return;
    const dieFormula = sheet.combat.hitDie.replace(/^(\d*)/, '1');
    const conMod = sheet.abilities.con.mod;
    const expr =
      conMod === 0 ? dieFormula : conMod > 0 ? `${dieFormula}+${conMod}` : `${dieFormula}${conMod}`;
    const rolled = rollDamageExpression(expr);
    const healed = Math.max(1, rolled.numericTotal);
    const nextHp = Math.min(sheet.combat.hpMaxComputed, sheet.combat.hpCurrent + healed);
    const nextDice = Math.max(0, sheet.combat.hitDiceCurrent - 1);

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
      // Restore short-rest resources
      const resObj = ensureObj(s, 'resources');
      for (const val of Object.values(resObj)) {
        if (val && typeof val === 'object') {
          const rr = val as Record<string, unknown>;
          if (rr.isShortRest) {
            const parsedRes = sheet.resources.find((r) => r.id === rr.id || r.name === rr.name);
            if (parsedRes) rr.current = parsedRes.max;
          }
        }
      }
      // Restore Warlock Pact Magic slots
      const pact = ensureObj(s, 'spellsPact');
      for (let lvl = 1; lvl <= 9; lvl++) {
        const entry = pact[`slots-${lvl}`];
        if (entry && typeof entry === 'object') {
          (entry as Record<string, unknown>).filled = 0;
        }
      }
    }, true);

    pushToast({
      title: 'Короткий отдых завершён',
      message: 'Восстановлены умения короткого отдыха и ячейки Магии Пакта.',
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

      // Restore all spell slots & pact slots
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

      // Restore short & long rest resources
      const resObj = ensureObj(s, 'resources');
      for (const val of Object.values(resObj)) {
        if (val && typeof val === 'object') {
          const rr = val as Record<string, unknown>;
          if (rr.isShortRest || rr.isLongRest) {
            const parsedRes = sheet.resources.find((r) => r.id === rr.id || r.name === rr.name);
            if (parsedRes) rr.current = parsedRes.max;
          }
        }
      }
    }, true);

    pushToast({
      title: 'Длинный отдых завершён',
      message: 'Хиты, ячейки заклинаний, половина костей хитов и ресурсы полностью восстановлены!',
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
      const vit = ensureObj(s, 'vitality');
      let succ = sheet.deathSaves.success;
      let fail = sheet.deathSaves.fail;

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

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName.trim()) return;
    const id = `res-${Date.now()}`;
    commitMutation((s) => {
      const resObj = ensureObj(s, 'resources');
      resObj[id] = {
        id,
        name: rName.trim(),
        current: rMax,
        max: rMax,
        isShortRest: rRest === 'short',
        isLongRest: rRest === 'long',
      };
    }, true);
    setRName('');
    setRMax(3);
    setResFormOpen(false);
  };

  // Empty state when no character exists yet: Create from Scratch OR Import LSS `.json`
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
        className={`p-8 sm:p-12 text-center space-y-5 transition-colors min-h-[430px] flex flex-col items-center justify-center ${
          dragOver ? 'bg-primary/15' : 'bg-bg/40'
        }`}
      >
        <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/35 flex items-center justify-center text-primary shadow-neon">
          <ScrollText className="w-8 h-8" />
        </div>

        <div className="max-w-lg space-y-2">
          <h3 className="font-anime font-extrabold text-xl">
            Интерактивный лист персонажа
          </h3>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Создайте персонажа с нуля прямо здесь или загрузите готовый файл{' '}
            <code className="text-accent">.json</code> из Long Story Short. Вам доступны все
            характеристики, 18 навыков с компетентностью, спасброски, оружие, ячейки заклинаний,
            ресурсы, инвентарь и броски кубиков в общий лог стола.
          </p>
        </div>

        {canEdit ? (
          <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => void handleCreateBlankSheet()}
              className="anime-btn-primary px-5 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Создать лист с нуля</span>
            </button>

            <label className="px-4 py-2.5 rounded-xl bg-accent/15 border border-accent/45 hover:bg-accent/25 text-accent text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
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
              className="px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-primary text-xs font-medium text-muted hover:text-text transition-colors"
            >
              Вставить JSON
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted">
            В этом слоте ещё не создан персонаж. Включите режим правки выше или загрузите{' '}
            <code>.json</code> файл.
          </div>
        )}
      </div>
    );
  }

  const hpRatio = Math.min(
    100,
    Math.max(0, Math.round((sheet.combat.hpCurrent / Math.max(1, sheet.combat.hpMaxComputed)) * 100))
  );

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Row 1: Roll Mode Bar + Quick Dice + Edit Mode Switch */}
      <div className="p-2.5 rounded-2xl bg-bg/75 border border-border flex flex-wrap items-center justify-between gap-2.5">
        {/* Normal / Advantage / Disadvantage */}
        <div className="flex items-center gap-1 bg-surface/80 p-1 rounded-xl border border-border">
          {(
            [
              { id: 'normal', label: 'Обычный', color: 'anime-btn-primary' },
              {
                id: 'advantage',
                label: 'Преимущество',
                color: 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50',
              },
              {
                id: 'disadvantage',
                label: 'Помеха',
                color: 'bg-rose-500/25 text-rose-200 border border-rose-500/50',
              },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setRollMode(m.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                rollMode === m.id ? m.color : 'text-muted hover:text-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Quick Polyhedral Dice + Custom Formula */}
        <div className="flex items-center gap-1 flex-wrap">
          {([4, 6, 8, 10, 12, 20, 100] as const).map((sides) => (
            <button
              key={sides}
              type="button"
              onClick={() => {
                if (sides === 20) {
                  handleD20Roll('Бросок к20', 0);
                } else {
                  handleDamageRoll(`Бросок к${sides}`, `1к${sides}`);
                }
              }}
              className="px-2 py-1 rounded-lg bg-surface hover:bg-primary/20 border border-border hover:border-primary/50 text-[11px] font-mono font-bold text-muted hover:text-primary transition-colors"
              title={`Бросить 1к${sides}`}
            >
              к{sides}
            </button>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customFormula.trim()) return;
              handleDamageRoll(`Формула (${customFormula.trim()})`, customFormula.trim());
              setCustomFormula('');
            }}
            className="flex items-center gap-1 ml-1"
          >
            <input
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              placeholder="2к6+3"
              className="anime-input w-20 py-1 px-2 text-[11px] font-mono"
            />
            {customFormula.trim() && (
              <button
                type="submit"
                className="px-2 py-1 rounded-lg bg-accent/20 border border-accent/40 text-accent text-[11px] font-bold"
              >
                🎲
              </button>
            )}
          </form>
        </div>

        {/* Edit Mode & Hero Settings */}
        {canEdit && (
          <div className="flex items-center gap-1.5">
            {dirtySaving && (
              <span className="text-[10px] text-accent animate-pulse mr-1">Сохранение...</span>
            )}
            <button
              type="button"
              onClick={() => setHeroModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary text-[11px] font-semibold text-muted hover:text-text inline-flex items-center gap-1 transition-colors"
              title="Имя, класс, уровень, раса, предыстория"
            >
              <Pencil className="w-3 h-3 text-primary" />
              <span>Герой</span>
            </button>

            <button
              type="button"
              onClick={() => setEditUnlocked((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 border transition-all ${
                editUnlocked
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-sm'
                  : 'bg-surface border-border text-muted hover:text-text'
              }`}
              title="Включить редактирование чисел характеристик, формул КД, скорости и бонусов"
            >
              <Edit3 className="w-3 h-3" />
              <span>{editUnlocked ? 'Правка: ВКЛ' : 'Править числа'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Inspiration, Conditions, Exhaustion & Rests */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Heroic Inspiration Toggle */}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() =>
              commitMutation((s) => {
                s.inspiration = !sheet.inspiration;
              }, true)
            }
            className={`px-3 py-1.5 rounded-xl border font-bold inline-flex items-center gap-1.5 transition-all ${
              sheet.inspiration
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-bg/65 border-border text-muted hover:text-text'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${sheet.inspiration ? 'fill-amber-300 text-amber-300' : ''}`}
            />
            <span>Вдохновение</span>
          </button>

          {/* Exhaustion Stepper */}
          <div className="px-2.5 py-1 rounded-xl bg-bg/65 border border-border inline-flex items-center gap-1.5">
            <Flame
              className={`w-3.5 h-3.5 ${
                sheet.exhaustion > 0 ? 'text-orange-400' : 'text-muted'
              }`}
            />
            <span className="text-muted text-[11px]">Истощение:</span>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  commitMutation((s) => {
                    s.exhaustion = Math.max(0, sheet.exhaustion - 1);
                  }, true)
                }
                className="w-4 h-4 rounded bg-surface text-muted hover:text-text flex items-center justify-center"
              >
                -
              </button>
            )}
            <strong
              className={`text-xs ${
                sheet.exhaustion >= 3
                  ? 'text-rose-400'
                  : sheet.exhaustion > 0
                    ? 'text-amber-300'
                    : 'text-text'
              }`}
            >
              {sheet.exhaustion}
            </strong>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  commitMutation((s) => {
                    s.exhaustion = Math.min(6, sheet.exhaustion + 1);
                  }, true)
                }
                className="w-4 h-4 rounded bg-surface text-muted hover:text-text flex items-center justify-center"
              >
                +
              </button>
            )}
          </div>

          {/* Conditions Picker */}
          <button
            type="button"
            onClick={() => setConditionsOpen((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
              sheet.conditions.length > 0
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                : 'bg-bg/65 border-border text-muted hover:text-text'
            }`}
          >
            <span>
              {sheet.conditions.length > 0
                ? `Состояния: ${sheet.conditions.join(', ')}`
                : '+ Состояния'}
            </span>
          </button>
        </div>

        {/* Short & Long Rest Buttons */}
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShortRest}
              className="px-2.5 py-1.5 rounded-xl bg-bg/70 border border-border hover:border-accent text-[11px] font-semibold text-muted hover:text-accent inline-flex items-center gap-1 transition-colors"
              title="Восстановить ресурсы короткого отдыха и ячейки Пакта"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Кор. отдых</span>
            </button>
            <button
              type="button"
              onClick={handleLongRest}
              className="px-2.5 py-1.5 rounded-xl bg-primary/15 border border-primary/35 hover:bg-primary/25 text-[11px] font-semibold text-primary inline-flex items-center gap-1 transition-colors"
              title="Восстановить все хиты, ячейки заклинаний, половину костей хитов и все ресурсы"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Длин. отдых</span>
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Conditions Tray */}
      {conditionsOpen && (
        <div className="p-3 rounded-2xl bg-bg/85 border border-border flex flex-wrap gap-1.5">
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
                    s.conditions = active ? cur.filter((x) => x !== cond) : [...cur, cond];
                  }, true)
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  active
                    ? 'bg-rose-500/25 border-rose-500/50 text-rose-200'
                    : 'bg-surface border-border text-muted hover:text-text'
                }`}
              >
                {cond}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: 6 Core Combat Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        {/* AC + Shield Toggle */}
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <span>КД (AC)</span>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  commitMutation((s) => {
                    const vit = ensureObj(s, 'vitality');
                    vit.shield = {
                      value: !sheet.combat.shieldEquipped,
                      mod: sheet.combat.shieldMod || '2',
                    };
                  }, true)
                }
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                  sheet.combat.shieldEquipped
                    ? 'bg-accent/20 border-accent/50 text-accent'
                    : 'bg-surface border-border text-muted'
                }`}
                title="Надеть / снять щит (+2 КД)"
              >
                Щит
              </button>
            )}
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
              title="Формула КД (например 10+[DEX], 13+[DEX]+[CON] или число 18)"
              className="anime-input w-full py-1 px-1.5 text-xs text-center font-mono"
            />
          ) : (
            <div className="font-anime font-extrabold text-xl text-primary flex items-center justify-center gap-1">
              <Shield className="w-4 h-4" />
              <span>{sheet.combat.ac}</span>
            </div>
          )}
        </div>

        {/* Initiative */}
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted">Инициатива</div>
          {editUnlocked && canEdit ? (
            <input
              value={sheet.combat.initiativeRaw}
              onChange={(e) =>
                commitMutation((s) => {
                  const vit = ensureObj(s, 'vitality');
                  setLssField(vit, 'initiative', e.target.value);
                })
              }
              placeholder="[DEX]"
              title="Формула инициативы ([DEX], [DEX]+5 и т.д.)"
              className="anime-input w-full py-1 px-1.5 text-xs text-center font-mono"
            />
          ) : (
            <button
              type="button"
              onClick={() => handleD20Roll('Инициатива', sheet.combat.initiative)}
              className="w-full font-anime font-extrabold text-xl text-text hover:text-primary inline-flex items-center justify-center gap-1 transition-colors"
              title="Бросить Инициативу (1к20)"
            >
              <span>{formatSigned(sheet.combat.initiative)}</span>
              <Dices className="w-3.5 h-3.5 text-accent" />
            </button>
          )}
        </div>

        {/* Speed & Darkvision */}
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted">Скорость</div>
          {editUnlocked && canEdit ? (
            <div className="space-y-1">
              <input
                value={sheet.combat.speedRaw}
                onChange={(e) =>
                  commitMutation((s) => {
                    const vit = ensureObj(s, 'vitality');
                    setLssField(vit, 'speed', e.target.value);
                  })
                }
                placeholder="30"
                className="anime-input w-full py-0.5 px-1.5 text-xs text-center"
              />
              <input
                type="number"
                min={0}
                step={10}
                value={sheet.combat.darkvision}
                onChange={(e) =>
                  commitMutation((s) => {
                    const vit = ensureObj(s, 'vitality');
                    setLssField(vit, 'darkvision', Math.max(0, Number(e.target.value)));
                  })
                }
                placeholder="Тёмн. зр."
                title="Тёмное зрение в футах"
                className="anime-input w-full py-0.5 px-1.5 text-[10px] text-center"
              />
            </div>
          ) : (
            <>
              <div className="font-anime font-extrabold text-lg text-text">
                {sheet.combat.speed}
              </div>
              {sheet.combat.darkvision > 0 && (
                <div className="text-[10px] text-muted">
                  Тёмн. зр. {sheet.combat.darkvision} фт.
                </div>
              )}
            </>
          )}
        </div>

        {/* Proficiency Bonus */}
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted">Мастерство</div>
          <div className="font-anime font-extrabold text-xl text-accent">
            {formatSigned(sheet.proficiencyBonus)}
          </div>
          <div className="text-[10px] text-muted">Ур. {sheet.level}</div>
        </div>

        {/* Hit Dice */}
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted">Кость хитов</div>
          {editUnlocked && canEdit ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={sheet.level}
                value={sheet.combat.hitDiceCurrent}
                onChange={(e) =>
                  commitMutation((s) => {
                    const vit = ensureObj(s, 'vitality');
                    setLssField(vit, 'hp-dice-current', Math.max(0, Number(e.target.value)));
                  })
                }
                className="anime-input w-11 py-0.5 px-1 text-xs text-center"
              />
              <select
                value={sheet.combat.hitDie}
                onChange={(e) =>
                  commitMutation((s) => {
                    const vit = ensureObj(s, 'vitality');
                    setLssField(vit, 'hit-die', e.target.value);
                  }, true)
                }
                className="anime-input flex-1 py-0.5 px-1 text-xs"
              >
                {HIT_DICE_OPTIONS.map((hd) => (
                  <option key={hd} value={hd}>
                    {hd}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="font-anime font-extrabold text-base text-text">
                {sheet.combat.hitDiceCurrent}/{sheet.level} {sheet.combat.hitDie}
              </div>
              {canEdit && sheet.combat.hitDiceCurrent > 0 && (
                <button
                  type="button"
                  onClick={handleSpendHitDie}
                  className="text-[10px] text-emerald-300 hover:underline font-semibold"
                  title="Потратить 1 кость хитов и бросить исцеление"
                >
                  Исцелиться
                </button>
              )}
            </>
          )}
        </div>

        {/* Passive Senses */}
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <Eye className="w-3 h-3 text-primary" />
            <span>Пасс. Вним.</span>
          </div>
          <div className="font-anime font-extrabold text-xl text-text">
            {sheet.combat.passivePerception}
          </div>
          <div className="text-[10px] text-muted">
            Прн {sheet.combat.passiveInsight} • Анл {sheet.combat.passiveInvestigation}
          </div>
        </div>
      </div>

      {/* Row 4: Interactive Health Bar + Temp HP + Death Saves */}
      <div className="p-3.5 rounded-2xl bg-bg/75 border border-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
              <Heart className="w-5 h-5" />
            </div>

            {editUnlocked && canEdit ? (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <label className="text-muted">
                  Тек. ХП:
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
                    className="anime-input w-16 py-1 px-2 text-xs ml-1 text-center"
                  />
                </label>
                <label className="text-muted">
                  Макс. ХП:
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
                    className="anime-input w-16 py-1 px-2 text-xs ml-1 text-center"
                  />
                </label>
                <label className="text-cyan-300">
                  Врем. ХП:
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
                    className="anime-input w-16 py-1 px-2 text-xs ml-1 text-center"
                  />
                </label>
              </div>
            ) : (
              <div>
                <div className="text-[11px] text-muted">Хиты персонажа</div>
                <div className="font-anime font-extrabold text-lg">
                  <span
                    className={
                      sheet.combat.hpCurrent === 0 ? 'text-rose-400' : 'text-emerald-300'
                    }
                  >
                    {sheet.combat.hpCurrent}
                  </span>
                  <span className="text-muted"> / {sheet.combat.hpMaxComputed}</span>
                  {sheet.combat.hpTemp > 0 && (
                    <span className="ml-2 text-xs text-cyan-300 font-bold">
                      +{sheet.combat.hpTemp} врем.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {[-5, -1, 1, 5].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => adjustHp(delta)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    delta < 0
                      ? 'bg-rose-500/15 border-rose-500/35 text-rose-300 hover:bg-rose-500/25'
                      : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-1">
                <input
                  type="number"
                  min={1}
                  value={hpDeltaInput}
                  onChange={(e) => setHpDeltaInput(e.target.value)}
                  placeholder="Число"
                  className="anime-input w-16 py-1 px-2 text-xs text-center"
                />
                <button
                  type="button"
                  disabled={!hpDeltaInput}
                  onClick={() => {
                    const n = Math.abs(Number(hpDeltaInput));
                    if (n > 0) adjustHp(-n);
                    setHpDeltaInput('');
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[11px] font-semibold text-rose-200 disabled:opacity-40"
                >
                  Урон
                </button>
                <button
                  type="button"
                  disabled={!hpDeltaInput}
                  onClick={() => {
                    const n = Math.abs(Number(hpDeltaInput));
                    if (n > 0) adjustHp(n);
                    setHpDeltaInput('');
                  }}
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
                >
                  Леч.
                </button>
                <button
                  type="button"
                  disabled={!hpDeltaInput}
                  onClick={() => {
                    const n = Math.abs(Number(hpDeltaInput));
                    if (n > 0) {
                      commitMutation((s) => {
                        const vit = ensureObj(s, 'vitality');
                        setLssField(vit, 'hp-temp', n);
                      }, true);
                    }
                    setHpDeltaInput('');
                  }}
                  className="px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-[11px] font-semibold text-cyan-200 disabled:opacity-40"
                  title="Установить временные хиты"
                >
                  +Врем.
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Visual HP Bar */}
        <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              hpRatio <= 25
                ? 'bg-rose-500'
                : hpRatio <= 55
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            }`}
            style={{ width: `${hpRatio}%` }}
          />
        </div>

        {/* Death Saves Strip (always visible at 0 HP or when ticks > 0 or in edit mode) */}
        {(sheet.combat.hpCurrent === 0 ||
          sheet.deathSaves.success > 0 ||
          sheet.deathSaves.fail > 0 ||
          editUnlocked) && (
          <div className="pt-2 border-t border-border/70 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                <Skull className="w-4 h-4" />
                <span>Спасброски от смерти:</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-emerald-300 text-[11px]">Успехи:</span>
                {[1, 2, 3].map((i) => {
                  const filled = sheet.deathSaves.success >= i;
                  return (
                    <button
                      key={`succ-${i}`}
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
                      className={`w-4 h-4 rounded-full border transition-colors ${
                        filled
                          ? 'bg-emerald-400 border-emerald-300'
                          : 'bg-surface border-border hover:border-emerald-400'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-rose-300 text-[11px]">Провалы:</span>
                {[1, 2, 3].map((i) => {
                  const filled = sheet.deathSaves.fail >= i;
                  return (
                    <button
                      key={`fail-${i}`}
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
                      className={`w-4 h-4 rounded-full border transition-colors ${
                        filled
                          ? 'bg-rose-500 border-rose-300'
                          : 'bg-surface border-border hover:border-rose-400'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDeathSaveRoll}
              className="px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/45 text-rose-200 font-bold inline-flex items-center gap-1.5"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Бросить 1к20</span>
            </button>
          </div>
        )}
      </div>

      {/* Sheet Internal 4-Tab Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2.5 overflow-x-auto">
        {(
          [
            {
              id: 'stats',
              label: 'Характеристики и Навыки',
              icon: <Dices className="w-3.5 h-3.5" />,
            },
            {
              id: 'combat',
              label: `Оружие (${sheet.weapons.length}) и Ресурсы (${sheet.resources.length})`,
              icon: <Swords className="w-3.5 h-3.5" />,
            },
            {
              id: 'magic',
              label: 'Магия и Ячейки',
              icon: <Sparkles className="w-3.5 h-3.5" />,
            },
            {
              id: 'features',
              label: 'Инвентарь, Черты и Личность',
              icon: <ScrollText className="w-3.5 h-3.5" />,
            },
          ] as const
        ).map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-all ${
                active
                  ? 'anime-btn-primary'
                  : 'bg-bg/60 border border-border text-muted hover:text-text'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ABILITIES, SAVING THROWS, 18 SKILLS & PROFICIENCIES */}
      {subTab === 'stats' && (
        <div className="space-y-4">
          {/* 6 Ability Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {(Object.keys(ABILITY_META) as AbilityCode[]).map((code) => {
              const ab = sheet.abilities[code];
              return (
                <div
                  key={code}
                  className="p-3 rounded-2xl bg-bg/75 border border-border flex flex-col justify-between gap-2"
                >
                  <div className="text-center">
                    <div className="text-[11px] font-extrabold tracking-wider text-primary">
                      {ab.shortRu}
                    </div>
                    <div className="text-[10px] text-muted">{ab.fullRu}</div>
                  </div>

                  {/* Check Roll Button */}
                  <button
                    type="button"
                    onClick={() => handleD20Roll(`Проверка: ${ab.fullRu}`, ab.checkBonus)}
                    className="py-1.5 rounded-xl bg-surface/80 hover:bg-primary/15 border border-border hover:border-primary/50 transition-colors text-center group"
                    title={`Бросить проверку ${ab.fullRu} (1к20${formatSigned(ab.checkBonus)})`}
                  >
                    <div className="font-anime font-extrabold text-xl text-text group-hover:text-primary">
                      {formatSigned(ab.mod)}
                    </div>
                    {!editUnlocked && (
                      <div className="text-[11px] text-muted font-semibold">
                        Знач. {ab.score}
                      </div>
                    )}
                  </button>

                  {/* Inline Score Stepper when Edit Mode is ON */}
                  {editUnlocked && canEdit && (
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          commitMutation((s) => {
                            const st = ensureObj(s, 'stats');
                            const cur = ensureObj(st, code);
                            cur.name = code;
                            cur.score = Math.max(1, ab.baseScore - 1);
                          })
                        }
                        className="w-6 h-6 rounded-lg bg-surface border border-border text-xs font-bold hover:border-primary"
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
                        className="anime-input w-12 py-0.5 px-1 text-xs text-center font-bold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          commitMutation((s) => {
                            const st = ensureObj(s, 'stats');
                            const cur = ensureObj(st, code);
                            cur.name = code;
                            cur.score = Math.min(30, ab.baseScore + 1);
                          })
                        }
                        className="w-6 h-6 rounded-lg bg-surface border border-border text-xs font-bold hover:border-primary"
                      >
                        +
                      </button>
                    </div>
                  )}

                  {/* Save Proficiency Toggle + Save Roll */}
                  <div
                    className={`px-2 py-1 rounded-xl text-[11px] font-semibold flex items-center justify-between border transition-colors ${
                      ab.saveProf
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-bg/60 border-border text-muted'
                    }`}
                  >
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
                      className="hover:scale-125 transition-transform px-0.5"
                      title={
                        canEdit
                          ? 'Переключить владение спасброском'
                          : 'Владение спасброском'
                      }
                    >
                      {ab.saveProf ? '●' : '○'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleD20Roll(`Спасбросок: ${ab.fullRu}`, ab.saveBonus)}
                      className="flex-1 flex items-center justify-between pl-1 hover:text-text"
                      title={`Бросить спасбросок ${ab.fullRu}`}
                    >
                      <span>Спас</span>
                      <span className="font-mono font-bold">{formatSigned(ab.saveBonus)}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 18 Skills Grid with 1-Click Proficiency Cycle */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted px-1">
              <span className="font-semibold text-text/90">
                Навыки (нажмите на кружок слева для смены владения, на строку — для броска 1к20)
              </span>
              <span>○ нет • ● владение (+БМ) • ◆ компетентность (+2×БМ)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {sheet.skills.map((sk) => (
                <div
                  key={sk.key}
                  className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    sk.profLevel > 0
                      ? 'bg-primary/10 border-primary/35 hover:border-primary'
                      : 'bg-bg/65 border-border/80 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        commitMutation((s) => {
                          const skObj = ensureObj(s, 'skills');
                          const cur = ensureObj(skObj, sk.key);
                          cur.name = sk.key;
                          cur.baseStat = sk.stat;
                          const nextProf = ((sk.profLevel + 1) % 3) as 0 | 1 | 2;
                          cur.isProf = nextProf;
                        }, true)
                      }
                      className={`text-xs w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                        sk.profLevel === 2
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 font-bold'
                          : sk.profLevel === 1
                            ? 'bg-accent/20 border-accent/50 text-accent font-bold'
                            : 'bg-surface/70 border-border text-muted/60 hover:text-text'
                      }`}
                      title="Переключить: Нет (○) → Владение (●) → Компетентность (◆)"
                    >
                      {sk.profLevel === 2 ? '◆' : sk.profLevel === 1 ? '●' : '○'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleD20Roll(`Навык: ${sk.labelRu}`, sk.total)}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-left group"
                    >
                      <span className="text-xs font-medium text-text truncate group-hover:text-primary transition-colors">
                        {sk.labelRu}
                      </span>
                      <span className="text-[10px] uppercase text-muted shrink-0">
                        ({sk.statShortRu})
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {editUnlocked && canEdit && (
                      <input
                        type="number"
                        value={sk.extraBonus}
                        onChange={(e) =>
                          commitMutation((s) => {
                            const skObj = ensureObj(s, 'skills');
                            const cur = ensureObj(skObj, sk.key);
                            cur.bonus = Number(e.target.value) || 0;
                          })
                        }
                        title="Доп. бонус к навыку"
                        className="anime-input w-12 py-0.5 px-1 text-[11px] text-center font-mono"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleD20Roll(`Навык: ${sk.labelRu}`, sk.total)}
                      className="font-mono font-bold text-xs text-text hover:text-accent px-1"
                    >
                      {formatSigned(sk.total)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Armor & Weapon Proficiencies Interactive Chips */}
          <div className="p-3.5 rounded-2xl bg-bg/65 border border-border space-y-2">
            <div className="text-xs font-semibold text-muted">
              Владение доспехами, щитами и оружием:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PROF_FLAG_LABELS_RU).map(([flagKey, label]) => {
                const checked = sheet.profFlagKeys.includes(flagKey);
                return (
                  <button
                    key={flagKey}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      commitMutation((s) => {
                        const pr = ensureObj(s, 'prof');
                        setLssField(pr, flagKey, !checked);
                      }, true)
                    }
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-colors ${
                      checked
                        ? 'bg-primary/20 border-primary/45 text-primary'
                        : 'bg-surface/60 border-border text-muted hover:text-text'
                    }`}
                  >
                    {checked ? '✓ ' : ''}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WEAPONS, ATTACKS & CLASS RESOURCES */}
      {subTab === 'combat' && (
        <div className="space-y-5">
          {/* Weapons Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-text flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-primary" />
                <span>Оружие, заговоры и боевые атаки</span>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => openWeaponModalFor()}
                  className="anime-btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить оружие</span>
                </button>
              )}
            </div>

            {weaponFormOpen && canEdit && (
              <form
                onSubmit={handleSaveWeapon}
                className="p-4 rounded-2xl bg-surface/90 border border-primary/45 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-anime font-bold text-xs text-primary">
                    {editingWeaponId ? 'Редактирование оружия' : 'Новое оружие / атака'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWeaponFormOpen(false)}
                    className="text-muted hover:text-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Название</label>
                    <input
                      required
                      value={wName}
                      onChange={(e) => setWName(e.target.value)}
                      placeholder="Длинный меч / Рапира +1"
                      className="anime-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted mb-1">Характеристика</label>
                    <select
                      value={wAbility}
                      onChange={(e) => {
                        const val = e.target.value as AbilityCode | 'none';
                        setWAbility(val);
                        if (!editingWeaponId && val !== 'none') {
                          setWDmg(`1к8+[${val.toUpperCase()}]`);
                        }
                      }}
                      className="anime-input w-full text-xs"
                    >
                      {(Object.keys(ABILITY_META) as AbilityCode[]).map((c) => (
                        <option key={c} value={c}>
                          {ABILITY_META[c].fullRu} ({ABILITY_META[c].shortRu})
                        </option>
                      ))}
                      <option value="none">Без характеристики</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={wIsProf}
                        onChange={(e) => setWIsProf(e.target.checked)}
                      />
                      <span>Владение (+БМ)</span>
                    </label>
                    <div className="flex-1">
                      <label className="block text-[11px] text-muted mb-1">Доп. к попад.</label>
                      <input
                        value={wExtraMod}
                        onChange={(e) => setWExtraMod(e.target.value)}
                        placeholder="0 или +1"
                        className="anime-input w-full text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-muted mb-1">
                      Формула урона (поддерживает [STR], [DEX]...)
                    </label>
                    <input
                      required
                      value={wDmg}
                      onChange={(e) => setWDmg(e.target.value)}
                      placeholder="1к8+[DEX] или 2к6+3"
                      className="anime-input w-full text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Вид урона</label>
                    <input
                      value={wDmgType}
                      onChange={(e) => setWDmgType(e.target.value)}
                      placeholder="колющий / рубящий / огонь"
                      className="anime-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted mb-1">Свойства / дистанция</label>
                    <input
                      value={wNotes}
                      onChange={(e) => setWNotes(e.target.value)}
                      placeholder="Фехтовальное, универсальное (1к10)"
                      className="anime-input w-full text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWeaponFormOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted"
                  >
                    Отмена
                  </button>
                  <button type="submit" className="anime-btn-primary px-4 py-1.5 text-xs">
                    Сохранить оружие
                  </button>
                </div>
              </form>
            )}

            {sheet.weapons.length === 0 ? (
              <div className="p-4 rounded-2xl bg-bg/50 border border-border text-xs text-muted">
                Список оружия пуст. Нажмите «Добавить оружие», чтобы создать атаку с автоматическим расчётом попадания и урона.
              </div>
            ) : (
              <div className="space-y-2">
                {sheet.weapons.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-2xl bg-bg/75 border border-border flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-anime font-bold text-sm text-text flex items-center gap-2 flex-wrap">
                        <span>{w.name}</span>
                        {w.damageType && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-normal">
                            {w.damageType}
                          </span>
                        )}
                      </div>
                      {w.notes && <div className="text-[11px] text-muted">{w.notes}</div>}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleD20Roll(`Атака: ${w.name}`, w.attackBonus)}
                        className="px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-xs font-bold text-primary inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Попадание {formatSigned(w.attackBonus)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDamageRoll(`Урон (${w.name})`, w.damageResolved)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-bold text-rose-300 inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>{w.damageResolved}</span>
                      </button>

                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => openWeaponModalFor(w)}
                            className="p-1.5 rounded-xl bg-surface border border-border text-muted hover:text-primary"
                            title="Редактировать оружие"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWeapon(w.id)}
                            className="p-1.5 rounded-xl bg-surface border border-border text-muted hover:text-rose-400"
                            title="Удалить оружие"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Class Resources & Charges */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-text flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Классовые ресурсы и заряды</span>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setResFormOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-amber-500/25"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить ресурс</span>
                </button>
              )}
            </div>

            {resFormOpen && canEdit && (
              <form
                onSubmit={handleAddResource}
                className="p-3.5 rounded-2xl bg-surface/90 border border-amber-500/40 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-muted mb-1">Название ресурса</label>
                  <input
                    required
                    value={rName}
                    onChange={(e) => setRName(e.target.value)}
                    placeholder="Ярость / Очки Ци / Божественный канал"
                    className="anime-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Максимум</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={rMax}
                    onChange={(e) => setRMax(Math.max(1, Number(e.target.value)))}
                    className="anime-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted mb-1">Восстановление</label>
                  <div className="flex gap-1.5">
                    <select
                      value={rRest}
                      onChange={(e) => setRRest(e.target.value as 'none' | 'short' | 'long')}
                      className="anime-input flex-1 text-xs"
                    >
                      <option value="long">Дл. отдых</option>
                      <option value="short">Кор. отдых</option>
                      <option value="none">Вручную</option>
                    </select>
                    <button type="submit" className="anime-btn-primary px-3 py-1.5 text-xs">
                      +
                    </button>
                  </div>
                </div>
              </form>
            )}

            {sheet.resources.length === 0 ? (
              <div className="p-4 rounded-2xl bg-bg/50 border border-border text-xs text-muted">
                Нет добавленных ресурсов (например: Второе дыхание, Ярость, Вдохновение барда, Единицы чародейства).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sheet.resources.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-2xl bg-bg/75 border border-border flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-text truncate">{r.name}</div>
                      {r.restLabel && (
                        <div className="text-[10px] text-muted">Восст.: {r.restLabel}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            commitMutation((s) => {
                              const ro = ensureObj(s, 'resources');
                              const target = ensureObj(ro, r.id);
                              target.current = Math.max(0, r.current - 1);
                            }, true)
                          }
                          className="w-6 h-6 rounded-lg bg-surface border border-border text-xs font-bold hover:border-amber-400"
                        >
                          -
                        </button>
                      )}
                      <span className="font-anime font-extrabold text-sm text-amber-300 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        {r.current} / {r.max}
                      </span>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              commitMutation((s) => {
                                const ro = ensureObj(s, 'resources');
                                const target = ensureObj(ro, r.id);
                                target.current = Math.min(r.max, r.current + 1);
                              }, true)
                            }
                            className="w-6 h-6 rounded-lg bg-surface border border-border text-xs font-bold hover:border-amber-400"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              commitMutation((s) => {
                                const ro = ensureObj(s, 'resources');
                                delete ro[r.id];
                              }, true)
                            }
                            className="p-1 text-muted hover:text-rose-400"
                            title="Удалить ресурс"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SPELLCASTING & INTERACTIVE SPELL SLOTS */}
      {subTab === 'magic' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-bg/75 border border-primary/35 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="font-anime font-bold text-sm">Параметры заклинателя</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-muted flex items-center gap-1.5">
                  <span>Базовая хар-ка:</span>
                  <select
                    disabled={!canEdit}
                    value={sheet.spellcasting.baseAbility ?? ''}
                    onChange={(e) =>
                      commitMutation((s) => {
                        const si = ensureObj(s, 'spellsInfo');
                        si.base = { code: e.target.value };
                      }, true)
                    }
                    className="anime-input py-1 px-2 text-xs"
                  >
                    <option value="">Не выбрана</option>
                    <option value="int">Интеллект (ИНТ)</option>
                    <option value="wis">Мудрость (МДР)</option>
                    <option value="cha">Харизма (ХАР)</option>
                  </select>
                </label>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setConfigureSlotsOpen((v) => !v)}
                    className="px-3 py-1 rounded-xl bg-surface border border-border hover:border-primary text-xs font-semibold text-muted hover:text-text"
                  >
                    {configureSlotsOpen ? 'Скрыть настройку ячеек' : 'Настроить ячейки'}
                  </button>
                )}
              </div>
            </div>

            {sheet.spellcasting.baseAbility && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-surface/75 border border-border flex items-center justify-between">
                  <span className="text-xs text-muted">Сложность спасброска (Сл):</span>
                  <span className="font-anime font-extrabold text-lg text-primary">
                    {sheet.spellcasting.saveDc}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleD20Roll(
                      'Атака заклинанием',
                      sheet.spellcasting.attackBonus ?? 0
                    )
                  }
                  className="p-3 rounded-2xl bg-accent/15 hover:bg-accent/25 border border-accent/40 flex items-center justify-between transition-colors"
                >
                  <span className="text-xs font-semibold text-accent inline-flex items-center gap-1.5">
                    <Dices className="w-4 h-4" />
                    <span>Бросить атаку заклинанием</span>
                  </span>
                  <span className="font-anime font-extrabold text-lg text-accent">
                    {formatSigned(sheet.spellcasting.attackBonus ?? 0)}
                  </span>
                </button>
              </div>
            )}

            {/* Max Slots Configurator */}
            {configureSlotsOpen && canEdit && (
              <div className="p-3.5 rounded-2xl bg-surface/90 border border-border space-y-3">
                <div className="text-xs font-bold text-muted">
                  Максимум ячеек заклинаний по кругам (1–9):
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                    <div key={lvl} className="text-center">
                      <div className="text-[10px] text-muted mb-1">{lvl} кр.</div>
                      <input
                        type="number"
                        min={0}
                        max={9}
                        value={sheet.spellcasting.slotsByLevel[lvl]?.total ?? 0}
                        onChange={(e) => {
                          const total = Math.max(0, Math.min(9, Number(e.target.value) || 0));
                          commitMutation((s) => {
                            const sp = ensureObj(s, 'spells');
                            const cur = ensureObj(sp, `slots-${lvl}`);
                            cur.value = total;
                            if (Number(cur.filled ?? 0) > total) cur.filled = total;
                          });
                        }}
                        className="anime-input w-full py-1 px-1 text-xs text-center"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted font-semibold">Магия Пакта (Колдун):</span>
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted">Круг:</span>
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
                      className="anime-input py-1 px-2 text-xs"
                    >
                      {[1, 2, 3, 4, 5].map((l) => (
                        <option key={l} value={l}>
                          {l} круг
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-1.5">
                    <span className="text-muted">Кол-во ячеек:</span>
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
                      className="anime-input w-16 py-1 px-2 text-xs text-center"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Interactive Clickable Spell Slot Gems */}
            {sheet.spellcasting.slots.length === 0 ? (
              <div className="text-xs text-muted">
                Ячейки заклинаний не заданы. Нажмите «Настроить ячейки», чтобы указать доступные круги заклинаний.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {sheet.spellcasting.slots.map((sl, idx) => {
                  const available = Math.max(0, sl.total - sl.expended);
                  return (
                    <div
                      key={`${sl.level}-${sl.isPact ? 'pact' : 'std'}-${idx}`}
                      className="p-3 rounded-2xl bg-surface/75 border border-border space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-text">
                          {sl.isPact ? `Пакт (${sl.level} круг)` : `${sl.level} круг`}
                        </span>
                        <span className="text-primary font-mono font-bold">
                          {available}/{sl.total} своб.
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Array.from({ length: sl.total }).map((_, gemIdx) => {
                          const isAvailable = gemIdx < available;
                          return (
                            <button
                              key={gemIdx}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                const nextAvailable = isAvailable ? gemIdx : gemIdx + 1;
                                const nextExpended = Math.max(0, sl.total - nextAvailable);
                                commitMutation((s) => {
                                  const targetContainer = ensureObj(
                                    s,
                                    sl.isPact ? 'spellsPact' : 'spells'
                                  );
                                  const slotEntry = ensureObj(
                                    targetContainer,
                                    `slots-${sl.level}`
                                  );
                                  slotEntry.value = sl.total;
                                  slotEntry.filled = nextExpended;
                                }, true);
                              }}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs transition-all ${
                                isAvailable
                                  ? 'bg-primary/25 border-primary text-primary shadow-sm'
                                  : 'bg-bg/70 border-border text-muted/40'
                              }`}
                              title={
                                isAvailable
                                  ? 'Нажмите, чтобы потратить ячейку'
                                  : 'Нажмите, чтобы восстановить ячейку'
                              }
                            >
                              ✦
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: COINS, ATTUNEMENT, APPEARANCE & EDITABLE RICH TEXT BLOCKS */}
      {subTab === 'features' && (
        <div className="space-y-4">
          {/* Coins Purse */}
          <div className="p-4 rounded-2xl bg-bg/75 border border-border space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-text">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Кошелёк монет</span>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              {(
                [
                  { key: 'pp', label: 'ПМ', color: 'text-cyan-300' },
                  { key: 'gp', label: 'ЗМ', color: 'text-amber-300' },
                  { key: 'ep', label: 'ЭМ', color: 'text-indigo-300' },
                  { key: 'sp', label: 'СМ', color: 'text-slate-200' },
                  { key: 'cp', label: 'ММ', color: 'text-orange-300' },
                ] as const
              ).map(({ key, label, color }) => (
                <div key={key} className="p-2.5 rounded-2xl bg-surface/75 border border-border">
                  <div className={`text-[10px] font-bold ${color}`}>{label}</div>
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
                      className="w-full bg-transparent text-center font-anime font-extrabold text-sm mt-1 focus:outline-none border-b border-transparent focus:border-primary"
                    />
                  ) : (
                    <div className="font-anime font-extrabold text-sm mt-1">
                      {sheet.coins[key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Attunement (Настройка на магические предметы) */}
          <div className="p-4 rounded-2xl bg-bg/75 border border-border space-y-2.5">
            <div className="text-xs font-bold text-text">
              Настройка на магические предметы (Attunement)
            </div>

            {sheet.attunements.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sheet.attunements.map((att) => (
                  <div
                    key={att.id}
                    className={`px-3 py-1.5 rounded-xl border text-xs inline-flex items-center gap-2 ${
                      att.active
                        ? 'bg-accent/15 border-accent/45 text-accent font-semibold'
                        : 'bg-surface border-border text-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={att.active}
                      onChange={() =>
                        commitMutation((s) => {
                          const list = Array.isArray(s.attunementsList)
                            ? [...s.attunementsList]
                            : [];
                          s.attunementsList = list.map((item, idx) => {
                            if (!item || typeof item !== 'object') return item;
                            const r = item as Record<string, unknown>;
                            const rId = typeof r.id === 'string' ? r.id : `attune-${idx}`;
                            if (rId === att.id) {
                              return { ...r, checked: !att.active };
                            }
                            return r;
                          });
                        }, true)
                      }
                    />
                    <span>{att.name}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          commitMutation((s) => {
                            const list = Array.isArray(s.attunementsList)
                              ? s.attunementsList
                              : [];
                            s.attunementsList = list.filter((item, idx) => {
                              if (!item || typeof item !== 'object') return false;
                              const r = item as Record<string, unknown>;
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
              </div>
            )}

            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newAttunement.trim()) return;
                  commitMutation((s) => {
                    const list = Array.isArray(s.attunementsList) ? [...s.attunementsList] : [];
                    list.push({
                      id: `att-${Date.now()}`,
                      checked: true,
                      value: newAttunement.trim(),
                    });
                    s.attunementsList = list;
                  }, true);
                  setNewAttunement('');
                }}
                className="flex gap-2"
              >
                <input
                  value={newAttunement}
                  onChange={(e) => setNewAttunement(e.target.value)}
                  placeholder="Добавить предмет с настройкой (Плащ защиты, Кольцо...)"
                  className="anime-input flex-1 text-xs py-1.5"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-accent text-xs font-semibold"
                >
                  + Добавить
                </button>
              </form>
            )}
          </div>

          {/* Add Text Section Bar */}
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-bg/60 border border-border">
              <span className="text-xs text-muted">
                Разделы черт, снаряжения, личности и предыстории:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={newSectionKey}
                  onChange={(e) => setNewSectionKey(e.target.value)}
                  className="anime-input py-1 px-2.5 text-xs"
                >
                  {DEFAULT_EDITABLE_TEXT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {TEXT_BLOCK_LABELS_RU[k] || k}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const existing = sheet.textBlocks.find((b) => b.key === newSectionKey);
                    setEditingBlockKey(newSectionKey);
                    setEditingBlockText(existing ? existing.plainText : '');
                  }}
                  className="anime-btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Открыть / добавить</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Section Editor */}
          {editingBlockKey && canEdit && (
            <div className="p-4 rounded-2xl bg-surface/95 border border-primary/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-anime font-bold text-xs text-primary uppercase">
                  Редактирование: {TEXT_BLOCK_LABELS_RU[editingBlockKey] || editingBlockKey}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingBlockKey(null)}
                  className="text-muted hover:text-text"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={6}
                value={editingBlockText}
                onChange={(e) => setEditingBlockText(e.target.value)}
                placeholder="Введите умения, предметы инвентаря или заметки..."
                className="anime-input w-full text-xs leading-relaxed"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBlockKey(null)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const keyToSave = editingBlockKey;
                    const textToSave = editingBlockText;
                    commitMutation((s) => {
                      const txt = ensureObj(s, 'text');
                      const block = ensureObj(txt, keyToSave);
                      block.value = plainTextToLssDoc(textToSave);
                    }, true);
                    setEditingBlockKey(null);
                  }}
                  className="anime-btn-primary px-4 py-1.5 text-xs inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Сохранить раздел</span>
                </button>
              </div>
            </div>
          )}

          {/* Rendered Rich Text Blocks */}
          {sheet.textBlocks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-bg/50 border border-border text-center text-xs text-muted">
              Текстовые разделы пока пусты. Выберите раздел выше и нажмите «Открыть / добавить», чтобы записать черты, инвентарь или предысторию.
            </div>
          ) : (
            sheet.textBlocks.map((block) => (
              <div
                key={block.key}
                className="p-4 rounded-2xl bg-bg/70 border border-border space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-anime font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{block.label}</span>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlockKey(block.key);
                        setEditingBlockText(block.plainText);
                      }}
                      className="text-[11px] text-muted hover:text-accent inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Изменить</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-text/90 leading-relaxed">
                  {block.nodes.map((node, idx) => {
                    if (node.kind === 'divider') {
                      return <hr key={idx} className="border-border/70 my-2" />;
                    }
                    if (node.kind === 'bullet') {
                      return (
                        <ul key={idx} className="list-disc pl-5 space-y-1">
                          {node.items?.map((it, i) => (
                            <li key={i} className="whitespace-pre-line">
                              {it}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    if (node.kind === 'ordered') {
                      return (
                        <ol key={idx} className="list-decimal pl-5 space-y-1">
                          {node.items?.map((it, i) => (
                            <li key={i} className="whitespace-pre-line">
                              {it}
                            </li>
                          ))}
                        </ol>
                      );
                    }
                    if (node.kind === 'spoiler') {
                      return (
                        <details
                          key={idx}
                          className="rounded-xl bg-surface/70 border border-border px-3 py-2"
                        >
                          <summary className="cursor-pointer font-semibold text-accent">
                            {node.title}
                          </summary>
                          <div className="mt-2 whitespace-pre-line text-text/90">
                            {node.text}
                          </div>
                        </details>
                      );
                    }
                    return (
                      <p key={idx} className="whitespace-pre-line">
                        {node.text}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Hero Identity & Appearance Modal */}
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
              setLssField(info, 'experience', updates.experience);

              const sub = ensureObj(s, 'subInfo');
              for (const [k, v] of Object.entries(updates.subInfo)) {
                setLssField(sub, k, v);
              }
            }, true);
            setHeroModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

interface HeroIdentityModalProps {
  sheet: NonNullable<ReturnType<typeof parseFullLssSheet>>;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    charClass: string;
    subclass: string;
    race: string;
    level: number;
    background: string;
    alignment: string;
    experience: number;
    subInfo: Record<string, string>;
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
  const [experience, setExperience] = useState(sheet.experience ?? 0);
  const [subInfo, setSubInfo] = useState<Record<string, string>>({
    age: sheet.subInfoMap.age ?? '',
    height: sheet.subInfoMap.height ?? '',
    weight: sheet.subInfoMap.weight ?? '',
    eyes: sheet.subInfoMap.eyes ?? '',
    skin: sheet.subInfoMap.skin ?? '',
    hair: sheet.subInfoMap.hair ?? '',
  });

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
            experience: Math.max(0, experience),
            subInfo,
          });
        }}
        className="glass-panel neon-border rounded-3xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-anime font-extrabold text-lg">Основные данные персонажа</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-border text-muted hover:text-text"
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
            <label className="block text-xs text-muted mb-1">Класс D&D 5e</label>
            <select
              value={charClass in DND_CLASS_LABELS_RU ? charClass : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') setCharClass(e.target.value);
              }}
              className="anime-input w-full text-xs"
            >
              {Object.entries(DND_CLASS_LABELS_RU).map(([en, ru]) => (
                <option key={en} value={en}>
                  {ru} ({en})
                </option>
              ))}
              <option value="custom">Мультикласс / другой...</option>
            </select>
            {!(charClass in DND_CLASS_LABELS_RU) && (
              <input
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                placeholder="Например: Паладин, Колдун"
                className="anime-input w-full text-xs mt-1.5"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Подкласс / Архетип</label>
            <input
              value={subclass}
              onChange={(e) => setSubclass(e.target.value)}
              placeholder="Школа Воплощения / Клятва Мести..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Раса / Происхождение</label>
            <input
              value={race}
              onChange={(e) => setRace(e.target.value)}
              placeholder="Эльф / Тифлинг / Человек..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Предыстория</label>
            <input
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Мудрец / Благородный / Солдат..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Мировоззрение</label>
            <input
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
              placeholder="Хаотично-добрый..."
              className="anime-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Опыт (XP)</label>
            <input
              type="number"
              min={0}
              value={experience}
              onChange={(e) => setExperience(Math.max(0, Number(e.target.value) || 0))}
              className="anime-input w-full text-xs"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-xs font-semibold text-muted mb-2">Детали внешности (необязательно)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
              <div key={k}>
                <label className="block text-[10px] text-muted mb-0.5">{lbl}</label>
                <input
                  value={subInfo[k] ?? ''}
                  onChange={(e) => setSubInfo({ ...subInfo, [k]: e.target.value })}
                  className="anime-input w-full text-xs py-1.5"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs text-muted"
          >
            Отмена
          </button>
          <button type="submit" className="anime-btn-primary px-5 py-2 text-xs">
            Сохранить героя
          </button>
        </div>
      </form>
    </div>
  );
};
