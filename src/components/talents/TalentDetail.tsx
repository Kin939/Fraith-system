import React, { useState } from 'react';
import { CheckCircle2, Lock, Sparkles, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { useCampaignStore } from '../../lib/store';
import type { PlayerId, PurchasedTalent, TalentNode } from '../../lib/types';

interface TalentDetailProps {
  node: TalentNode | null;
  parentNode: TalentNode | null;
  inspirationPoints: number;
  purchases: PurchasedTalent[];
  onClose: () => void;
}

export const TalentDetail: React.FC<TalentDetailProps> = ({
  node,
  parentNode,
  inspirationPoints,
  purchases,
  onClose,
}) => {
  const user = useCampaignStore((s) => s.user);
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [buying, setBuying] = useState(false);

  if (!node) return null;

  const isPlayer = user?.role === 'player' && user.playerId !== null;
  const currentPlayerId = user?.playerId ?? null;

  const owners: PlayerId[] = purchases
    .filter((p) => p.talentId === node.id)
    .map((p) => p.playerId);

  const ownedByMe = currentPlayerId ? owners.includes(currentPlayerId) : false;
  const prerequisiteMet =
    !parentNode ||
    !currentPlayerId ||
    purchases.some((p) => p.playerId === currentPlayerId && p.talentId === parentNode.id);

  const enoughPoints = inspirationPoints >= node.cost;

  const handlePurchase = async () => {
    setBuying(true);
    try {
      const res = await apiFetch<{
        inspirationPoints: number;
        nodes: TalentNode[];
        purchases: PurchasedTalent[];
      }>(`/api/talents/${node.id}/purchase`, {
        method: 'POST',
      });
      setTalentsBundle(res);
      pushToast({
        title: `Талант «${node.title}» открыт!`,
        message: `Списано ${node.cost} ✦ из общего пула вдохновений.`,
        variant: 'success',
      });
      onClose();
    } catch (err) {
      pushToast({
        title: 'Покупка невозможна',
        message: err instanceof Error ? err.message : 'Ошибка покупки таланта',
        variant: 'error',
      });
    } finally {
      setBuying(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel neon-border rounded-3xl max-w-md w-full p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <img
              src={resolveImageUrl(node.imageKey, '✦')}
              alt={node.title}
              className="w-16 h-16 rounded-2xl object-cover border border-primary"
            />
            <div>
              <div className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-accent/20 text-accent border border-accent/40">
                <Sparkles className="w-3.5 h-3.5" />
                Стоимость: {node.cost} ✦
              </div>
              <h3 className="font-anime font-extrabold text-xl mt-1">{node.title}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-border text-muted hover:text-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-text/95 leading-relaxed whitespace-pre-line">
          {node.description}
        </p>

        {parentNode && (
          <div className="p-3 rounded-2xl bg-bg/60 border border-border text-xs flex items-center justify-between">
            <span className="text-muted">Требуемый родительский узел:</span>
            <span className="font-semibold text-primary">{parentNode.title}</span>
          </div>
        )}

        <div className="p-3 rounded-2xl bg-bg/50 border border-border text-xs flex items-center justify-between">
          <span className="text-muted">Открыто у игроков:</span>
          <span className="font-semibold">
            {owners.length > 0 ? owners.map((id) => `Игрок ${id}`).join(', ') : 'Никто ещё не открыл'}
          </span>
        </div>

        {/* Action Button for Player */}
        {isPlayer ? (
          ownedByMe ? (
            <div className="w-full py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Талант уже приобретён вашим персонажем
            </div>
          ) : !prerequisiteMet ? (
            <div className="w-full py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              Сначала изучите «{parentNode?.title}»
            </div>
          ) : (
            <button
              type="button"
              disabled={buying || !enoughPoints}
              onClick={handlePurchase}
              className="anime-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {buying
                  ? 'Покупка...'
                  : enoughPoints
                    ? `Купить навык за ${node.cost} ✦`
                    : `Не хватает вдохновений (${inspirationPoints}/${node.cost} ✦)`}
              </span>
            </button>
          )
        ) : (
          <div className="text-xs text-muted text-center">
            Режим Мастера: редактирование узлов доступно во вкладке «Мастер».
          </div>
        )}
      </div>
    </div>
  );
};
