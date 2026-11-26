import React from 'react';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { useValue, type Editor } from 'tldraw';
import type { BoardComment, BoardVotes } from '../../lib/boardProtocol';
import { voteCountFor } from '../../lib/boardProtocol';

/* -------------------------------------------------------------------------- */
/*  Пины комментариев на холсте                                                */
/* -------------------------------------------------------------------------- */

export const BoardCommentPins: React.FC<{
  editor: Editor;
  comments: BoardComment[];
  activeCommentId: string | null;
  onSelect: (commentId: string) => void;
  showResolved: boolean;
}> = ({ editor, comments, activeCommentId, onSelect, showResolved }) => {
  useValue('board-comment-pins-camera', () => editor.getCamera(), [editor]);

  const visible = comments.filter((comment) => showResolved || !comment.resolved);

  return (
    <div className="absolute inset-0 pointer-events-none z-[3] overflow-hidden">
      {visible.map((comment, index) => {
        let point = { x: comment.x, y: comment.y };
        if (comment.shapeId) {
          const bounds = editor.getShapePageBounds(comment.shapeId as never);
          if (bounds) point = { x: bounds.maxX, y: bounds.minY };
        }
        const viewportPoint = editor.pageToViewport(point);
        const isActive = activeCommentId === comment.id;
        return (
          <button
            key={comment.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(comment.id);
            }}
            title={`${comment.authorName}: ${comment.text.slice(0, 120)}`}
            className={`absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-1 h-7 min-w-7 px-1.5 text-[10px] font-mono border transition-colors ${
              comment.resolved
                ? 'bg-deep border-positive/60 text-positive'
                : 'bg-raised border-primary/70 text-primary'
            } ${isActive ? 'ring-2 ring-primary/60' : ''}`}
            style={{ left: viewportPoint.x, top: viewportPoint.y }}
          >
            <MessageSquare className="w-3 h-3" strokeWidth={1.5} />
            <span>{comment.replies.length > 0 ? comment.replies.length + 1 : index + 1}</span>
          </button>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Dot-voting: счётчики на объектах                                           */
/* -------------------------------------------------------------------------- */

export const BoardVoteBadges: React.FC<{
  editor: Editor;
  votes: BoardVotes;
}> = ({ editor, votes }) => {
  useValue('board-vote-badges-camera', () => editor.getCamera(), [editor]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[3] overflow-hidden">
      {Object.keys(votes).map((shapeId) => {
        const total = voteCountFor(votes, shapeId);
        if (total <= 0) return null;
        const bounds = editor.getShapePageBounds(shapeId as never);
        if (!bounds) return null;
        const point = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY });
        return (
          <div
            key={shapeId}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 h-6 border border-warning/70 bg-deep text-warning text-[10px] font-mono tabular-nums"
            style={{ left: point.x, top: point.y, boxShadow: '0 0 12px rgba(229,169,59,0.35)' }}
          >
            <ThumbsUp className="w-3 h-3" strokeWidth={1.5} />
            {total}
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Миникарта                                                                  */
/* -------------------------------------------------------------------------- */

const MINIMAP_W = 168;
const MINIMAP_H = 112;

export const BoardMinimap: React.FC<{ editor: Editor }> = ({ editor }) => {
  useValue('board-minimap-camera', () => editor.getCamera(), [editor]);
  useValue('board-minimap-shapes', () => editor.getCurrentPageShapeIds().size, [editor]);

  const content = editor.getCurrentPageBounds();
  const viewport = editor.getViewportPageBounds();

  const world = content
    ? {
        minX: Math.min(content.minX, viewport.minX),
        minY: Math.min(content.minY, viewport.minY),
        maxX: Math.max(content.maxX, viewport.maxX),
        maxY: Math.max(content.maxY, viewport.maxY),
      }
    : { minX: viewport.minX, minY: viewport.minY, maxX: viewport.maxX, maxY: viewport.maxY };

  const worldW = Math.max(world.maxX - world.minX, 1);
  const worldH = Math.max(world.maxY - world.minY, 1);
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
  const offsetX = (MINIMAP_W - worldW * scale) / 2;
  const offsetY = (MINIMAP_H - worldH * scale) / 2;
  const toMini = (x: number, y: number) => ({
    x: offsetX + (x - world.minX) * scale,
    y: offsetY + (y - world.minY) * scale,
  });

  const shapes = editor
    .getCurrentPageShapes()
    .map((shape) => editor.getShapePageBounds(shape))
    .filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds))
    .slice(0, 250);

  const viewportTopLeft = toMini(viewport.minX, viewport.minY);
  const viewportSize = {
    w: Math.max(6, viewport.width * scale),
    h: Math.max(6, viewport.height * scale),
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - offsetX) / scale + world.minX;
    const y = (event.clientY - rect.top - offsetY) / scale + world.minY;
    editor.centerOnPoint({ x, y }, { animation: { duration: 180 } });
  };

  return (
    <div
      className="absolute bottom-3 right-3 z-[4] border border-border bg-deep/95 p-1 cursor-crosshair select-none"
      title="Миникарта — клик центрирует холст"
      onClick={handleClick}
    >
      <div className="relative" style={{ width: MINIMAP_W, height: MINIMAP_H }}>
        {shapes.map((bounds, index) => {
          const topLeft = toMini(bounds.minX, bounds.minY);
          return (
            <div
              key={index}
              className="absolute bg-primary/40"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: Math.max(1, bounds.width * scale),
                height: Math.max(1, bounds.height * scale),
              }}
            />
          );
        })}
        <div
          className="absolute border border-primary/90"
          style={{
            left: viewportTopLeft.x,
            top: viewportTopLeft.y,
            width: viewportSize.w,
            height: viewportSize.h,
            boxShadow: '0 0 8px rgba(168,85,247,0.5) inset',
          }}
        />
      </div>
    </div>
  );
};
