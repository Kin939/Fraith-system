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

/** Чип состояния/эффекта с подсказкой из справочника 5e. */
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
      className={`inline-flex items-center gap-1.5 h-7 pl-2 pr-2 border text-xs leading-none ${tone}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate max-w-[11rem]">
        {isExhaustion ? `Истощение ${effect.exhaustionLevel}` : conditionLabel(effect.effectName)}
      </span>
      {durationLabel(effect) && (
        <span className="font-mono text-[10px] opacity-80 shrink-0">{durationLabel(effect)}</span>
      )}
      {canRemove && onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(effect.id);
          }}
          className="ml-0.5 w-5 h-5 flex items-center justify-center text-xs leading-none opacity-70 hover:opacity-100 hover:text-negative"
          title="Снять эффект"
        >
          ✕
        </button>
      )}
    </span>
  );
};
