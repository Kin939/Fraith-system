import React, { useEffect, useState } from 'react';
import {
  BookMarked,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { getSchoolMeta } from '../../lib/dndsuSpells';
import {
  DND_CLASS_LABELS_RU,
  DND_HOMEBREW_CLASS_BY_KEY,
  formatCharacterClassesRu,
  isSpellAllowedForCharacter,
  MAGIC_SCHOOL_LABELS_RU,
  normalizeDndClass,
} from '../../lib/lss';
import { formatSpellCastBadge, SPELL_CAST_MODE_OPTIONS } from '../../lib/spellCasting';
import { useCampaignStore } from '../../lib/store';
import type {
  CharacterProfile,
  LearnedSpellRecord,
  PlayerId,
  Spell,
  SpellCastMode,
} from '../../lib/types';
import { FormattedText } from '../common/FormattedText';

interface SpellCardProps {
  spell: Spell;
  highlighted?: boolean;
  playerProfile: CharacterProfile | null;
  isLearned: boolean;
  learnedCount: number;
  onSelectSpellId?: (spellId: number) => void;
  onClose?: () => void;
}

export const SpellCard: React.FC<SpellCardProps> = React.memo(({
  spell,
  highlighted,
  playerProfile,
  isLearned,
  learnedCount,
  onSelectSpellId,
  onClose,
}) => {
  const user = useCampaignStore((s) => s.user);
  const charactersById = useCampaignStore((s) => s.charactersById);
  const learnedSpellsById = useCampaignStore((s) => s.learnedSpellsById);
  const dmSelectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const setDmSelectedPlayerId = useCampaignStore((s) => s.setDmSelectedPlayerId);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const updateLearnedSpellsInStore = useCampaignStore((s) => s.updateLearnedSpellsInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDm = user?.role === 'dm';
  const isPlayer = user?.role === 'player' && user.playerId !== null;
  const activeTargetPid: PlayerId = isDm ? dmSelectedPlayerId : (user?.playerId ?? 1);
  const targetLearnedList = learnedSpellsById[activeTargetPid] ?? [];
  const existingRecord = targetLearnedList.find((r) => r.spellId === spell.id) ?? null;

  const [castMode, setCastMode] = useState<SpellCastMode>(existingRecord?.castMode ?? 'slot');
  const [castMaxUses, setCastMaxUses] = useState<number>(existingRecord?.castMaxUses ?? 1);
  const [castNote, setCastNote] = useState<string>(existingRecord?.castNote ?? '');
  const [castOptsOpen, setCastOptsOpen] = useState(false);

  useEffect(() => {
    setCastMode(existingRecord?.castMode ?? 'slot');
    setCastMaxUses(existingRecord?.castMaxUses ?? 1);
    setCastNote(existingRecord?.castNote ?? '');
  }, [spell.id, activeTargetPid, existingRecord?.castMode, existingRecord?.castMaxUses, existingRecord?.castNote]);

  const hasUploadedCharacter = Boolean(
    playerProfile && playerProfile.characterName.trim() && playerProfile.charClass.trim()
  );

  const nativeClassMatch = hasUploadedCharacter
    ? isSpellAllowedForCharacter(spell, playerProfile?.charClass, playerProfile?.subclass)
    : false;
  const classAllowed = Boolean(playerProfile?.allowOffClassSpells) || nativeClassMatch;
  const slotsFull = playerProfile ? learnedCount >= playerProfile.maxSpells : false;

  const schoolMeta = getSchoolMeta(spell.school);
  const schoolRu = MAGIC_SCHOOL_LABELS_RU[spell.school] || spell.school;
  const typeLine =
    spell.typeLine ||
    `${spell.level === 0 ? 'Заговор' : `${spell.level} уровень`}, ${schoolRu.toLowerCase()}${
      spell.ritual ? ' (ритуал)' : ''
    }`;

  const badges =
    spell.sourceBadges && spell.sourceBadges.length > 0
      ? spell.sourceBadges
      : [{ code: spell.source || (spell.isHomebrew ? 'HB' : 'PH14'), title: spell.sourceTitle || spell.source }];

  const tceSet = new Set((spell.classesTce || []).map((c) => c.toLowerCase()));

  const handleCopyTitle = () => {
    const fullTitle = spell.nameEn ? `${spell.name} [${spell.nameEn}]` : spell.name;
    void navigator.clipboard?.writeText(fullTitle);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleDescClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelectSpellId) return;
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/^https?:\/\/dnd\.su\/(?:homebrew\/)?spells\/(\d+)-/i);
    if (match) {
      e.preventDefault();
      onSelectSpellId(Number(match[1]));
    }
  };

  const handleLearn = async () => {
    if (!user?.playerId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
        `/api/spells/${spell.id}/learn`,
        {
          method: 'POST',
          body: JSON.stringify({
            spell,
            castMode,
            castMaxUses,
            castNote,
          }),
        }
      );
      updateLearnedSpellsInStore(user.playerId, res.learnedSpells);
      pushToast({
        title: 'Заклинание изучено',
        message: `«${spell.name}» добавлено в ваш лист персонажа`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось изучить',
        message: err instanceof Error ? err.message : 'Ошибка изучения заклинания',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLearnMeta = async (targetPid: PlayerId) => {
    setBusy(true);
    try {
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
        `/api/spells/${spell.id}/learn-meta`,
        {
          method: 'PUT',
          body: JSON.stringify({
            playerId: targetPid,
            castMode,
            castMaxUses,
            castNote,
          }),
        }
      );
      updateLearnedSpellsInStore(targetPid, res.learnedSpells);
      pushToast({
        title: 'Способ применения обновлён',
        message: `Настройки «${spell.name}» сохранены`,
        variant: 'success',
      });
      setCastOptsOpen(false);
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения опций',
        message: err instanceof Error ? err.message : 'Не удалось обновить параметры',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDmGrant = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
        `/api/dm/players/${dmSelectedPlayerId}/spells/${spell.id}/learn`,
        {
          method: 'POST',
          body: JSON.stringify({
            spell,
            bypassLimit: true,
            castMode,
            castMaxUses,
            castNote,
          }),
        }
      );
      updateLearnedSpellsInStore(dmSelectedPlayerId, res.learnedSpells);
      const targetChar = charactersById[dmSelectedPlayerId]?.characterName || `Игрок ${dmSelectedPlayerId}`;
      pushToast({
        title: existingRecord ? 'Опции заклинания обновлены' : 'Заклинание выдано Мастером',
        message: `«${spell.name}» доступно персонажу ${targetChar}`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка выдачи заклинания',
        message: err instanceof Error ? err.message : 'Не удалось выдать заклинание',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDmRevoke = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
        `/api/dm/players/${dmSelectedPlayerId}/spells/${spell.id}/learn`,
        { method: 'DELETE' }
      );
      updateLearnedSpellsInStore(dmSelectedPlayerId, res.learnedSpells);
      pushToast({
        title: 'Заклинание убрано Мастером',
        message: `«${spell.name}» удалено у игрока ${dmSelectedPlayerId}`,
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось удалить заклинание',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUnlearn = async () => {
    if (!user?.playerId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
        `/api/spells/${spell.id}/learn`,
        { method: 'DELETE' }
      );
      updateLearnedSpellsInStore(user.playerId, res.learnedSpells);
      pushToast({
        title: 'Заклинание удалено из изученных',
        message: `Слот освобождён (${res.learnedSpells.length} из ${playerProfile?.maxSpells ?? 0})`,
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось удалить заклинание',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      id={`spell-card-${spell.id}`}
      className={`dndsu-card transition-colors ${highlighted ? 'dndsu-card--highlighted' : ''}`}
    >
      {/* Clean Header Bar with Keycap Level & School Status Dot */}
      <div className="dndsu-card__header flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs text-secondary">
            <span className="hud-keycap">
              {spell.level === 0 ? 'Заговор' : `${spell.level} круг`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: schoolMeta.color }}
              />
              <span>{schoolMeta.ru}</span>
            </span>
          </div>

          <h2 className="font-medium text-lg sm:text-xl leading-snug flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-text">{spell.name}</span>
            {spell.nameEn && (
              <span className="text-xs sm:text-sm font-normal text-muted">[{spell.nameEn}]</span>
            )}
            <span className="inline-flex items-center gap-1 flex-wrap align-middle">
              {badges.map((b, i) =>
                b.href ? (
                  <a
                    key={`${b.code}-${i}`}
                    href={b.href}
                    target="_blank"
                    rel="noreferrer"
                    title={b.title}
                    className="dndsu-source-plaque"
                  >
                    {b.code}
                  </a>
                ) : (
                  <span key={`${b.code}-${i}`} title={b.title} className="dndsu-source-plaque">
                    {b.code}
                  </span>
                )
              )}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopyTitle}
            title="Скопировать название"
            className="w-8 h-8 bg-bg border border-border text-muted hover:text-text flex items-center justify-center transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-positive" strokeWidth={1.5} />
            ) : (
              <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </button>

          {spell.url && (
            <a
              href={spell.url}
              target="_blank"
              rel="noreferrer"
              title="Открыть оригинал на dnd.su"
              className="w-8 h-8 bg-bg border border-border text-muted hover:text-text flex items-center justify-center transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
            </a>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Закрыть карточку"
              className="w-8 h-8 bg-bg border border-border text-muted hover:text-text flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* dnd.su Params & Article Body */}
      <div className="p-5 space-y-4">
        <ul className="dndsu-params">
          <li className="dndsu-type-line flex items-center gap-2 flex-wrap">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: schoolMeta.color }}
              title={schoolMeta.ru}
            />
            <span>{typeLine}</span>
          </li>

          <li>
            <strong>Время накладывания:</strong>{' '}
            <span className="text-text">{spell.castingTime}</span>
          </li>

          <li>
            <strong>Дистанция:</strong> <span className="text-text">{spell.spellRange}</span>
          </li>

          <li>
            <strong>Компоненты:</strong>{' '}
            <span className="text-text">{spell.components || 'Нет'}</span>
          </li>

          <li>
            <strong>Длительность:</strong> <span className="text-text">{spell.duration}</span>
          </li>

          {spell.classes && spell.classes.length > 0 && (
            <li>
              <strong>Классы:</strong>{' '}
              <span className="text-text">
                {spell.classes.map((cl, idx) => {
                  const norm = normalizeDndClass(cl);
                  const hbMeta = norm ? DND_HOMEBREW_CLASS_BY_KEY[norm] : undefined;
                  const displayCl =
                    (norm && DND_CLASS_LABELS_RU[norm]?.toLowerCase()) ||
                    (DND_CLASS_LABELS_RU[cl] ? DND_CLASS_LABELS_RU[cl].toLowerCase() : cl);
                  const isTce = tceSet.has(cl.toLowerCase());
                  return (
                    <React.Fragment key={`${cl}-${idx}`}>
                      {idx > 0 && ', '}
                      {hbMeta ? (
                        <a
                          href={hbMeta.url}
                          target="_blank"
                          rel="noreferrer"
                          title={`Авторский класс dnd.su (${hbMeta.source})`}
                          className="hover:text-primary underline decoration-dotted underline-offset-2"
                        >
                          {displayCl}
                        </a>
                      ) : (
                        <span>{displayCl}</span>
                      )}
                      {hbMeta && (
                        <sup
                          title={`Homebrew класс dnd.su · ${hbMeta.source}`}
                          className="ml-0.5 text-[11px] font-mono text-muted"
                        >
                          HB
                        </sup>
                      )}
                      {isTce && (
                        <sup
                          title="Опциональный список заклинаний Tasha's Cauldron of Everything"
                          className="ml-0.5 text-[11px] font-mono text-muted"
                        >
                          TCE
                        </sup>
                      )}
                    </React.Fragment>
                  );
                })}
              </span>
            </li>
          )}

          {spell.subclasses && (
            <li>
              <strong>Подклассы:</strong>{' '}
              <span className="text-secondary">
                {spell.subclasses
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((subEntry, idx) => {
                    const paren = subEntry.match(/\(([^)]+)\)\s*$/);
                    const normParent = paren ? normalizeDndClass(paren[1]) : undefined;
                    const hbMeta = normParent ? DND_HOMEBREW_CLASS_BY_KEY[normParent] : undefined;
                    return (
                      <React.Fragment key={`${subEntry}-${idx}`}>
                        {idx > 0 && ', '}
                        {hbMeta ? (
                          <a
                            href={hbMeta.url}
                            target="_blank"
                            rel="noreferrer"
                            title={`Подкласс класса «${hbMeta.labelRu}» (${hbMeta.source})`}
                            className="hover:text-primary underline decoration-dotted underline-offset-2"
                          >
                            {subEntry}
                          </a>
                        ) : (
                          <span>{subEntry}</span>
                        )}
                        {hbMeta && (
                          <sup
                            title={`Homebrew dnd.su · ${hbMeta.source}`}
                            className="ml-0.5 text-[11px] font-mono text-muted"
                          >
                            HB
                          </sup>
                        )}
                      </React.Fragment>
                    );
                  })}
              </span>
            </li>
          )}
        </ul>

        <div className="border-t border-border pt-4">
          {spell.descriptionHtml ? (
            <div
              onClick={handleDescClick}
              className="dndsu-desc"
              dangerouslySetInnerHTML={{ __html: spell.descriptionHtml }}
            />
          ) : (
            <FormattedText text={spell.description} className="dndsu-desc" />
          )}
        </div>

        {/* Player Learn / Unlearn + Casting Mode Controls */}
        {isPlayer && (
          <div className="pt-4 border-t border-border space-y-3">
            {!hasUploadedCharacter ? (
              <button
                type="button"
                onClick={() => setActiveTab('character')}
                className="hud-btn-secondary h-9 px-3.5 text-xs inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                <span>Загрузите чарник во вкладке «Персонаж», чтобы изучать заклинания</span>
              </button>
            ) : isLearned ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-positive">
                      <BookMarked className="w-4 h-4" strokeWidth={1.5} />
                      <span>Изучено героем</span>
                    </span>
                    {existingRecord && (() => {
                      const b = formatSpellCastBadge(
                        existingRecord.castMode,
                        spell.level,
                        existingRecord.castMaxUses,
                        existingRecord.castNote
                      );
                      return (
                        <span className={`px-2 py-0.5 border text-xs font-mono ${b.className}`}>
                          {b.text}
                        </span>
                      );
                    })()}
                    {existingRecord?.grantedByDm && (
                      <span className="hud-keycap">
                        От Мастера
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCastOptsOpen((v) => !v)}
                      className="h-8 px-3 border border-border bg-bg text-secondary hover:text-text text-xs transition-colors"
                    >
                      Способ применения
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleUnlearn}
                      className="inline-flex items-center gap-1.5 h-8 px-3 border border-border text-muted hover:text-negative hover:border-negative/30 text-xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Забыть</span>
                    </button>
                  </div>
                </div>

                {castOptsOpen && user?.playerId && (
                  <div className="p-3 bg-bg border border-border space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={castMode}
                        onChange={(e) => setCastMode(e.target.value as SpellCastMode)}
                        className="anime-input sm:col-span-2 h-9 py-1 px-2.5 text-xs"
                      >
                        {SPELL_CAST_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {SPELL_CAST_MODE_OPTIONS.find((o) => o.value === castMode)?.usesCounter && (
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={castMaxUses}
                          onChange={(e) => setCastMaxUses(Math.max(1, Number(e.target.value) || 1))}
                          placeholder="Кол-во"
                          className="anime-input h-9 py-1 px-2.5 text-xs font-mono"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={castNote}
                        onChange={(e) => setCastNote(e.target.value)}
                        placeholder="Уточнение (черта, предмет, ресурс)"
                        className="anime-input flex-1 h-9 py-1 px-2.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveLearnMeta(user.playerId!)}
                        className="anime-btn-primary h-9 px-3.5 text-xs"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : !classAllowed ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled
                  className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Изучить</span>
                </button>
                <span className="text-xs text-muted">
                  Недоступно классу «{formatCharacterClassesRu(playerProfile!.charClass) || playerProfile!.charClass}»
                </span>
              </div>
            ) : slotsFull ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled
                  className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Изучить</span>
                </button>
                <span className="text-xs text-warning font-mono tabular-nums">
                  Лимит заполнен ({learnedCount} из {playerProfile!.maxSpells})
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleLearn}
                      className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" strokeWidth={1.5} />
                      <span>{busy ? 'Изучение…' : 'Изучить'}</span>
                    </button>
                    {!nativeClassMatch && playerProfile?.allowOffClassSpells && (
                      <span className="text-xs text-secondary">
                        Вне класса (разрешено Мастером)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCastOptsOpen((v) => !v)}
                    className="text-xs text-secondary hover:text-text underline transition-colors"
                  >
                    {castOptsOpen ? 'Скрыть опции применения' : 'Особый способ применения'}
                  </button>
                </div>

                {castOptsOpen && (
                  <div className="p-3 bg-bg border border-border grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <select
                      value={castMode}
                      onChange={(e) => setCastMode(e.target.value as SpellCastMode)}
                      className="anime-input sm:col-span-2 h-9 py-1 px-2.5 text-xs"
                    >
                      {SPELL_CAST_MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {SPELL_CAST_MODE_OPTIONS.find((o) => o.value === castMode)?.usesCounter && (
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={castMaxUses}
                        onChange={(e) => setCastMaxUses(Math.max(1, Number(e.target.value) || 1))}
                        placeholder="Зарядов"
                        className="anime-input h-9 py-1 px-2.5 text-xs font-mono"
                      />
                    )}
                    <input
                      value={castNote}
                      onChange={(e) => setCastNote(e.target.value)}
                      placeholder="Источник (раса, черта, предмет)"
                      className="anime-input sm:col-span-3 h-9 py-1 px-2.5 text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DM Spell Granting Controls */}
        {isDm && (
          <div className="pt-4 border-t border-border">
            <div className="p-3.5 bg-bg border border-border space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-text">
                  <Crown className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                  <span>Выдать заклинание игроку</span>
                </span>
                {!nativeClassMatch && playerProfile?.charClass && (
                  <span className="text-xs text-muted">
                    Вне класса «{formatCharacterClassesRu(playerProfile.charClass) || playerProfile.charClass}»
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={dmSelectedPlayerId}
                  onChange={(e) => setDmSelectedPlayerId(Number(e.target.value) as PlayerId)}
                  className="anime-input h-9 py-1 px-2.5 text-xs"
                >
                  {([1, 2, 3] as PlayerId[]).map((pid) => {
                    const ch = charactersById[pid];
                    const clsRu = ch?.charClass ? formatCharacterClassesRu(ch.charClass) : '';
                    return (
                      <option key={pid} value={pid}>
                        Игрок {pid}: {ch?.characterName || 'Без имени'}
                        {clsRu ? ` (${clsRu})` : ''}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={castMode}
                  onChange={(e) => setCastMode(e.target.value as SpellCastMode)}
                  className="anime-input sm:col-span-2 h-9 py-1 px-2.5 text-xs"
                >
                  {SPELL_CAST_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {SPELL_CAST_MODE_OPTIONS.find((o) => o.value === castMode)?.usesCounter && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-secondary text-xs">Зарядов:</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={castMaxUses}
                      onChange={(e) => setCastMaxUses(Math.max(1, Number(e.target.value) || 1))}
                      className="anime-input w-16 h-9 py-1 px-2 text-xs text-center font-mono"
                    />
                  </div>
                )}

                <input
                  value={castNote}
                  onChange={(e) => setCastNote(e.target.value)}
                  placeholder="Пометка (пси-заряды, черта, артефакт)"
                  className="anime-input flex-1 min-w-[160px] h-9 py-1 px-2.5 text-xs"
                />

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDmGrant()}
                  className="anime-btn-primary h-9 px-3.5 text-xs inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{existingRecord ? 'Обновить' : 'Выдать'}</span>
                </button>

                {existingRecord && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDmRevoke()}
                    className="h-9 px-3 border border-border text-muted hover:text-negative hover:border-negative/30 text-xs inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Забрать</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
});
