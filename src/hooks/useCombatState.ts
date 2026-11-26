import { useEffect, useMemo, useState } from 'react';
import { turnTimerRemaining, type CombatParticipantView, type CombatView } from '../lib/combatProtocol';

/**
 * Производные данные боя для интерфейса: текущий участник, тикающий таймер,
 * свой участник и группировка для трекера.
 */
export function useCombatState(state: CombatView | null) {
  const [now, setNow] = useState(() => Date.now());

  const hasTimer = Boolean(state?.settings.turnTimerSeconds) && state?.status === 'active';
  useEffect(() => {
    if (!hasTimer) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [hasTimer]);

  const participants = state?.participants ?? [];

  return useMemo(() => {
    const sorted = [...participants].sort((a, b) => a.initiativeOrder - b.initiativeOrder);
    const current = sorted[state?.currentTurnIndex ?? 0] ?? null;
    const mine = sorted.find((participant) => participant.isYou) ?? null;
    const remaining = state ? turnTimerRemaining(state.settings, now) : 0;
    const timerExpired =
      Boolean(state?.settings.turnTimerSeconds) && state?.status === 'active' && remaining <= 0;
    const timerPaused = Boolean(state?.settings.turnTimerSeconds) && !state?.settings.turnTimerEndsAt;

    return {
      sorted,
      current,
      mine,
      remaining,
      timerExpired,
      timerPaused,
      monsters: sorted.filter((participant) => participant.participantType === 'monster'),
      players: sorted.filter((participant) => participant.participantType === 'player'),
      isActive: state?.status === 'active',
      isFinished: state?.status === 'finished',
      roundNumber: state?.roundNumber ?? 1,
      now,
    };
  }, [participants, state, now]);
}

/** Быстрый поиск участника по id (для панелей деталей). */
export function findParticipant(
  state: CombatView | null,
  participantId: string | null
): CombatParticipantView | null {
  if (!state || !participantId) return null;
  return state.participants.find((participant) => participant.id === participantId) ?? null;
}
