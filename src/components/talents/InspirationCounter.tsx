import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { HudIcon } from '../common/HudIcon';
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
  const [pulsing, setPulsing] = useState(false);
  const prevPointsRef = useRef(points);

  useEffect(() => {
    if (prevPointsRef.current !== points) {
      prevPointsRef.current = points;
      setPulsing(true);
      const timer = window.setTimeout(() => setPulsing(false), 420);
      return () => window.clearTimeout(timer);
    }
  }, [points]);

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
        title: delta > 0 ? `+${delta} Вдохновения группе` : `${delta} Вдохновения`,
        message: `Общий пул вдохновений отряда: ${res.inspirationPoints}`,
        variant: 'info',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`glass-panel neon-border hud-corners hud-cut p-5 flex flex-wrap items-center justify-between gap-4 ${
        pulsing ? 'hud-pulse-once' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-[#070B14] border border-primary/60 shadow-rim flex items-center justify-center shrink-0">
          <HudIcon asset="spark" size="xl" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary font-bold">
            PARTY RESONANCE // ОБЩИЕ ВДОХНОВЕНИЯ
          </div>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span
              className={`font-mono font-extrabold text-4xl leading-none tabular-nums transition-all duration-200 ${
                pulsing
                  ? 'text-primary drop-shadow-[0_0_18px_var(--primary)] scale-105'
                  : 'text-text drop-shadow-[0_0_10px_var(--glow)]'
              }`}
            >
              {String(points).padStart(2, '0')}
            </span>
            <span className="text-xs text-muted">
              очков доступно отряду • открывает узлы дерева талантов для всей группы
            </span>
          </div>
        </div>
      </div>

      {isDm && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted mr-1">
            DM GRANT //
          </span>
          <button
            type="button"
            disabled={busy || points === 0}
            onClick={() => adjustPoints(-1)}
            className="px-3 py-2 border border-primary/30 bg-[#070B14] hover:border-rose-400 text-xs font-mono font-bold inline-flex items-center gap-1 tabular-nums"
          >
            <Minus className="w-3.5 h-3.5" />1
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => adjustPoints(1)}
            className="anime-btn-primary px-3.5 py-2 text-xs font-mono inline-flex items-center gap-1.5 tabular-nums"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>1</span>
            <HudIcon asset="spark" size="xs" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => adjustPoints(3)}
            className="hud-btn-secondary px-3.5 py-2 text-xs font-mono font-bold inline-flex items-center gap-1 tabular-nums"
          >
            <span>+3</span>
            <HudIcon asset="spark" size="xs" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => adjustPoints(5)}
            className="px-3.5 py-2 bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 text-xs font-mono font-bold inline-flex items-center gap-1 tabular-nums"
          >
            <span>+5</span>
            <HudIcon asset="spark" size="xs" />
          </button>
        </div>
      )}
    </div>
  );
};
