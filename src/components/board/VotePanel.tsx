import React from 'react';
import { Eraser, Minus, Plus, ThumbsUp } from 'lucide-react';
import type { BoardVotes } from '../../lib/boardProtocol';
import { myVoteCount, voteCountFor } from '../../lib/boardProtocol';
import type { BoardMember } from '../../lib/boards';

interface VotePanelProps {
  votes: BoardVotes;
  members: BoardMember[];
  selfId: number | null;
  isDm: boolean;
  canWrite: boolean;
  selectedShapeId: string | null;
  onVote: (shapeId: string, delta: 1 | -1) => void;
  onClear: () => void;
  onPickObject: () => void;
}

/** Dot-voting: до 3 точек на объект от каждого участника. */
export const VotePanel: React.FC<VotePanelProps> = ({
  votes,
  members,
  selfId,
  isDm,
  canWrite,
  selectedShapeId,
  onVote,
  onClear,
  onPickObject,
}) => {
  const entries = Object.entries(votes)
    .map(([shapeId, bucket]) => ({
      shapeId,
      total: voteCountFor(votes, shapeId),
      voters: Object.entries(bucket).map(([userId, count]) => ({
        name: members.find((member) => member.id === Number(userId))?.displayName ?? `#${userId}`,
        count,
      })),
    }))
    .sort((a, b) => b.total - a.total);

  const total = entries.reduce((sum, entry) => sum + entry.total, 0);
  const myOnSelected = selectedShapeId && selfId ? myVoteCount(votes, selectedShapeId, selfId) : 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-wide text-secondary">Голосование · {total}</span>
        {isDm && (
          <button
            type="button"
            onClick={onClear}
            className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-negative"
            title="Сбросить все голоса"
          >
            <Eraser className="w-3 h-3" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="p-3 space-y-2 border-b border-border shrink-0">
        <div className="text-[10px] font-mono uppercase tracking-wide text-muted">Выбранный объект</div>
        {selectedShapeId ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[10px] text-secondary font-mono truncate">{selectedShapeId}</span>
            <button
              type="button"
              disabled={!canWrite || myOnSelected >= 3}
              onClick={() => onVote(selectedShapeId, 1)}
              className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-positive disabled:opacity-30"
              title="Добавить голос (макс. 3)"
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
            </button>
            <span className="w-6 text-center text-[11px] font-mono text-warning tabular-nums">{myOnSelected}</span>
            <button
              type="button"
              disabled={!canWrite || myOnSelected <= 0}
              onClick={() => onVote(selectedShapeId, -1)}
              className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-negative disabled:opacity-30"
              title="Убрать голос"
            >
              <Minus className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPickObject}
            className="w-full text-left text-[10px] text-muted border border-dashed border-border px-2 py-1.5 hover:border-primary/60 hover:text-secondary transition-colors"
          >
            Кликните здесь, затем по объекту на холсте — или просто выделите фигуру.
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
        {entries.length === 0 && (
          <div className="p-4 text-[11px] text-muted leading-relaxed">
            Голосов пока нет. Выделите фигуру и нажмите «+», чтобы поставить точку.
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.shapeId} className="px-3 py-2 space-y-1">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-3 h-3 text-warning" strokeWidth={1.5} />
              <span className="text-[10px] font-mono text-secondary truncate flex-1">{entry.shapeId}</span>
              <span className="text-[11px] font-mono text-warning tabular-nums">{entry.total}</span>
            </div>
            <div className="text-[10px] text-muted truncate">
              {entry.voters.map((voter) => `${voter.name} ×${voter.count}`).join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
