import React, { useCallback } from 'react';
import { LearnedSpells } from '../components/character/LearnedSpells';
import { LssSheetEmbed } from '../components/character/LssSheetEmbed';
import { PlayerSwitcher } from '../components/dm/PlayerSwitcher';
import { useLssSync } from '../hooks/useLssSync';
import { useCampaignStore } from '../lib/store';
import type { PlayerId } from '../lib/types';

export const CharacterPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const dmSelectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const isDm = user?.role === 'dm';
  const activePlayerId: PlayerId = isDm ? dmSelectedPlayerId : (user?.playerId ?? 1);

  const { profile, journal, learnedSpells, syncing, refreshNow, syncLssData } =
    useLssSync(activePlayerId);

  const handleSyncJson = useCallback(
    async (lssJson: unknown) => {
      if (lssJson === null || lssJson !== undefined) {
        if (lssJson !== null) await syncLssData({ lssJson });
      }
    },
    [syncLssData]
  );

  const handleResetSlot = useCallback(async () => {
    if (!window.confirm('Очистить данные персонажа в этом слоте (включая изученные заклинания)?')) {
      return;
    }
    await syncLssData({ reset: true });
    pushToast({
      title: 'Слот персонажа очищен',
      message: 'Теперь можно создать нового героя или загрузить .json из Long Story Short.',
      variant: 'info',
    });
  }, [syncLssData, pushToast]);

  if (!profile) {
    return (
      <div className="space-y-4">
        {isDm && <PlayerSwitcher />}
        <div className="glass-panel hud-corners hud-cut p-8 text-center font-mono text-xs uppercase tracking-widest text-muted">
          LOADING OPERATOR SLOT // P0{activePlayerId}...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isDm && <PlayerSwitcher />}

      <LssSheetEmbed
        key={`lss-embed-${activePlayerId}`}
        playerId={activePlayerId}
        profile={profile}
        journal={journal}
        learnedSpells={learnedSpells}
        isDm={Boolean(isDm)}
        onSyncJson={handleSyncJson}
        onResetSlot={handleResetSlot}
        onRefreshCache={refreshNow}
        syncing={syncing}
      />

      <LearnedSpells
        learnedSpells={learnedSpells}
        maxSpells={profile.maxSpells}
      />
    </div>
  );
};
