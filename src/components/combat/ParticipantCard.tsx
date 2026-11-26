import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  EyeOff,
  Ghost,
  Heart,
  Lock,
  Shield,
  Skull,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  DND_CONDITIONS,
  hpTone,
  type CombatParticipantView,
} from '../../lib/combatProtocol';
import { EffectChip } from './EffectChip';
import { DeathSaveTracker } from './DeathSaveTracker';
import { ExhaustionTracker } from './ExhaustionTracker';

export interface ParticipantCardHandlers {
  onHpDelta: (participantId: string, delta: number) => void;
  onSetHp: (participantId: string, value: number, maxHp?: number) => void;
  onSetTempHp: (participantId: string, value: number) => void;
  onSetInitiative: (participantId: string, value: number) => void;
  onUpdate: (
    participantId: string,
    patch: {
      displayName?: string;
      armorClass?: number | null;
      isHiddenFromPlayers?: boolean;
      hideName?: boolean;
      notes?: string;
    }
  ) => void;
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
}

interface ParticipantCardProps {
  participant: CombatParticipantView;
  isDm: boolean;
  readOnly: boolean;
  handlers: ParticipantCardHandlers;
  index: number;
}

const toneClass: Record<'positive' | 'warning' | 'negative', { bar: string; text: string; border: string }> = {
  positive: { bar: 'bg-positive', text: 'text-positive', border: 'border-positive/60' },
  warning: { bar: 'bg-warning', text: 'text-warning', border: 'border-warning/60' },
  negative: { bar: 'bg-negative', text: 'text-negative', border: 'border-negative/70' },
};

/**
 * Карточка участника трекера инициативы.
 *
 * Один компонент обслуживает обе роли: мастер видит HP/AC/стат-блок и получает
 * панель управления, игрок — только разрешённые сервером поля (скрытые мобы
 * приходят без цифр и рисуются силуэтом).
 */
