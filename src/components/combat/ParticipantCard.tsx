import React, { useState } from 'react';
import { ChevronRight, Crown, Ghost, Lock, Shield, Skull, SlidersHorizontal } from 'lucide-react';
import { hpTone, type CombatParticipantView } from '../../lib/combatProtocol';
import type { CombatParticipantPatch } from '../../lib/combat';
import { EffectChip } from './EffectChip';
import { DeathSaveTracker } from './DeathSaveTracker';
import { ExhaustionTracker } from './ExhaustionTracker';

export interface ParticipantCardHandlers {
  onHpDelta: (participantId: string, delta: number) => void;
  onSetHp: (participantId: string, value: number, maxHp?: number) => void;
  onSetTempHp: (participantId: string, value: number) => void;
  onSetInitiative: (participantId: string, value: number) => void;
  onUpdate: (participantId: string, patch: CombatParticipantPatch) => void;
  onAddEffect: (
    participantId: string,
    input: {
      effectName: string;
      effectType?: 'condition' | 'custom';
      durationType?: 'rounds' | 'until_save' | 'until_removed' | 'permanent' | null;
      durationValue?: number | null;
      description?: string;
      isVisibleToPlayers?: boolean;
    }
  ) => void;
  onRemoveEffect: (effectId: string) => void;
  onExhaustion: (participantId: string, level: number) => void;
  onDeathSave: (participantId: string, kind: 'success' | 'failure') => void;
  onStabilize: (participantId: string, stable: boolean) => void;
  onRemove: (participantId: string) => void;
  onOpenEditor: (participantId: string) => void;
}

interface ParticipantCardProps {
  participant: CombatParticipantView;
  isDm: boolean;
  readOnly: boolean;
  handlers: ParticipantCardHandlers;
  index: number;
}

const toneClass: Record<'positive' | 'warning' | 'negative', { bar: string; text: string }> = {
  positive: { bar: 'bg-positive', text: 'text-positive' },
  warning: { bar: 'bg-warning', text: 'text-warning' },
  negative: { bar: 'bg-negative', text: 'text-negative' },
};

const Badge: React.FC<{ children: React.ReactNode; tone: 'primary' | 'negative' | 'warning' | 'muted' }> = ({
  children,
  tone,
}) => {
  const map = {
    primary: 'border-primary/50 text-primary',
    negative: 'border-negative/60 text-negative',
    warning: 'border-warning/60 text-warning',
    muted: 'border-secondary/50 text-secondary',
  } as const;
  return (
    <span className={`shrink-0 px-1.5 h-5 inline-flex items-center text-[10px] font-mono uppercase tracking-wide border ${map[tone]}`}>
      {children}
    </span>
  );
};

/**
 * Карточка участника трекера инициативы.
 *
 * Крупные читаемые числа и кнопки: мастер ведёт бой мышью за секунды,
 * игрок видит только разрешённые сервером поля. Полная правка (AC, видимость,
 * эффекты, заметки) — в отдельном редакторе, чтобы карточка не превращалась
 * в форму.
 */
