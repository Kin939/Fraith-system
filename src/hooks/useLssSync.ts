import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useCampaignStore } from '../lib/store';
import type {
  CharacterCoins,
  CharacterProfile,
  JournalEntry,
  LearnedSpellRecord,
  PlayerId,
} from '../lib/types';

export function useLssSync(playerId: PlayerId, pollIntervalMs = 30000) {
  const profile = useCampaignStore((s) => s.charactersById[playerId] ?? null);
  const journal = useCampaignStore((s) => s.journalsById[playerId] ?? null);
  const learnedSpells = useCampaignStore((s) => s.learnedSpellsById[playerId] ?? []);
  const setCharacterBundle = useCampaignStore((s) => s.setCharacterBundle);
  const updateCharacterProfileInStore = useCampaignStore((s) => s.updateCharacterProfileInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [syncing, setSyncing] = useState(false);

  const fetchFullPlayerBundle = useCallback(async () => {
    setSyncing(true);
    try {
      const data = await apiFetch<{
        profile: CharacterProfile | null;
        journal: JournalEntry;
        learnedSpells: LearnedSpellRecord[];
      }>(`/api/player/${playerId}`);
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
  }, [playerId, setCharacterBundle, pushToast]);

  const pollCachedProfile = useCallback(async () => {
    try {
      const res = await apiFetch<{ profile: CharacterProfile | null }>(
        `/api/player/${playerId}/lss-cache`
      );
      if (res.profile) {
        updateCharacterProfileInStore(playerId, res.profile);
      }
    } catch {
      // Silent background poll
    }
  }, [playerId, updateCharacterProfileInStore]);

  // Initial fetch on player switch + periodic fallback polling
  useEffect(() => {
    void fetchFullPlayerBundle();
    if (pollIntervalMs <= 0) return;
    const timer = window.setInterval(() => {
      void pollCachedProfile();
    }, pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [fetchFullPlayerBundle, pollCachedProfile, pollIntervalMs]);

  const syncLssData = useCallback(
    async (payload: {
      lssJson?: unknown;
      lssEmbedUrl?: string;
      hpCurrent?: number;
      hpMax?: number;
      hpTemp?: number;
      coins?: Partial<CharacterCoins>;
      lssNotes?: string;
    }) => {
      setSyncing(true);
      try {
        const res = await apiFetch<{ profile: CharacterProfile }>(
          `/api/player/${playerId}/sync-lss`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
        updateCharacterProfileInStore(playerId, res.profile);
        return res.profile;
      } finally {
        setSyncing(false);
      }
    },
    [playerId, updateCharacterProfileInStore]
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
