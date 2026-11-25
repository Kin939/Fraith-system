import React from 'react';
import { Eye, Shield } from 'lucide-react';
import { useCampaignStore } from '../../lib/store';
import type { PlayerId } from '../../lib/types';

export const PlayerSwitcher: React.FC = () => {
  const selectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const setSelectedPlayerId = useCampaignStore((s) => s.setDmSelectedPlayerId);
  const charactersById = useCampaignStore((s) => s.charactersById);

  const playerIds: PlayerId[] = [1, 2, 3];

  return (
    <div className="glass-panel rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3 border border-primary/30">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <div className="font-anime font-bold text-sm">Режим обзора Мастера (Read-Only)</div>
          <div className="text-xs text-muted">
            Переключайтесь между 3 игроками для просмотра их листов LSS, монет, заклинаний и дневников
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {playerIds.map((pid) => {
          const char = charactersById[pid];
          const active = selectedPlayerId === pid;
          return (
            <button
              key={pid}
              type="button"
              onClick={() => setSelectedPlayerId(pid)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 ${
                active
                  ? 'anime-btn-primary'
                  : 'bg-bg/70 border border-border text-muted hover:text-text hover:border-primary/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                Игрок {pid}
                {char?.characterName ? ` • ${char.characterName}` : ' • Пусто'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
