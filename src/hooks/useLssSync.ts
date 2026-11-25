import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useCampaignStore } from '../lib/store';
import {
  beginSheetNetworkSync,
  endSheetNetworkSync,
  isSheetLocallyBusy,
} from '../lib/syncTracker';
import type {
  CharacterCoins,
  CharacterProfile,
  JournalEntry,
  LearnedSpellRecord,
  PlayerId,
} from '../lib/types';

const EMPTY_LEARNED_SPELLS: LearnedSpellRecord[] = [];

export function useLssSync(playerId: PlayerId, pollIntervalMs = 45000) {
  const profile = useCampaignStore((s) => s.charactersById[playerId] ?? null);
  const journal = useCampaignStore((s) => s.journalsById[playerId] ?? null);
  const learnedSpells = useCampaignStore(
    (s) => s.learnedSpellsById[playerId] ?? EMPTY_LEARNED_SPELLS
  );
  const setCharacterBundle = useCampaignStore((s) => s.setCharacterBundle);
  const updateCharacterProfileInStore = useCampaignStore((s) => s.updateCharacterProfileInStore);
  const mergeCharacterMetadataInStore = useCampaignStore((s) => s.mergeCharacterMetadataInStore);
  const updateLearnedSpellsInStore = useCampaignStore((s) => s.updateLearnedSpellsInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [syncing, setSyncing] = useState(false);

  const fetchFullPlayerBundle = useCallback(async () => {
    if (isSheetLocallyBusy(playerId)) return;
    setSyncing(true);
    try {
      const data = await apiFetch<{
        profile: CharacterProfile | null;
        journal: JournalEntry;
        learnedSpells: LearnedSpellRecord[];
      }>(`/api/player/${playerId}`);
      if (isSheetLocallyBusy(playerId)) {
        if (data.profile) {
          mergeCharacterMetadataInStore(playerId, data.profile);
        }
        return;
      }
      setCharacterBundle(playerId, data);
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки листа',
        message: err instanceof Error ? err.message : 'Не удалось получить данные персонажа',
        variant: 'error',
      });
    } finally {
      setSyncing(false);
    }
  }, [playerId, setCharacterBundle, mergeCharacterMetadataInStore, pushToast]);

  const pollCachedProfile = useCallback(async () => {
    // Skip redundant HTTP polling while WebSocket is live or user is editing locally
    if (useCampaignStore.getState().wsConnected) return;
    if (isSheetLocallyBusy(playerId)) return;
    try {
      const res = await apiFetch<{ profile: CharacterProfile | null }>(
        `/api/player/${playerId}/lss-cache`
      );
      if (res.profile && !isSheetLocallyBusy(playerId)) {
        updateCharacterProfileInStore(playerId, res.profile);
      }
    } catch {
      // Silent background fallback poll
    }
  }, [playerId, updateCharacterProfileInStore]);

  // Initial fetch on player switch (only if not already loaded in bootstrap!) + fallback poll
  useEffect(() => {
    const alreadyLoaded = Boolean(useCampaignStore.getState().charactersById[playerId]);
    if (!alreadyLoaded) {
      void fetchFullPlayerBundle();
    }
    if (pollIntervalMs <= 0) return;
    const timer = window.setInterval(() => {
      void pollCachedProfile();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [playerId, fetchFullPlayerBundle, pollCachedProfile, pollIntervalMs]);

  const syncLssData = useCallback(
    async (
      payload: {
        lssJson?: unknown;
        lssEmbedUrl?: string;
        hpCurrent?: number;
        hpMax?: number;
        hpTemp?: number;
        coins?: Partial<CharacterCoins>;
        lssNotes?: string;
        reset?: boolean;
      },
      options?: { background?: boolean; serializedRawJson?: string }
    ) => {
      const isBackground = Boolean(options?.background);
      if (!isBackground) setSyncing(true);
      beginSheetNetworkSync(playerId, options?.serializedRawJson);
      let caughtUp = true;
      try {
        const res = await apiFetch<{ profile: CharacterProfile }>(
          `/api/player/${playerId}/sync-lss`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        if (payload.reset) {
          updateCharacterProfileInStore(playerId, res.profile);
          updateLearnedSpellsInStore(playerId, []);
        } else if (isBackground) {
          // Only update metadata in store during background sheet syncs so we NEVER trigger
          // a stale rawLssJson prop bounce while the user is clicking/typing!
          mergeCharacterMetadataInStore(playerId, res.profile);
        } else {
          updateCharacterProfileInStore(playerId, res.profile);
        }
        return res.profile;
      } catch (err) {
        caughtUp = false;
        throw err;
      } finally {
        endSheetNetworkSync(playerId, caughtUp);
        if (!isBackground) setSyncing(false);
      }
    },
    [playerId, updateCharacterProfileInStore, mergeCharacterMetadataInStore, updateLearnedSpellsInStore]
  );

  return {
    profile,
    journal,
    learnedSpells,
    syncing,
    refreshNow: fetchFullPlayerBundle,
    syncLssData,
  };
}
