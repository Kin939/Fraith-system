import React, { useState } from 'react';
import { Check, CheckCircle2, Lock, Pencil, Star, Unlock, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { questEmblemUrl, talentAccentFallback, tileCssVars } from '../../lib/questStyle';
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
  const featured = Boolean(node.tileStyle?.isImportant);
  const accent = node.tileStyle?.accent || talentAccentFallback(node.tileStyle);
  const emblemUrl = questEmblemUrl(node.tileStyle?.emblem);
  const artUrl = node.imageKey ? resolveImageUrl(node.imageKey, 'spark') : emblemUrl;
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
        title: `Талант «${node.title}» открыт для группы`,
        message: `Списано ${node.cost} из общего пула вдохновения`,
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
        message: 'Статус таланта синхронизирован у всех игроков',
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
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={tileCssVars(node.tileStyle, accent)}
        className={`glass-panel hud-cut max-w-md w-full p-6 space-y-5 shadow-glass relative ${
          featured ? 'quest-tile--important' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <span
              className="w-16 h-16 border bg-deep shrink-0 overflow-hidden flex items-center justify-center"
              style={{ borderColor: `${accent}66` }}
            >
              {artUrl ? (
                <img
                  src={artUrl}
                  alt={node.title}
                  className={`w-full h-full ${node.imageKey ? 'object-cover' : 'object-contain p-2'}`}
                />
              ) : (
                <Star className="w-6 h-6" strokeWidth={1.4} style={{ color: accent }} />
              )}
            </span>
            <div>
              <span className="hud-keycap">Стоимость: {node.cost}</span>
              <h3 className="font-medium text-lg text-text mt-1.5">{node.title}</h3>
              {featured && (
                <span
                  className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] tracking-wide border"
                  style={{ borderColor: `${accent}99`, color: accent }}
                >
                  <Star className="w-2.5 h-2.5" strokeWidth={2} fill="currentColor" />
                  КЛЮЧЕВОЙ ТАЛАНТ
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 border border-border bg-bg text-muted hover:text-text flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <FormattedText
          text={node.description || 'Описание таланта не указано'}
          className="text-sm text-secondary"
        />

        {parentNode && (
          <div className="p-3 bg-bg border border-border text-xs flex items-center justify-between gap-2">
            <span className="text-muted">Требуемый узел:</span>
            <span
              className={`font-medium inline-flex items-center gap-1 ${
                parentNode.isUnlocked ? 'text-positive' : 'text-text'
              }`}
            >
              <span>{parentNode.title}</span>
              {parentNode.isUnlocked && <Check className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </span>
          </div>
        )}

        {isUnlocked ? (
          <div className="w-full h-10 bg-positive/10 border border-positive/30 text-positive font-medium text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
            <span>Талант открыт для всей группы</span>
          </div>
        ) : !prerequisiteMet ? (
          <div className="w-full p-3 bg-bg border border-border text-muted text-xs flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>Сначала откройте «{parentNode?.title}»</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={buying || !enoughPoints}
            onClick={() => void handleUnlockForParty()}
            className="anime-btn-primary w-full h-10 text-xs flex items-center justify-center gap-2"
          >
            <span>
              {buying
                ? 'Активация…'
                : enoughPoints
                  ? `Открыть для всей группы (${node.cost})`
                  : `Не хватает вдохновения (${inspirationPoints} из ${node.cost})`}
            </span>
          </button>
        )}

        {isDm && (
          <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
            {onEditNode && (
              <button
                type="button"
                onClick={() => {
                  const target = node;
                  onClose();
                  onEditNode(target);
                }}
                className="flex-1 h-9 px-3 bg-bg border border-border hover:border-text/20 text-xs text-secondary hover:text-text inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
                <span>Изменить</span>
              </button>
            )}

            <button
              type="button"
              disabled={togglingDm}
              onClick={() => void handleDmToggleUnlock()}
              className="flex-1 h-9 px-3 bg-bg border border-border hover:border-text/20 text-xs text-secondary hover:text-text inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              {isUnlocked ? (
                <Lock className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              )}
              <span>{isUnlocked ? 'Закрыть (Мастер)' : 'Открыть бесплатно'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
