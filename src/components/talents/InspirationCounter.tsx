import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { PurchasedTalent, TalentNode } from '../../lib/types';

interface InspirationCounterProps {
  points: number;
  isDm: boolean;
}

export const InspirationCounter: React.FC<InspirationCounterProps> = ({ points, isDm }) => {
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const adjustPoints = async (delta: number) => {
    setBusy(true);
    try {
      const res = await apiFetch<{
        inspirationPoints: number;
        nodes: TalentNode[];
        purchases: PurchasedTalent[];
      }>('/api/dm/inspiration', {
        method: 'POST',
        body: JSON.stringify({ delta }),
      });
      setTalentsBundle(res);
      pushToast({
        title: delta > 0 ? `+${delta} вдохновения отряду` : `${delta} вдохновения`,
        message: `Общий пул вдохновения: ${res.inspirationPoints}`,
        variant: 'info',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel hud-cut p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="text-xs text-muted">Общий пул вдохновения</div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono font-semibold text-3xl leading-none text-text tabular-nums">
            {points}
          </span>
          <span className="text-sm text-secondary">
            очков доступно отряду для открытия талантов
          </span>
        </div>
      </div>

      {isDm && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy || points === 0}
            onClick={() => void adjustPoints(-1)}
            className="w-9 h-9 border border-border bg-bg hover:bg-raised text-secondary hover:text-text flex items-center justify-center disabled:opacity-40 transition-colors"
            title="Снять 1 очко"
          >
            <Minus className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void adjustPoints(1)}
            className="anime-btn-primary h-9 px-3.5 text-xs font-mono inline-flex items-center gap-1 tabular-nums"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            <span>1</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void adjustPoints(3)}
            className="hud-btn-secondary h-9 px-3 text-xs font-mono tabular-nums"
          >
            +3
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void adjustPoints(5)}
            className="hud-btn-secondary h-9 px-3 text-xs font-mono tabular-nums"
          >
            +5
          </button>
        </div>
      )}
    </div>
  );
};