export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isDm,
  readOnly,
  handlers,
  index,
}) => {
  const [hpInput, setHpInput] = useState('');
  const concealed = !isDm && (participant.isHiddenFromPlayers || participant.hideName);
  const tone = participant.maxHp ? hpTone(participant.currentHp ?? 0, participant.maxHp) : 'negative';
  const colors = toneClass[tone];
  const hasNumbers = participant.currentHp != null && participant.maxHp != null;
  const hasBar = participant.hpPercent != null;
  const isMonster = participant.participantType === 'monster';
  const visibleEffects = participant.effects.filter((effect) => effect.effectType !== 'exhaustion');
  const showDeathSaves =
    Boolean(participant.deathSaves) &&
    (isDm
      ? (participant.currentHp ?? 1) <= 0 ||
        (participant.deathSaves?.successes ?? 0) > 0 ||
        (participant.deathSaves?.failures ?? 0) > 0 ||
        Boolean(participant.deathSaves?.stable)
      : true);

  const applyHp = (delta: number) => {
    if (!delta) return;
    handlers.onHpDelta(participant.id, delta);
  };

  return (
    <article
      className={`relative border bg-deep/70 backdrop-blur-sm transition-colors duration-150 ${
        participant.isCurrent
          ? 'border-primary/70 shadow-[0_0_26px_rgba(34,211,238,0.20)]'
          : 'border-border hover:border-primary/30'
      }`}
    >
      {participant.isCurrent && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_14px_rgba(34,211,238,0.9)]" />}

      <div className="flex gap-3 p-3">
        <div className="flex flex-col items-center gap-1 shrink-0 w-10 pt-0.5">
          <span className="text-[11px] font-mono text-muted tabular-nums">{index + 1}</span>
          <span
            className={`font-mono text-lg leading-none tabular-nums ${participant.isCurrent ? 'text-primary' : 'text-secondary'}`}
            title="Инициатива"
          >
            {participant.initiativeValue}
          </span>
        </div>

        <div
          className={`relative w-12 h-12 shrink-0 overflow-hidden border bg-surface ${
            participant.isCurrent ? 'border-primary/60' : 'border-border'
          }`}
          title={participant.displayName}
        >
          {!concealed && participant.imageUrl ? (
            <img
              src={participant.imageUrl}
              alt={participant.displayName}
              className="w-full h-full object-cover object-top"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              {concealed ? (
                <Ghost className="w-5 h-5" strokeWidth={1.5} />
              ) : isMonster ? (
                <Skull className="w-5 h-5" strokeWidth={1.5} />
              ) : (
                <Crown className="w-5 h-5" strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className={`text-[15px] leading-tight truncate ${participant.isYou ? 'text-primary' : 'text-text'}`}>
                  {participant.displayName}
                </h3>
                {participant.isYou && <Badge tone="primary">вы</Badge>}
                {participant.isCurrent && !participant.isYou && <Badge tone="primary">ход</Badge>}
                {participant.isDefeated && <Badge tone="negative">повержен</Badge>}
                {isDm && participant.isHiddenFromPlayers && <Badge tone="warning">статы скрыты</Badge>}
                {isDm && participant.hideName && <Badge tone="warning">имя скрыто</Badge>}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" strokeWidth={1.75} /> КД {participant.armorClass ?? '—'}
                </span>
                {isMonster && (
                  <span className="text-muted">{participant.monsterBestiaryId ? 'бестиарий' : 'существо'}</span>
                )}
                {!isMonster && <span className="text-muted">игрок</span>}
                {concealed && <span className="text-warning/80">данные скрыты</span>}
              </div>
            </div>

            {isDm && (
              <button
                type="button"
                onClick={() => handlers.onOpenEditor(participant.id)}
                className="shrink-0 h-8 w-8 flex items-center justify-center border border-border text-secondary hover:text-primary hover:border-primary/60"
                title="Настройки участника"
              >
                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* HP */}
          <div className="mt-2">
            {hasNumbers ? (
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono tabular-nums text-base leading-none">
                  <span className={colors.text}>{participant.currentHp}</span>
                  <span className="text-muted text-sm">/{participant.maxHp}</span>
                  {(participant.tempHp ?? 0) > 0 && (
                    <span className="ml-2 text-primary text-xs">+{participant.tempHp} врем.</span>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted">HP</span>
              </div>
            ) : null}

            {hasBar ? (
              <div className={`h-2 bg-raised overflow-hidden ${hasNumbers ? 'mt-1.5' : 'mt-2'}`}>
                <div
                  className={`h-full transition-[width] duration-300 ${colors.bar}`}
                  style={{
                    width: `${participant.hpPercent ?? 0}%`,
                    boxShadow: participant.isCurrent ? '0 0 10px rgba(34,211,238,0.5)' : undefined,
                  }}
                />
              </div>
            ) : null}

            {!hasNumbers && !hasBar && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-muted">
                <Lock className="w-3 h-3" strokeWidth={1.75} /> HP скрыт мастером
              </div>
            )}

            {!hasNumbers && hasBar && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-muted">
                <Lock className="w-2.5 h-2.5" strokeWidth={1.75} /> полоса без чисел
              </div>
            )}
          </div>

          {visibleEffects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {visibleEffects.map((effect) => (
                <EffectChip
                  key={effect.id}
                  effect={effect}
                  canRemove={isDm && !readOnly}
                  onRemove={handlers.onRemoveEffect}
                />
              ))}
            </div>
          )}

          {participant.exhaustionLevel > 0 && (
            <div className="mt-1.5">
              <ExhaustionTracker level={participant.exhaustionLevel} canEdit={false} compact />
            </div>
          )}

          {showDeathSaves && participant.deathSaves && (
            <DeathSaveTracker
              saves={participant.deathSaves}
              canEdit={isDm && !readOnly}
              onSave={(kind) => handlers.onDeathSave(participant.id, kind)}
              onStabilize={(stable) => handlers.onStabilize(participant.id, stable)}
            />
          )}
        </div>
      </div>

      {/* Быстрые действия мастера */}
      {isDm && !readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-border/70 bg-surface/40">
          <button
            type="button"
            onClick={() => applyHp(-1)}
            className="h-9 min-w-[2.75rem] px-2 text-sm font-mono border border-negative/50 text-negative hover:bg-negative/10"
            title="1 урон"
          >
            −1
          </button>
          <button
            type="button"
            onClick={() => applyHp(-5)}
            className="h-9 min-w-[2.75rem] px-2 text-sm font-mono border border-negative/50 text-negative hover:bg-negative/10"
            title="5 урона"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => applyHp(5)}
            className="h-9 min-w-[2.75rem] px-2 text-sm font-mono border border-positive/50 text-positive hover:bg-positive/10"
            title="5 лечения"
          >
            +5
          </button>
          <button
            type="button"
            onClick={() => applyHp(1)}
            className="h-9 min-w-[2.75rem] px-2 text-sm font-mono border border-positive/50 text-positive hover:bg-positive/10"
            title="1 лечение"
          >
            +1
          </button>

          <div className="flex items-center gap-1.5 ml-1">
            <input
              value={hpInput}
              onChange={(event) => setHpInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setHpInput('');
                if (event.key !== 'Enter') return;
                const delta = Number.parseInt(hpInput, 10);
                if (Number.isFinite(delta) && delta !== 0) applyHp(delta);
                setHpInput('');
              }}
              inputMode="numeric"
              placeholder="±HP"
              className="w-20 h-9 bg-deep border border-border px-2 text-sm font-mono text-text outline-none focus:border-primary/60"
              title="Введите число и Enter: минус — урон, плюс — лечение"
            />
            <button
              type="button"
              onClick={() => {
                const delta = Number.parseInt(hpInput, 10);
                if (Number.isFinite(delta) && delta !== 0) applyHp(delta);
                setHpInput('');
              }}
              className="h-9 px-2.5 text-[11px] font-mono uppercase border border-border text-secondary hover:text-text hover:border-primary/50"
              title="Применить"
            >
              применить
            </button>
          </div>

          <button
            type="button"
            onClick={() => handlers.onOpenEditor(participant.id)}
            className="h-9 px-2.5 ml-auto text-[11px] font-mono uppercase border border-border text-secondary hover:text-primary hover:border-primary/50 flex items-center gap-1.5"
            title="Все настройки участника"
          >
            настройки <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {isDm && readOnly && (
        <div className="px-3 py-2 border-t border-border/70 text-[11px] font-mono uppercase tracking-wide text-muted flex items-center gap-1.5">
          <Lock className="w-3 h-3" strokeWidth={1.75} /> бой завершён — только чтение
        </div>
      )}

    </article>
  );
};
