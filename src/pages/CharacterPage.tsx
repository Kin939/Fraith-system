import React, { useCallback } from 'react';
import { LearnedSpells } from '../components/character/LearnedSpells';
import { LssSheetEmbed } from '../components/character/LssSheetEmbed';
import { AvatarUploader } from '../components/common/AvatarUploader';
import { PlayerSwitcher } from '../components/dm/PlayerSwitcher';
import { useLssSync } from '../hooks/useLssSync';
import { useCampaignStore } from '../lib/store';
import { getSlotTheme, getUserThemeSlot } from '../lib/theme';
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
      message: 'Можно создать нового героя или импортировать .json из Long Story Short',
      variant: 'info',
    });
  }, [syncLssData, pushToast]);

  if (!profile) {
    return (
      <div className="space-y-6">
        {isDm && <PlayerSwitcher />}
        <div className="glass-panel hud-cut p-8 text-center text-sm text-muted">
          Загрузка листа игрока {activePlayerId}…
        </div>
      </div>
    );
  }

  const slotAccent = getSlotTheme(
    getUserThemeSlot({ role: 'player', playerId: activePlayerId })
  ).primary;

  return (
    <div className="space-y-6">
      {isDm && <PlayerSwitcher />}

      <AvatarUploader
        playerId={activePlayerId}
        displayName={profile.characterName || `Игрок ${activePlayerId}`}
        avatarUrl={profile.avatarUrl}
        accentColor={slotAccent}
        canEdit={isDm || user?.playerId === activePlayerId}
      />

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
