import type { PlayerId } from './types';

interface SlotSyncMeta {
  inFlightCount: number;
  pendingLocalChanges: boolean;
  lastLocalEditAt: number;
  lastSentRawJson: string | null;
}

const sheetTracker: Record<PlayerId, SlotSyncMeta> = {
  1: { inFlightCount: 0, pendingLocalChanges: false, lastLocalEditAt: 0, lastSentRawJson: null },
  2: { inFlightCount: 0, pendingLocalChanges: false, lastLocalEditAt: 0, lastSentRawJson: null },
  3: { inFlightCount: 0, pendingLocalChanges: false, lastLocalEditAt: 0, lastSentRawJson: null },
};

const journalDirty: Record<PlayerId, { dirty: boolean; lastLocalEditAt: number }> = {
  1: { dirty: false, lastLocalEditAt: 0 },
  2: { dirty: false, lastLocalEditAt: 0 },
  3: { dirty: false, lastLocalEditAt: 0 },
};

const RECENT_EDIT_GRACE_MS = 2800;

export function markSheetLocalEdit(playerId: PlayerId): void {
  const m = sheetTracker[playerId];
  m.pendingLocalChanges = true;
  m.lastLocalEditAt = Date.now();
}

export function clearSheetPendingIfIdle(playerId: PlayerId): void {
  const m = sheetTracker[playerId];
  if (m.inFlightCount === 0) {
    m.pendingLocalChanges = false;
  }
}

export function beginSheetNetworkSync(playerId: PlayerId, serializedRawJson?: string): void {
  const m = sheetTracker[playerId];
  m.inFlightCount += 1;
  if (serializedRawJson !== undefined) {
    m.lastSentRawJson = serializedRawJson;
  }
}

export function endSheetNetworkSync(playerId: PlayerId, allCaughtUp: boolean): void {
  const m = sheetTracker[playerId];
  m.inFlightCount = Math.max(0, m.inFlightCount - 1);
  if (allCaughtUp && m.inFlightCount === 0) {
    m.pendingLocalChanges = false;
  }
}

export function getLastSentSheetRawJson(playerId: PlayerId): string | null {
  return sheetTracker[playerId].lastSentRawJson;
}

export function isSheetLocallyBusy(playerId: PlayerId): boolean {
  const m = sheetTracker[playerId];
  if (m.pendingLocalChanges || m.inFlightCount > 0) return true;
  if (Date.now() - m.lastLocalEditAt < RECENT_EDIT_GRACE_MS) return true;
  return false;
}

export function markJournalDirtyState(playerId: PlayerId, dirty: boolean): void {
  journalDirty[playerId].dirty = dirty;
  if (dirty) {
    journalDirty[playerId].lastLocalEditAt = Date.now();
  }
}

export function isJournalLocallyBusy(playerId: PlayerId): boolean {
  const j = journalDirty[playerId];
  if (j.dirty) return true;
  if (Date.now() - j.lastLocalEditAt < RECENT_EDIT_GRACE_MS) return true;
  return false;
}
