import type { BoardPermission } from './boards';

/** Протокол WebSocket-канала доски (клиент ↔ BoardRoom DO). */

export interface BoardCursor {
  x: number;
  y: number;
  pageId: string | null;
}

export interface BoardPeer {
  userId: number;
  username: string;
  displayName: string;
  role: 'dm' | 'player';
  permission: BoardPermission;
  color: string;
  avatarUrl?: string | null;
  cursor: BoardCursor | null;
  selection: string[];
  connectedAt: number;
}

export interface BoardCommentReply {
  id: string;
  authorId: number;
  authorName: string;
  text: string;
  createdAt: number;
  mentions: number[];
}

export interface BoardComment {
  id: string;
  shapeId: string | null;
  x: number;
  y: number;
  authorId: number;
  authorName: string;
  text: string;
  createdAt: number;
  resolved: boolean;
  /** Упомянутые участники (@ник) */
  mentions?: number[];
  replies: BoardCommentReply[];
}

export type BoardVotes = Record<string, Record<string, number>>;

export interface BoardTimerState {
  durationMs: number;
  startedAt: number | null;
  elapsedMs: number;
  running: boolean;
  updatedAt: number;
}

export type BoardTimerAction = 'start' | 'pause' | 'reset' | 'set';

/**
 * События синхронизации документа для редактора (tldraw store).
 * Патчи применяются только к document-scope, presence/курсоры эфемерны.
 */
export type BoardStoreEvent =
  | { kind: 'snapshot'; records: Record<string, unknown> }
  | { kind: 'empty' }
  | { kind: 'patch'; diff: unknown; seq: number }
  | { kind: 'replay'; patches: Array<{ seq: number; diff: unknown }>; seq: number }
  | { kind: 'reset-hint' }
  | { kind: 'resync' };

export type BoardSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'denied';

export const voteCountFor = (votes: BoardVotes, shapeId: string): number => {
  const bucket = votes[shapeId];
  if (!bucket) return 0;
  return Object.values(bucket).reduce((sum, n) => sum + n, 0);
};

export const myVoteCount = (votes: BoardVotes, shapeId: string, userId: number): number => {
  const bucket = votes[shapeId];
  if (!bucket) return 0;
  return bucket[String(userId)] ?? 0;
};

export const timerRemaining = (timer: BoardTimerState | null, now = Date.now()): number => {
  if (!timer) return 0;
  const elapsed = timer.elapsedMs + (timer.running && timer.startedAt ? now - timer.startedAt : 0);
  return Math.max(0, timer.durationMs - elapsed);
};

export const formatClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
