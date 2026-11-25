import React from 'react';
import { InspirationCounter } from '../components/talents/InspirationCounter';
import { TalentTree } from '../components/talents/TalentTree';
import { useCampaignStore } from '../lib/store';

export const TalentsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const inspirationPoints = useCampaignStore((s) => s.inspirationPoints);
  const nodes = useCampaignStore((s) => s.talentNodes);
  const purchases = useCampaignStore((s) => s.talentPurchases);

  return (
    <div className="space-y-5">
      <InspirationCounter
        points={inspirationPoints}
        isDm={user?.role === 'dm'}
      />

      <TalentTree
        nodes={nodes}
        purchases={purchases}
        inspirationPoints={inspirationPoints}
      />
    </div>
  );
};
