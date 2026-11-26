import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import { BestiaryDetail } from '../components/bestiary/BestiaryDetail';
import { BestiaryTile } from '../components/bestiary/BestiaryTile';
import { apiFetch } from '../lib/api';
import { useCampaignStore } from '../lib/store';
import type { BestiaryCreature } from '../lib/types';

export const BestiaryPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const creatures = useCampaignStore((s) => s.bestiary);
  const setBestiary = useCampaignStore((s) => s.setBestiary);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [selectedCreature, setSelectedCreature] = useState<BestiaryCreature | null>(null);

  const isDm = user?.role === 'dm';
  const revealedCount = creatures.filter((c) => c.isRevealed).length;

  const handleToggleReveal = async (creature: BestiaryCreature) => {
    if (!isDm) return;
    const res = await apiFetch<{ creatures: BestiaryCreature[] }>(
      `/api/dm/bestiary/${creature.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          ...creature,
          isRevealed: !creature.isRevealed,
        }),
      }
    );
    setBestiary(res.creatures);
    pushToast({
      title: !creature.isRevealed
        ? `Существо «${creature.name}» открыто игрокам`
        : `Существо «${creature.name}» скрыто`,
      message: 'Бестиарий обновлён у всех участников за столом',
      variant: 'info',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-medium text-2xl text-text">Бестиарий</h1>
            <span className="font-mono text-xs text-muted tabular-nums">
              Открыто {revealedCount} из {creatures.length}
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            Существа и противники, с которыми столкнулся отряд
          </p>
        </div>

        {isDm && (
          <button
            type="button"
            onClick={() => setActiveTab('dm')}
            className="hud-btn-secondary h-10 px-4 text-xs inline-flex items-center gap-2"
          >
            <Crown className="w-4 h-4 text-muted" strokeWidth={1.5} />
            <span>Редактор бестиария</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {creatures.map((creature) => (
          <BestiaryTile
            key={creature.id}
            creature={creature}
            isDm={Boolean(isDm)}
            onSelect={setSelectedCreature}
            onToggleReveal={isDm ? handleToggleReveal : undefined}
          />
        ))}
      </div>

      <BestiaryDetail
        creature={selectedCreature}
        onClose={() => setSelectedCreature(null)}
      />
    </div>
  );
};
