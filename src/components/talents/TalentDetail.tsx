import React, { useState } from 'react';
import { Check, CheckCircle2, Lock, Pencil, Unlock, X } from 'lucide-react';
import { HudIcon } from '../common/HudIcon';
import { apiFetch } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { useCampaignStore } from '../../lib/store';
import type { PurchasedTalent, TalentNode } from '../../lib/types';
import { FormattedText } from '../common/FormattedText';

interface TalentDetailProps {
  node: TalentNode | null;
  parentNode: TalentNode | null;
  inspirationPoints: number;
  onClose: () => void;
  onEditNode?: (node: TalentNode) => void;
}

export const TalentDetail: React.FC<TalentDetailProps> = ({
  node,
  parentNode,
  inspirationPoints,
  onClose,
  onEditNode,
}) => {
  const user = useCampaignStore((s) => s.user);
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const [buying, setBuying] = useState(false);
  const [togglingDm, setTogglingDm] = useState(false);

  if (!node) return null;

  const isDm = user?.role === 'dm';
  const isUnlocked = Boolean(node.isUnlocked);
  const prerequisiteMet = !parentNode || Boolean(parentNode.isUnlocked);
  const enoughPoints = inspirationPoints >= node.cost;

  const handleUnlockForParty = async () => {
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
        title: `Талант «${node.title}» открыт для группы!`,
        message: `Списано ${node.cost} из общего пула вдохновений.`,
        variant: 'success',
      });
      onClose();
    } catch (err) {
      pushToast({
        title: 'Открытие невозможно',
        message: err instanceof Error ? err.message : 'Ошибка открытия таланта',
        variant: 'error',
      });
    } finally {
      setBuying(false);
    }
  };

  const handleDmToggleUnlock = async () => {
    setTogglingDm(true);
    try {
      const res = await apiFetch<{
        inspirationPoints: number;
        nodes: TalentNode[];
        purchases: PurchasedTalent[];
      }>(`/api/dm/talents/${node.id}/toggle-unlock`, {
        method: 'POST',
      });
      setTalentsBundle(res);
      pushToast({
        title: isUnlocked
          ? `Талант «${node.title}» снова закрыт`
          : `Талант «${node.title}» открыт Мастером`,
        message: 'Статус таланта синхронизирован у всех игроков.',
        variant: 'info',
      });
      onClose();
    } catch (err) {
      pushToast({
        title: 'Ошибка переключения статуса',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setTogglingDm(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel neon-border hud-corners hud-cut max-w-md w-full p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <img
              src={resolveImageUrl(node.imageKey, 'spark')}
              alt={node.title}
              className="w-16 h-16 object-cover border border-primary bg-[#070B14]"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-0.5 bg-primary/15 text-primary border border-primary/50 tabular-nums">
                <HudIcon asset="spark" size="xs" />
                <span>COST // {node.cost}</span>
              </div>
              <h3 className="font-anime font-extrabold text-xl uppercase mt-1">{node.title}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border border-primary/30 text-muted hover:text-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <FormattedText
          text={node.description || 'Описание таланта не указано.'}
          className="text-sm text-text/95"
        />

        {parentNode && (
          <div className="p-3 bg-[#070B14]/80 border border-primary/25 text-xs flex items-center justify-between gap-2">
            <span className="text-muted">Требуемый узел:</span>
            <span
              className={`font-semibold inline-flex items-center gap-1 ${
                parentNode.isUnlocked ? 'text-emerald-300' : 'text-primary'
              }`}
            >
              <span>{parentNode.title}</span>
              {parentNode.isUnlocked && <Check className="w-3.5 h-3.5" />}
            </span>
          </div>
        )}

        {/* Shared Party Action */}
        {isUnlocked ? (
          <div className="w-full py-3 bg-primary/15 border border-primary text-primary font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Талант открыт для всей группы</span>
          </div>
        ) : !prerequisiteMet ? (
          <div className="w-full py-3 bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            <span>Сначала откройте «{parentNode?.title}»</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={buying || !enoughPoints}
            onClick={() => void handleUnlockForParty()}
            className="anime-btn-primary w-full py-3 text-xs flex items-center justify-center gap-2"
          >
            <HudIcon asset="spark" size="xs" />
            <span>
              {buying
                ? 'Активация...'
                : enoughPoints
                  ? `Открыть для всей группы (${node.cost})`
                  : `Не хватает вдохновений (${inspirationPoints}/${node.cost})`}
            </span>
          </button>
        )}

        {isDm && (
          <div className="pt-3 border-t border-primary/25 flex items-center justify-between gap-2">
            {onEditNode && (
              <button
                type="button"
                onClick={() => {
                  const target = node;
                  onClose();
                  onEditNode(target);
                }}
                className="flex-1 py-2 px-3 bg-[#070B14] border border-primary/30 hover:border-primary text-xs font-semibold text-muted hover:text-text inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-primary" />
                <span>Изменить</span>
              </button>
            )}

            <button
              type="button"
              disabled={togglingDm}
              onClick={() => void handleDmToggleUnlock()}
              className="flex-1 py-2 px-3 bg-[#070B14] border border-primary/30 hover:border-primary text-xs font-semibold text-muted hover:text-primary inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              {isUnlocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isUnlocked ? 'Закрыть (DM)' : 'Открыть бесплатно'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
