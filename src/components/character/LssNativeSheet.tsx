import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Dices,
  Eye,
  Heart,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Upload,
  Zap,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  ABILITY_META,
  AbilityCode,
  formatSigned,
  parseFullLssSheet,
  rollD20WithModifier,
  rollDamageExpression,
} from '../../lib/lssSheetParser';
import { useCampaignStore } from '../../lib/store';
import type { CharacterProfile } from '../../lib/types';

interface LssNativeSheetProps {
  profile: CharacterProfile;
  isReadOnlyViewer: boolean;
  onQuickUploadFile: (file: File) => Promise<void>;
  onOpenImportModal: () => void;
  onSyncHealth: (hp: { hpCurrent: number; hpMax: number; hpTemp: number }) => Promise<void>;
}

type SheetSubTab = 'stats' | 'combat' | 'features';

export const LssNativeSheet: React.FC<LssNativeSheetProps> = ({
  profile,
  isReadOnlyViewer,
  onQuickUploadFile,
  onOpenImportModal,
  onSyncHealth,
}) => {
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [subTab, setSubTab] = useState<SheetSubTab>('stats');
  const [hpDeltaInput, setHpDeltaInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const sheet = useMemo(
    () => parseFullLssSheet(profile.rawLssJson),
    [profile.rawLssJson]
  );

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
        params.critKind === 'success' ? ' 💥 КРИТ!' : params.critKind === 'failure' ? ' 💀 ПРОВАЛ!' : ''
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
      // Non-fatal toast already shown
    }
  };

  const handleD20Roll = (title: string, modifier: number) => {
    const res = rollD20WithModifier(modifier);
    void sendRollToTable({ title, ...res });
  };

  const handleDamageRoll = (title: string, damageExpr: string) => {
    const res = rollDamageExpression(damageExpr);
    void sendRollToTable({
      title,
      ...res,
      isCrit: false,
      critKind: null,
    });
  };

  const adjustHp = async (delta: number) => {
    if (isReadOnlyViewer) return;
    const maxHp = profile.hpMax || sheet?.combat.hpMaxComputed || 1;
    let nextTemp = profile.hpTemp;
    let nextCur = profile.hpCurrent;

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

    await onSyncHealth({
      hpCurrent: nextCur,
      hpMax: maxHp,
      hpTemp: nextTemp,
    });
  };

  // Empty state when no `.json` file has been uploaded yet
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
        className={`p-8 sm:p-12 text-center space-y-4 transition-colors min-h-[420px] flex flex-col items-center justify-center ${
          dragOver ? 'bg-primary/15' : 'bg-bg/40'
        }`}
      >
        <div className="w-16 h-16 rounded-3xl bg-primary/15 border border-primary/35 flex items-center justify-center text-primary">
          <Upload className="w-8 h-8" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="font-anime font-extrabold text-lg">
            Интерактивный лист Long Story Short (.json)
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            Экспортируйте своего персонажа в файл <code>.json</code> в Long Story Short и перетащите его сюда (или нажмите кнопку ниже). Все характеристики, навыки, спасброски, оружие, броски к20 и умения откроются прямо на сайте без блокировок браузера!
          </p>
        </div>

        <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
          <label className="anime-btn-primary px-5 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Выбрать .json чарник</span>
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

          {!isReadOnlyViewer && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-4 py-2.5 rounded-xl bg-surface border border-border hover:border-accent text-xs font-medium text-muted hover:text-text transition-colors"
            >
              Вставить текст JSON
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveHpMax = profile.hpMax || sheet.combat.hpMaxComputed;

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Top Combat & Identity Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">КД (AC)</div>
          <div className="font-anime font-extrabold text-xl text-primary mt-0.5 flex items-center justify-center gap-1">
            <Shield className="w-4 h-4" />
            <span>{sheet.combat.ac}</span>
          </div>
          {sheet.combat.shieldEquipped && (
            <div className="text-[10px] text-accent">со щитом</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleD20Roll('Инициатива', sheet.combat.initiative)}
          className="p-3 rounded-2xl bg-bg/75 border border-border hover:border-primary/60 text-center transition-colors group"
          title="Нажмите, чтобы бросить Инициативу (1к20)"
        >
          <div className="text-[10px] uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <span>Инициатива</span>
            <Dices className="w-3 h-3 text-accent opacity-80 group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-anime font-extrabold text-xl text-text group-hover:text-primary mt-0.5">
            {formatSigned(sheet.combat.initiative)}
          </div>
        </button>

        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">Скорость</div>
          <div className="font-anime font-extrabold text-lg text-text mt-0.5">
            {sheet.combat.speed}
          </div>
          {sheet.combat.darkvision > 0 && (
            <div className="text-[10px] text-muted">Тёмн. зр. {sheet.combat.darkvision} фт.</div>
          )}
        </div>

        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">Мастерство</div>
          <div className="font-anime font-extrabold text-xl text-accent mt-0.5">
            {formatSigned(sheet.proficiencyBonus)}
          </div>
          <div className="text-[10px] text-muted">Ред. {sheet.edition}</div>
        </div>

        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">Кость хитов</div>
          <div className="font-anime font-extrabold text-lg text-text mt-0.5">
            {sheet.combat.hitDiceCurrent} × {sheet.combat.hitDie}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-bg/75 border border-border text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <Eye className="w-3 h-3 text-primary" />
            <span>Пасс. Вним.</span>
          </div>
          <div className="font-anime font-extrabold text-xl text-text mt-0.5">
            {sheet.combat.passivePerception}
          </div>
          <div className="text-[10px] text-muted">
            Прн {sheet.combat.passiveInsight} • Анл {sheet.combat.passiveInvestigation}
          </div>
        </div>
      </div>

      {/* Interactive HP Bar */}
      <div className="p-3.5 rounded-2xl bg-bg/70 border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-muted">Хиты персонажа</div>
            <div className="font-anime font-extrabold text-base">
              <span className="text-rose-300">{profile.hpCurrent}</span>
              <span className="text-muted"> / {effectiveHpMax}</span>
              {profile.hpTemp > 0 && (
                <span className="ml-1.5 text-xs text-cyan-300">(+{profile.hpTemp} врем.)</span>
              )}
            </div>
          </div>
        </div>

        {!isReadOnlyViewer && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[-5, -1, 1, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => void adjustHp(delta)}
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
                  if (n > 0) void adjustHp(-n);
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
                  if (n > 0) void adjustHp(n);
                  setHpDeltaInput('');
                }}
                className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 disabled:opacity-40"
              >
                Леч.
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sheet Internal Sub-Navigation */}
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
              label: `Оружие (${sheet.weapons.length}) и Магия`,
              icon: <Swords className="w-3.5 h-3.5" />,
            },
            {
              id: 'features',
              label: `Умения и Снаряжение (${sheet.textBlocks.length})`,
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

      {/* Sub-Tab 1: Abilities, Saves & 18 Skills */}
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

                  <button
                    type="button"
                    onClick={() => handleD20Roll(`Проверка: ${ab.fullRu}`, ab.checkBonus)}
                    className="py-1.5 rounded-xl bg-surface/80 hover:bg-primary/15 border border-border hover:border-primary/50 transition-colors text-center group"
                    title={`Бросить проверку характеристики ${ab.fullRu} (1к20${formatSigned(ab.checkBonus)})`}
                  >
                    <div className="font-anime font-extrabold text-xl text-text group-hover:text-primary">
                      {formatSigned(ab.mod)}
                    </div>
                    <div className="text-[11px] text-muted font-semibold">
                      Знач. {ab.score}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleD20Roll(`Спасбросок: ${ab.fullRu}`, ab.saveBonus)}
                    className={`px-2 py-1 rounded-xl text-[11px] font-semibold flex items-center justify-between border transition-colors ${
                      ab.saveProf
                        ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                        : 'bg-bg/60 border-border text-muted hover:text-text hover:border-primary/40'
                    }`}
                    title={`Бросить спасбросок ${ab.fullRu} (1к20${formatSigned(ab.saveBonus)})`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span>{ab.saveProf ? '●' : '○'}</span>
                      <span>Спас</span>
                    </span>
                    <span className="font-mono font-bold">{formatSigned(ab.saveBonus)}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* 18 Skills Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted px-1">
              <span className="font-semibold text-text/90">Навыки (нажмите для броска 1к20)</span>
              <span>● владение • ◆ компетентность (×2)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {sheet.skills.map((sk) => (
                <button
                  key={sk.key}
                  type="button"
                  onClick={() => handleD20Roll(`Навык: ${sk.labelRu}`, sk.total)}
                  className={`px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all group ${
                    sk.profLevel > 0
                      ? 'bg-primary/10 border-primary/35 hover:border-primary'
                      : 'bg-bg/65 border-border/80 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs w-3.5 text-center shrink-0 ${
                        sk.profLevel === 2
                          ? 'text-amber-300 font-bold'
                          : sk.profLevel === 1
                            ? 'text-accent font-bold'
                            : 'text-muted/50'
                      }`}
                    >
                      {sk.profLevel === 2 ? '◆' : sk.profLevel === 1 ? '●' : '○'}
                    </span>
                    <span className="text-xs font-medium text-text truncate group-hover:text-primary transition-colors">
                      {sk.labelRu}
                    </span>
                    <span className="text-[10px] uppercase text-muted shrink-0">
                      ({sk.statShortRu})
                    </span>
                  </div>

                  <span className="font-mono font-bold text-xs text-text group-hover:text-accent shrink-0">
                    {formatSigned(sk.total)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Weapons, Spellcasting Stats & Resources */}
      {subTab === 'combat' && (
        <div className="space-y-4">
          {/* Weapons List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-text flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-primary" />
              <span>Оружие и атаки из чарника</span>
            </div>

            {sheet.weapons.length === 0 ? (
              <div className="p-4 rounded-2xl bg-bg/50 border border-border text-xs text-muted">
                В списке оружия чарника пока нет записей.
              </div>
            ) : (
              <div className="space-y-2">
                {sheet.weapons.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-2xl bg-bg/75 border border-border flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-anime font-bold text-sm text-text flex items-center gap-2">
                        <span>{w.name}</span>
                        {w.damageType && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-normal">
                            {w.damageType}
                          </span>
                        )}
                      </div>
                      {w.notes && <div className="text-[11px] text-muted">{w.notes}</div>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleD20Roll(`Атака: ${w.name}`, w.attackBonus)}
                        className="px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-xs font-bold text-primary inline-flex items-center gap-1.5 transition-colors"
                        title="Бросить попадание (1к20)"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Попадание {formatSigned(w.attackBonus)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDamageRoll(`Урон (${w.name})`, w.damageResolved)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-bold text-rose-300 inline-flex items-center gap-1.5 transition-colors"
                        title="Бросить урон"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>{w.damageResolved}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spellcasting Block */}
          {(sheet.spellcasting.baseAbility || sheet.spellcasting.slots.length > 0) && (
            <div className="p-4 rounded-2xl bg-bg/75 border border-primary/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>Параметры заклинателя</span>
                </div>

                {sheet.spellcasting.baseAbility && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted">
                      База:{' '}
                      <strong className="text-text">
                        {ABILITY_META[sheet.spellcasting.baseAbility].fullRu}
                      </strong>
                    </span>
                    {sheet.spellcasting.saveDc !== null && (
                      <span className="px-2.5 py-1 rounded-lg bg-surface border border-border">
                        Сл спасброска: <strong className="text-primary">{sheet.spellcasting.saveDc}</strong>
                      </span>
                    )}
                    {sheet.spellcasting.attackBonus !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          handleD20Roll(
                            'Атака заклинанием',
                            sheet.spellcasting.attackBonus ?? 0
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/40 text-accent font-bold hover:bg-accent/25 transition-colors inline-flex items-center gap-1"
                      >
                        <Dices className="w-3.5 h-3.5" />
                        <span>Атака закл. {formatSigned(sheet.spellcasting.attackBonus)}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {sheet.spellcasting.slots.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {sheet.spellcasting.slots.map((sl, i) => {
                    const available = Math.max(0, sl.total - sl.expended);
                    return (
                      <div
                        key={`${sl.level}-${sl.isPact ? 'pact' : 'std'}-${i}`}
                        className="p-2.5 rounded-xl bg-surface/75 border border-border text-center"
                      >
                        <div className="text-[10px] text-muted">
                          {sl.isPact ? `Пакт (${sl.level} кр.)` : `${sl.level} круг`}
                        </div>
                        <div className="font-anime font-extrabold text-sm text-primary mt-0.5">
                          {available} / {sl.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Resources, Attunements & Armor/Weapon Proficiencies */}
          {sheet.resources.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-text flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Классовые ресурсы и заряды</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sheet.resources.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-2xl bg-bg/70 border border-border flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-text">{r.name}</div>
                      {r.restLabel && (
                        <div className="text-[10px] text-muted">Восст.: {r.restLabel}</div>
                      )}
                    </div>
                    <div className="font-anime font-extrabold text-sm text-amber-300 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      {r.current} / {r.max}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(sheet.profFlags.length > 0 || sheet.attunements.length > 0) && (
            <div className="p-3.5 rounded-2xl bg-bg/60 border border-border space-y-2 text-xs">
              {sheet.profFlags.length > 0 && (
                <div>
                  <span className="text-muted">Владения доспехами и оружием: </span>
                  <span className="text-text font-medium">{sheet.profFlags.join(', ')}</span>
                </div>
              )}
              {sheet.attunements.length > 0 && (
                <div>
                  <span className="text-muted">Настройка (Attunement): </span>
                  <span className="text-accent font-medium">
                    {sheet.attunements
                      .map((a) => `${a.name}${a.active ? ' (активно)' : ''}`)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Rich Text Blocks (Traits, Equipment, Backstory, Appearance) */}
      {subTab === 'features' && (
        <div className="space-y-3.5">
          {(sheet.background || sheet.alignment || sheet.subInfo.length > 0) && (
            <div className="p-3.5 rounded-2xl bg-bg/70 border border-border flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
              {sheet.background && (
                <div>
                  <span className="text-muted">Предыстория: </span>
                  <strong className="text-text">{sheet.background}</strong>
                </div>
              )}
              {sheet.alignment && (
                <div>
                  <span className="text-muted">Мировоззрение: </span>
                  <strong className="text-text">{sheet.alignment}</strong>
                </div>
              )}
              {sheet.experience !== null && (
                <div>
                  <span className="text-muted">Опыт: </span>
                  <strong className="text-text">{sheet.experience} XP</strong>
                </div>
              )}
              {sheet.subInfo.map((si) => (
                <div key={si.label}>
                  <span className="text-muted">{si.label}: </span>
                  <span className="text-text">{si.value}</span>
                </div>
              ))}
            </div>
          )}

          {sheet.textBlocks.length === 0 ? (
            <div className="p-6 rounded-2xl bg-bg/50 border border-border text-center text-xs text-muted">
              Текстовые блоки чарника пусты.
            </div>
          ) : (
            sheet.textBlocks.map((block) => (
              <div
                key={block.key}
                className="p-4 rounded-2xl bg-bg/70 border border-border space-y-2"
              >
                <div className="font-anime font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{block.label}</span>
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
    </div>
  );
};
