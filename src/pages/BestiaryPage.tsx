import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import { BestiaryDetail } from '../components/bestiary/BestiaryDetail';
import { BestiaryTile } from '../components/bestiary/BestiaryTile';
import { HudFrame } from '../components/common/HudFrame';
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
        ? `Существо «${creature.name}» открыто игрокам!`
        : `«${creature.name}» скрыто в ???`,
      message: 'Бестиарий обновлён у всех подключённых участников.',
      variant: 'info',
    });
  };

  return (
    <div className="space-y-5">
      <HudFrame
        code={`THREAT ARCHIVE // IDENTIFIED ${revealedCount}/${creatures.length}`}
        title="Бестиарий"
        subtitle="Классификация угроз по уровню опасности (CR) с динамической неоновой индикацией"
        rightSlot={
          isDm ? (
            <button
              type="button"
              onClick={() => setActiveTab('dm')}
              className="anime-btn-primary px-3.5 py-2 text-xs inline-flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Редактор бестиария (DM)</span>
            </button>
          ) : undefined
        }
      >
        <div className="hidden" aria-hidden="true" />
      </HudFrame>

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
