import React, { useState } from 'react';
import { BookMarked, Check, Copy, ExternalLink, Lock, Plus, Trash2, Upload, X } from 'lucide-react';
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
import { useCampaignStore } from '../../lib/store';
import type { CharacterProfile, LearnedSpellRecord, Spell } from '../../lib/types';

interface SpellCardProps {
  spell: Spell;
  highlighted?: boolean;
  playerProfile: CharacterProfile | null;
  isLearned: boolean;
  learnedCount: number;
  onSelectSpellId?: (spellId: number) => void;
  onClose?: () => void;
}

export const SpellCard: React.FC<SpellCardProps> = ({
  spell,
  highlighted,
  playerProfile,
  isLearned,
  learnedCount,
  onSelectSpellId,
  onClose,
}) => {
  const user = useCampaignStore((s) => s.user);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const updateLearnedSpellsInStore = useCampaignStore((s) => s.updateLearnedSpellsInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPlayer = user?.role === 'player' && user.playerId !== null;
  const hasUploadedCharacter = Boolean(
    playerProfile && playerProfile.characterName.trim() && playerProfile.charClass.trim()
  );

  const classAllowed = hasUploadedCharacter
    ? isSpellAllowedForCharacter(spell, playerProfile?.charClass, playerProfile?.subclass)
    : false;
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
          body: JSON.stringify({ spell }),
        }
      );
      updateLearnedSpellsInStore(user.playerId, res.learnedSpells);
      pushToast({
        title: 'Заклинание изучено',
        message: `«${spell.name}» добавлено в ваш лист персонажа.`,
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
        message: `Слот памяти освобождён (${res.learnedSpells.length}/${playerProfile?.maxSpells ?? 0}).`,
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
      className={`dndsu-card transition-all ${highlighted ? 'dndsu-card--highlighted' : ''}`}
    >
      {/* dnd.su Card Header Bar */}
      <div className="dndsu-card__header flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-anime font-extrabold text-base sm:text-lg leading-snug flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
            className="p-1.5 rounded-lg bg-bg/50 border border-border/80 text-muted hover:text-text hover:border-primary/50 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {spell.url && (
            <a
              href={spell.url}
              target="_blank"
              rel="noreferrer"
              title="Открыть оригинал на dnd.su"
              className="p-1.5 rounded-lg bg-bg/50 border border-border/80 text-muted hover:text-accent hover:border-accent/50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Закрыть карточку"
              className="p-1.5 rounded-lg bg-bg/50 border border-border/80 text-muted hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* dnd.su Params & Article Body */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <ul className="dndsu-params">
          <li className="dndsu-type-line flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-md text-xs font-bold not-italic shrink-0"
              style={{ backgroundColor: schoolMeta.bg, color: schoolMeta.color }}
              title={schoolMeta.ru}
            >
              {schoolMeta.glyph}
            </span>
            <span>{typeLine}</span>
          </li>

          <li>
            <strong>Время накладывания:</strong>{' '}
            <span className="text-text/95">{spell.castingTime}</span>
          </li>

          <li>
            <strong>Дистанция:</strong> <span className="text-text/95">{spell.spellRange}</span>
          </li>

          <li>
            <strong>Компоненты:</strong>{' '}
            <span className="text-text/95">{spell.components || 'Нет'}</span>
          </li>

          <li>
            <strong>Длительность:</strong> <span className="text-text/95">{spell.duration}</span>
          </li>

          {spell.classes && spell.classes.length > 0 && (
            <li>
              <strong>Классы:</strong>{' '}
              <span className="text-text/95">
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
                          title={`Homebrew класс dnd.su (${hbMeta.source})`}
                          className="hover:text-accent underline decoration-dotted underline-offset-2"
                        >
                          {displayCl}
                        </a>
                      ) : (
                        <span>{displayCl}</span>
                      )}
                      {hbMeta && (
                        <sup
                          title={`Homebrew класс dnd.su • ${hbMeta.source}`}
                          className="ml-0.5 text-[10px] font-bold text-purple-300"
                        >
                          HB
                        </sup>
                      )}
                      {isTce && (
                        <sup
                          title="Опциональный список заклинаний Tasha's Cauldron of Everything"
                          className="ml-0.5 text-[10px] font-bold text-accent"
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
              <span className="text-text/90">
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
                            title={`Подкласс Homebrew-класса «${hbMeta.labelRu}» (${hbMeta.source})`}
                            className="hover:text-accent underline decoration-dotted underline-offset-2"
                          >
                            {subEntry}
                          </a>
                        ) : (
                          <span>{subEntry}</span>
                        )}
                        {hbMeta && (
                          <sup
                            title={`Homebrew dnd.su • ${hbMeta.source}`}
                            className="ml-0.5 text-[10px] font-bold text-purple-300"
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

        <div className="border-t border-border/75 pt-3.5">
          {spell.descriptionHtml ? (
            <div
              onClick={handleDescClick}
              className="dndsu-desc"
              dangerouslySetInnerHTML={{ __html: spell.descriptionHtml }}
            />
          ) : (
            <div className="dndsu-desc whitespace-pre-line">{spell.description}</div>
          )}
        </div>

        {/* Player Learn / Unlearn Controls */}
        {isPlayer && (
          <div className="pt-3 border-t border-border/75 flex flex-wrap items-center justify-between gap-2">
            {!hasUploadedCharacter ? (
              <button
                type="button"
                onClick={() => setActiveTab('character')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/25 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Загрузите чарник во вкладке «Персонаж», чтобы изучать заклинания
              </button>
            ) : isLearned ? (
              <div className="flex items-center justify-between w-full gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <BookMarked className="w-4 h-4" />
                  Изучено вашим персонажем
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleUnlearn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Забыть
                </button>
              </div>
            ) : !classAllowed ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                Недоступно классу «{formatCharacterClassesRu(playerProfile!.charClass) || playerProfile!.charClass}»
              </span>
            ) : slotsFull ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                Лимит заклинаний заполнен ({learnedCount}/{playerProfile!.maxSpells})
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleLearn}
                className="anime-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {busy ? 'Изучение...' : 'Изучить заклинание'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
