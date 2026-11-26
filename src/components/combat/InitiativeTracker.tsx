import React from 'react';
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
  return (
    <section className="glass-panel hud-cut flex flex-col min-h-0 h-full">
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Swords className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">
              Раунд {state.roundNumber} · {state.status === 'active' ? 'идёт бой' : state.status === 'finished' ? 'завершён' : 'подготовка'}
            </div>
            <div className="text-[10px] text-muted truncate">
              {currentName ? `Ход: ${currentName}` : 'Ход не начат'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {peers.length > 0 && (
            <div className="hidden sm:flex items-center gap-1" title="Участники на вкладке «Бой»">
              <Users className="w-3 h-3 text-muted" strokeWidth={1.5} />
              {peers.slice(0, 5).map((peer) => (
                <PeerAvatar
                  key={peer.userId}
                  name={peer.displayName}
                  color={peer.color}
                  avatarUrl={peer.avatarUrl}
                  size={18}
                  crown={peer.role === 'dm'}
                />
              ))}
            </div>
          )}

          {canAdvanceTurn && !readOnly && state.status === 'active' && (
            <button
              type="button"
              onClick={onNextTurn}
              className="anime-btn-primary h-7 px-2 text-[10px] font-mono uppercase tracking-wide flex items-center gap-1"
              title="Завершить ход и перейти к следующему участнику"
            >
              следующий ход <ChevronRight className="w-3 h-3" strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {participants.length === 0 && (
          <div className="p-4 text-[11px] text-muted leading-relaxed">
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
