import React from 'react';
import { EyeOff, ShieldAlert, Skull } from 'lucide-react';
import { conditionLabel, type CombatEffect } from '../../lib/combatProtocol';

interface EffectChipProps {
  effect: CombatEffect;
  canRemove?: boolean;
  onRemove?: (effectId: string) => void;
}

const durationLabel = (effect: CombatEffect): string | null => {
  if (effect.durationType === 'rounds' && effect.durationValue != null) {
    return `${effect.durationValue} р.`;
  }
  if (effect.durationType === 'until_save') return 'до спасброска';
  if (effect.durationType === 'until_removed') return 'до снятия';
  if (effect.durationType === 'permanent') return 'постоянно';
  return null;
};

/** Компактный чип состояния/эффекта с подсказкой из справочника 5e. */
export const EffectChip: React.FC<EffectChipProps> = ({ effect, canRemove = false, onRemove }) => {
  const isExhaustion = effect.effectType === 'exhaustion';
  const title = [
    isExhaustion ? `Истощение ${effect.exhaustionLevel}` : conditionLabel(effect.effectName),
    effect.description,
    durationLabel(effect) ? `Длительность: ${durationLabel(effect)}` : '',
    effect.isVisibleToPlayers ? '' : 'Скрыто от игроков',
  ]
    .filter(Boolean)
    .join('\n');

  const Icon = isExhaustion ? Skull : effect.isVisibleToPlayers ? ShieldAlert : EyeOff;
  const tone = isExhaustion
    ? 'border-negative/60 text-negative bg-negative/10'
    : effect.isVisibleToPlayers
      ? 'border-warning/50 text-warning bg-warning/10'
      : 'border-border text-muted bg-raised/60';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 h-5 pl-1 pr-1.5 border text-[10px] ${tone}`}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate max-w-[9rem]">
        {isExhaustion ? `Истощение ${effect.exhaustionLevel}` : conditionLabel(effect.effectName)}
      </span>
      {effect.durationType === 'rounds' && effect.durationValue != null && (
        <span className="font-mono text-[9px] opacity-80">{effect.durationValue}р</span>
      )}
      {canRemove && onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(effect.id);
          }}
          className="ml-0.5 text-[10px] leading-none opacity-60 hover:opacity-100"
          title="Снять эффект"
        >
          ✕
        </button>
      )}
    </span>
  );
};
