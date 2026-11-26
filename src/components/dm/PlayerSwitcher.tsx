import React from 'react';
import { useCampaignStore } from '../../lib/store';
import { PlayerSwitcherCards } from './PlayerSwitcherCards';

export { PlayerSwitcherCards } from './PlayerSwitcherCards';

export const PlayerSwitcher: React.FC = () => {
  const selectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const setSelectedPlayerId = useCampaignStore((s) => s.setDmSelectedPlayerId);
  const charactersById = useCampaignStore((s) => s.charactersById);

  return (
    <PlayerSwitcherCards
      selectedPlayerId={selectedPlayerId}
      onSelectPlayerId={setSelectedPlayerId}
      charactersById={charactersById}
    />
  );
};
