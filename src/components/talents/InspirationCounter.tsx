import React, { useState } from 'react';
import { Minus, Plus, Sparkles } from 'lucide-react';
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
        title: delta > 0 ? `+${delta} Вдохновения группе!` : `${delta} Вдохновения`,
        message: `Текущий общий пул вдохновений: ${res.inspirationPoints} ✦`,
        variant: 'info',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel neon-border rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl anime-btn-primary flex items-center justify-center shadow-neon">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-accent font-bold">
            Общий пул вдохновений отряда
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-anime font-extrabold text-3xl text-text">{points}</span>
            <span className="text-xs text-muted">
              очков доступно без верхнего лимита • тратится персонально каждым игроком на покупку талантов
            </span>
          </div>
        </div>
      </div>

      {isDm && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted mr-1">Выдать (DM):</span>
          <button
            type="button"
            disabled={busy || points === 0}
            onClick={() => adjustPoints(-1)}
            className="px-3 py-2 rounded-xl border border-border bg-bg/70 hover:border-rose-400 text-xs font-bold inline-flex items-center gap-1"
          >
            <Minus className="w-3.5 h-3.5" />1
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => adjustPoints(1)}
            className="anime-btn-primary px-3.5 py-2 text-xs inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />1 ✦
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => adjustPoints(3)}
            className="px-3.5 py-2 rounded-xl bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30 text-xs font-bold"
          >
            +3 ✦
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => adjustPoints(5)}
            className="px-3.5 py-2 rounded-xl bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 text-xs font-bold"
          >
            +5 ✦
          </button>
        </div>
      )}
    </div>
  );
};
