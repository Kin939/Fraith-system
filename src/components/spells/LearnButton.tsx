import React, { useState } from 'react';
import { BookCheck, Lock, PlusCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { normalizeDndClass } from '../../lib/lss';
import { useCampaignStore } from '../../lib/store';
import type { CharacterProfile, LearnedSpellRecord, Spell } from '../../lib/types';

interface LearnButtonProps {
  spell: Spell;
  playerProfile: CharacterProfile | null;
  isLearned: boolean;
  learnedCount: number;
}

export const LearnButton: React.FC<LearnButtonProps> = ({
  spell,
  playerProfile,
  isLearned,
  learnedCount,
}) => {
  const user = useCampaignStore((s) => s.user);
  const updateLearnedSpellsInStore = useCampaignStore((s) => s.updateLearnedSpellsInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  if (!user || user.role !== 'player' || !user.playerId || !playerProfile) {
    return null;
  }

  const playerClasses = playerProfile.charClass
    .split(',')
    .map((c) => normalizeDndClass(c) ?? c.trim())
    .filter(Boolean);
  const spellClasses = spell.classes.map((c) => normalizeDndClass(c) ?? c.trim());

  const classAllowed = playerClasses.some((pc) =>
    spellClasses.some((sc) => sc.toLowerCase() === pc.toLowerCase())
  );
  const limitReached = !isLearned && learnedCount >= playerProfile.maxSpells;

  const handleToggle = async () => {
    if (!user.playerId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ learnedSpells: LearnedSpellRecord[] }>(
        `/api/spells/${spell.id}/learn`,
        {
          method: isLearned ? 'DELETE' : 'POST',
        }
      );
      updateLearnedSpellsInStore(user.playerId, res.learnedSpells);
      pushToast({
        title: isLearned ? 'Заклинание забыто' : 'Заклинание изучено!',
        message: isLearned
          ? `«${spell.name}» убрано из вашего списка на вкладке персонажа.`
          : `«${spell.name}» добавлено на вкладку «Мой персонаж».`,
        variant: isLearned ? 'info' : 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось изменить список заклинаний',
        message: err instanceof Error ? err.message : 'Ошибка запроса',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  if (isLearned) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={handleToggle}
        title="Нажмите, чтобы убрать из изученных"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
      >
        <BookCheck className="w-3.5 h-3.5" />
        <span>{busy ? '...' : 'Изучено ✓'}</span>
      </button>
    );
  }

  if (!classAllowed) {
    return (
      <span
        title={`Ваш класс (${playerProfile.charClass}) не может изучить это заклинание`}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] bg-bg/60 border border-border text-muted cursor-not-allowed"
      >
        <Lock className="w-3 h-3" />
        Другой класс
      </span>
    );
  }

  if (limitReached) {
    return (
      <span
        title={`Достигнут лимит изученных заклинаний (${learnedCount}/${playerProfile.maxSpells})`}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 cursor-not-allowed"
      >
        <Lock className="w-3 h-3" />
        Лимит {learnedCount}/{playerProfile.maxSpells}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleToggle}
      className="anime-btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
    >
      <PlusCircle className="w-3.5 h-3.5" />
      <span>{busy ? 'Изучение...' : 'Изучить'}</span>
    </button>
  );
};
