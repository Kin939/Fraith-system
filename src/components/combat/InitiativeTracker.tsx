import React, { useEffect } from 'react';
import { ChevronRight, Swords, Users } from 'lucide-react';
import type { CombatParticipantView, CombatRoomPeer, CombatView } from '../../lib/combatProtocol';
import { PeerAvatar } from '../common/PeerAvatar';
import { ParticipantCard, type ParticipantCardHandlers } from './ParticipantCard';

interface InitiativeTrackerProps {
  state: CombatView;
  participants: CombatParticipantView[];
  peers: CombatRoomPeer[];
  currentName: string | null;
  readOnly: boolean;
  canAdvanceTurn: boolean;
  onNextTurn: () => void;
  handlers: ParticipantCardHandlers;
}

/** Вертикальный трекер инициативы с HUD-шапкой и presence-аватарами. */
export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  state,
  participants,
  peers,
  currentName,
  readOnly,
  canAdvanceTurn,
  onNextTurn,
  handlers,
}) => {
  /**
   * Enter (или N) — следующий ход. Не срабатывает, когда фокус в поле ввода,
   * открыт редактор участника или бой уже завершён.
   */
  useEffect(() => {
    if (!canAdvanceTurn) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key.toLowerCase() !== 'n') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      onNextTurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canAdvanceTurn, onNextTurn]);

  return (
    <section className="glass-panel hud-cut flex flex-col min-h-0 h-full">
      <header className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Swords className="w-5 h-5 text-primary shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <div className="text-sm leading-tight text-text">
              Раунд {state.roundNumber}
              <span className="ml-2 text-[11px] font-mono uppercase tracking-wide text-secondary">
                {state.status === 'active' ? 'идёт бой' : state.status === 'finished' ? 'завершён' : 'подготовка'}
              </span>
            </div>
            <div className="text-[11px] text-secondary truncate">
              {currentName ? `Ход: ${currentName}` : 'Ход не начат'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {peers.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5" title="Участники на вкладке «Бой»">
              <Users className="w-3.5 h-3.5 text-secondary" strokeWidth={1.5} />
              {peers.slice(0, 5).map((peer) => (
                <PeerAvatar
                  key={peer.userId}
                  name={peer.displayName}
                  color={peer.color}
                  avatarUrl={peer.avatarUrl}
                  size={24}
                  crown={peer.role === 'dm'}
                />
              ))}
            </div>
          )}

          {canAdvanceTurn && !readOnly && state.status === 'active' && (
            <button
              type="button"
              onClick={onNextTurn}
              className="anime-btn-primary h-10 px-3 text-[11px] font-mono uppercase tracking-wide flex items-center gap-1.5"
              title="Завершить ход и перейти к следующему участнику — Enter или N"
            >
              следующий ход <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
        {participants.length === 0 && (
          <div className="p-5 text-sm text-secondary leading-relaxed">
            В бою пока нет участников. Мастер добавляет игроков и существ из бестиария в конструкторе.
          </div>
        )}
        {participants.map((participant, index) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            index={index}
            isDm={state.isDm}
            readOnly={readOnly}
            handlers={handlers}
          />
        ))}
      </div>
    </section>
  );
};