export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isDm,
  readOnly,
  handlers,
  index,
}) => {
  const [open, setOpen] = useState(false);
  const [hpInput, setHpInput] = useState('');
  const [tempInput, setTempInput] = useState('');
  const [initiativeInput, setInitiativeInput] = useState(String(participant.initiativeValue));
  const [acInput, setAcInput] = useState(participant.armorClass != null ? String(participant.armorClass) : '');
  const [nameInput, setNameInput] = useState(participant.displayName);
  const [conditionPick, setConditionPick] = useState(DND_CONDITIONS[0].name);
  const [customName, setCustomName] = useState('');
  const [durationType, setDurationType] = useState<'rounds' | 'until_save' | 'until_removed' | 'permanent'>('rounds');
  const [durationValue, setDurationValue] = useState ('3');
  const [effectVisible, setEffectVisible] = useState(true);

  const concealed = !isDm && (participant.isHiddenFromPlayers || participant.hideName);
  const tone = participant.maxHp ? hpTone(participant.currentHp ?? 0, participant.maxHp) : 'negative';
  const colors = toneClass[tone];
  const hasBar = participant.hpPercent != null;
  const isMonster = participant.participantType === 'monster';

  const applyHp = (delta: number) => {
    if (!delta) return;
    handlers.onHpDelta(participant.id, delta);
  };

  return (
    <div
      className={`relative border bg-deep/70 backdrop-blur-sm transition-all duration-200 ${
        participant.isCurrent
          ? 'border-primary/70 shadow-[0_0_22px_rgba(34,211,238,0.22)]'
          : 'border-border hover:border-primary/30'
      } ${participant.isCurrent ? 'ring-1 ring-primary/30' : ''}`}
    >
      {participant.isCurrent && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
      )}

      <div className="flex items-start gap-2.5 p-2.5">
        <div className="flex flex-col items-center gap-0.5 shrink-0 w-6">
          <span className="font-mono text-[10px] text-muted tabular-nums">{index + 1}</span>
          <span
            className={`font-mono text-xs tabular-nums ${
              participant.isCurrent ? 'text-primary' : 'text-secondary'
            }`}
            title="Инициатива"
          >
            {participant.initiativeValue}
          </span>
        </div>

        <div
          className={`relative w-9 h-9 shrink-0 overflow-hidden hud-cut-sm bg-surface border ${
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
                <Ghost className="w-4 h-4" strokeWidth={1.5} />
              ) : isMonster ? (
                <Skull className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <Crown className="w-4 h-4" strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs truncate ${participant.isYou ? 'text-primary' : 'text-text'}`}>
              {participant.displayName}
            </span>
            {participant.isYou && (
              <span className="text-[8px] font-mono uppercase px-1 border border-primary/50 text-primary shrink-0">вы</span>
            )}
            {participant.isDefeated && (
              <span className="text-[8px] font-mono uppercase px-1 border border-negative/60 text-negative shrink-0">
                повержен
              </span>
            )}
            {isDm && participant.isHiddenFromPlayers && (
              <Lock className="w-2.5 h-2.5 text-warning shrink-0" strokeWidth={2} aria-label="HP и стат-блок скрыты от игроков" />
            )}
            {isDm && participant.isCurrent && (
              <span className="text-[8px] font-mono uppercase px-1 border border-primary/50 text-primary/80 shrink-0">
                ход
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-muted">
            <span className="flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" strokeWidth={1.75} />
              {participant.armorClass != null ? participant.armorClass : '—'}
            </span>
            {participant.deathSaves && (
              <span>
                спасбр. {participant.deathSaves.successes}/{participant.deathSaves.failures}
              </span>
            )}
            {isMonster && concealed && <span className="text-warning/80">данные скрыты</span>}
          </div>

          {/* HP */}
          <div className="mt-1">
            {participant.currentHp != null && participant.maxHp != null ? (
              <>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={colors.text}>
                    {participant.currentHp}
                    <span className="text-muted">/{participant.maxHp}</span>
                    {(participant.tempHp ?? 0) > 0 && (
                      <span className="text-primary ml-1">+{participant.tempHp}</span>
                    )}
                  </span>
                  <span className="text-muted">HP</span>
                </div>
                <div className="h-1.5 bg-raised mt-0.5 overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-300 ${colors.bar}`}
                    style={{
                      width: `${participant.hpPercent ?? 0}%`,
                      boxShadow: participant.isCurrent ? '0 0 8px rgba(34,211,238,0.5)' : undefined,
                    }}
                  />
                </div>
              </>
            ) : hasBar ? (
              <div className="h-1.5 bg-raised overflow-hidden mt-1">
                <div className={`h-full ${colors.bar} opacity-80`} style={{ width: `${participant.hpPercent ?? 0}%` }} />
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-mono text-muted">
                <Lock className="w-2.5 h-2.5" strokeWidth={1.75} /> HP скрыт мастером
              </div>
            )}
          </div>

          {/* Эффекты */}
          {participant.effects.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {participant.effects
                .filter((effect) => effect.effectType !== 'exhaustion')
                .map((effect) => (
                  <EffectChip
                    key={effect.id}
                    effect={effect}
                    canRemove={isDm && !readOnly}
                    onRemove={handlers.onRemoveEffect}
                  />
                ))}
            </div>
          )}

          {participant.exhaustionLevel > 0 && !isDm && (
            <div className="mt-1">
              <ExhaustionTracker level={participant.exhaustionLevel} canEdit={false} compact />
            </div>
          )}

          {participant.deathSaves && (
            <DeathSaveTracker
              saves={participant.deathSaves}
              canEdit={isDm && !readOnly}
              onSave={(kind) => handlers.onDeathSave(participant.id, kind)}
              onStabilize={(stable) => handlers.onStabilize(participant.id, stable)}
            />
          )}

          {isDm && participant.exhaustionLevel >= 0 && (
            <ExhaustionTracker
              level={participant.exhaustionLevel}
              canEdit={!readOnly}
              onChange={(level) => handlers.onExhaustion(participant.id, level)}
            />
          )}

          {isDm && participant.statblock && open && (
            <pre className="mt-1.5 p-2 max-h-40 overflow-auto text-[9px] leading-relaxed text-muted whitespace-pre-wrap border border-border bg-surface/70">
              {participant.statblock}
            </pre>
          )}
        </div>

        {isDm && (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="w-6 h-6 shrink-0 flex items-center justify-center border border-border text-muted hover:text-primary"
            title={open ? 'Свернуть управление' : 'Управление участником'}
          >
            {open ? <ChevronUp className="w-3 h-3" strokeWidth={2} /> : <ChevronDown className="w-3 h-3" strokeWidth={2} />}
          </button>
        )}
      </div>

      {/* Панель мастера */}
      {isDm && open && (
        <div className="border-t border-border p-2.5 space-y-2 bg-surface/40">
          {!readOnly && (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyHp(-1)}
                  className="h-6 px-1.5 text-[10px] font-mono border border-negative/50 text-negative hover:bg-negative/10"
                  title="1 урон"
                >
                  −1
                </button>
                <button
                  type="button"
                  onClick={() => applyHp(-5)}
                  className="h-6 px-1.5 text-[10px] font-mono border border-negative/50 text-negative hover:bg-negative/10"
                >
                  −5
                </button>
                <button
                  type="button"
                  onClick={() => applyHp(5)}
                  className="h-6 px-1.5 text-[10px] font-mono border border-positive/50 text-positive hover:bg-positive/10"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => applyHp(1)}
                  className="h-6 px-1.5 text-[10px] font-mono border border-positive/50 text-positive hover:bg-positive/10"
                >
                  +1
                </button>
                <input
                  value={hpInput}
                  onChange={(event) => setHpInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const delta = Number.parseInt(hpInput, 10);
                    if (Number.isFinite(delta)) applyHp(delta);
                    setHpInput('');
                  }}
                  placeholder="±HP"
                  className="w-14 h-6 bg-deep border border-border px-1.5 text-[10px] font-mono text-text outline-none focus:border-primary/60"
                  title="Введите число и Enter: минус — урон, плюс — лечение"
                />
                <input
                  value={tempInput}
                  onChange={(event) => setTempInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const value = Number.parseInt(tempInput, 10);
                    if (Number.isFinite(value)) handlers.onSetTempHp(participant.id, Math.max(0, value));
                    setTempInput('');
                  }}
                  placeholder="врем."
                  className="w-14 h-6 bg-deep border border-border px-1.5 text-[10px] font-mono text-text outline-none focus:border-primary/60"
                  title="Временные HP"
                />
              </div>

              <div className="grid grid-cols-2 gap-1">
                <label className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted">
                  HP
                  <input
                    defaultValue={participant.currentHp ?? ''}
                    onBlur={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(value)) handlers.onSetHp(participant.id, Math.max(0, value));
                    }}
                    className="flex-1 h-6 min-w-0 bg-deep border border-border px-1 text-[10px] font-mono text-text outline-none focus:border-primary/60"
                  />
                </label>
                <label className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted">
                  Макс
                  <input
                    defaultValue={participant.maxHp ?? ''}
                    onBlur={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(value) && value > 0) {
                        handlers.onSetHp(participant.id, participant.currentHp ?? value, value);
                      }
                    }}
                    className="flex-1 h-6 min-w-0 bg-deep border border-border px-1 text-[10px] font-mono text-text outline-none focus:border-primary/60"
                  />
                </label>
                <label className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted">
                  AC
                  <input
                    value={acInput}
                    onChange={(event) => setAcInput(event.target.value)}
                    onBlur={() => {
                      const value = Number.parseInt(acInput, 10);
                      handlers.onUpdate(participant.id, {
                        armorClass: Number.isFinite(value) ? value : null,
                      });
                    }}
                    className="flex-1 h-6 min-w-0 bg-deep border border-border px-1 text-[10px] font-mono text-text outline-none focus:border-primary/60"
                  />
                </label>
                <label className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted">
                  Иниц.
                  <input
                    value={initiativeInput}
                    onChange={(event) => setInitiativeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      const value = Number.parseInt(initiativeInput, 10);
                      if (Number.isFinite(value)) handlers.onSetInitiative(participant.id, value);
                    }}
                    onBlur={() => {
                      const value = Number.parseInt(initiativeInput, 10);
                      if (Number.isFinite(value) && value !== participant.initiativeValue) {
                        handlers.onSetInitiative(participant.id, value);
                      }
                    }}
                    className="flex-1 h-6 min-w-0 bg-deep border border-border px-1 text-[10px] font-mono text-text outline-none focus:border-primary/60"
                  />
                </label>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    handlers.onUpdate(participant.id, { isHiddenFromPlayers: !participant.isHiddenFromPlayers })
                  }
                  className={`h-6 px-1.5 text-[9px] font-mono uppercase border flex items-center gap-1 ${
                    participant.isHiddenFromPlayers
                      ? 'border-warning/60 text-warning bg-warning/10'
                      : 'border-border text-muted hover:text-text'
                  }`}
                  title="Скрыть HP/AC/стат-блок от игроков"
                >
                  {participant.isHiddenFromPlayers ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  скрыть статы
                </button>
                <button
                  type="button"
                  onClick={() => handlers.onUpdate(participant.id, { hideName: !participant.hideName })}
                  className={`h-6 px-1.5 text-[9px] font-mono uppercase border flex items-center gap-1 ${
                    participant.hideName
                      ? 'border-warning/60 text-warning bg-warning/10'
                      : 'border-border text-muted hover:text-text'
                  }`}
                  title="Показывать игрокам «Неизвестное существо» вместо имени"
                >
                  {participant.hideName ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  имя
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Удалить «${participant.displayName}» из боя?`)) {
                      handlers.onRemove(participant.id);
                    }
                  }}
                  className="h-6 px-1.5 text-[9px] font-mono uppercase border border-border text-muted hover:text-negative flex items-center gap-1"
                  title="Убрать участника"
                >
                  <Trash2 className="w-3 h-3" /> убрать
                </button>
              </div>

              <div className="flex items-center gap-1">
                <input
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  onBlur={() => {
                    if (nameInput.trim() && nameInput !== participant.displayName) {
                      handlers.onUpdate(participant.id, { displayName: nameInput.trim() });
                    }
                  }}
                  className="flex-1 h-6 min-w-0 bg-deep border border-border px-1.5 text-[10px] text-text outline-none focus:border-primary/60"
                  placeholder="Имя в трекере"
                />
                <Zap className="w-3 h-3 text-muted shrink-0" strokeWidth={1.75} />
              </div>

              {/* Добавление эффекта */}
              <div className="border-t border-border/60 pt-2 space-y-1">
                <div className="flex items-center gap-1">
                  <select
                    value={conditionPick}
                    onChange={(event) => setConditionPick(event.target.value)}
                    className="flex-1 h-6 min-w-0 bg-deep border border-border px-1 text-[10px] text-text outline-none focus:border-primary/60"
                  >
                    {DND_CONDITIONS.map((condition) => (
                      <option key={condition.name} value={condition.name}>
                        {condition.label} ({condition.name})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      handlers.onAddEffect(participant.id, {
                        effectName: conditionPick,
                        effectType: 'condition',
                        isVisibleToPlayers: effectVisible,
                      })
                    }
                    className="h-6 px-1.5 text-[9px] font-mono uppercase border border-border text-muted hover:text-primary"
                    title="Добавить состояние"
                  >
                    + состояние
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    value={customName}
                    onChange={(event) => setCustomName(event.target.value)}
                    placeholder="Свой эффект"
                    className="flex-1 h-6 min-w-0 bg-deep border border-border px-1.5 text-[10px] text-text outline-none focus:border-primary/60"
                  />
                  <select
                    value={durationType}
                    onChange={(event) =>
                      setDurationType(event.target.value as 'rounds' | 'until_save' | 'until_removed' | 'permanent')
                    }
                    className="h-6 bg-deep border border-border px-1 text-[9px] text-text outline-none"
                    title="Длительность"
                  >
                    <option value="rounds">раунды</option>
                    <option value="until_save">до спасброска</option>
                    <option value="until_removed">до снятия</option>
                    <option value="permanent">постоянно</option>
                  </select>
                  {durationType === 'rounds' && (
                    <input
                      value={durationValue}
                      onChange={(event) => setDurationValue(event.target.value)}
                      className="w-10 h-6 bg-deep border border-border px-1 text-[10px] font-mono text-text outline-none"
                      title="Раундов"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!customName.trim()) return;
                      handlers.onAddEffect(participant.id, {
                        effectName: customName.trim(),
                        effectType: 'custom',
                        durationType,
                        durationValue: durationType === 'rounds' ? Number.parseInt(durationValue, 10) || 1 : null,
                        isVisibleToPlayers: effectVisible,
                      });
                      setCustomName('');
                    }}
                    className="h-6 px-1.5 text-[9px] font-mono uppercase border border-border text-muted hover:text-primary"
                  >
                    + эффект
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectVisible}
                    onChange={(event) => setEffectVisible(event.target.checked)}
                    className="accent-cyan-400"
                  />
                  видно игрокам
                </label>
              </div>
            </>
          )}

          {!readOnly && participant.notes !== null && (
            <textarea
              defaultValue={participant.notes ?? ''}
              onBlur={(event) => handlers.onUpdate(participant.id, { notes: event.target.value })}
              rows={2}
              placeholder="Заметки мастера (игроки не видят)"
              className="w-full bg-deep border border-border px-1.5 py-1 text-[10px] text-text outline-none focus:border-primary/60 resize-none"
            />
          )}

          <div className="flex items-center gap-2 text-[9px] font-mono uppercase text-muted">
            <Heart className="w-2.5 h-2.5" strokeWidth={1.75} />
            {participant.participantType === 'monster' ? 'моб' : 'игрок'}
            {participant.monsterBestiaryId ? ` · бестиарий #${participant.monsterBestiaryId}` : ''}
          </div>
        </div>
      )}
    </div>
  );
};
