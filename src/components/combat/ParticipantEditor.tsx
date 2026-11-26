import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Plus, Save, Trash2, X } from 'lucide-react';
import { DND_CONDITIONS, type CombatParticipantView } from '../../lib/combatProtocol';
import { DeathSaveTracker } from './DeathSaveTracker';
import { EffectChip } from './EffectChip';
import { ExhaustionTracker } from './ExhaustionTracker';
import type { ParticipantCardHandlers } from './ParticipantCard';
import type { CombatParticipantPatch } from '../../lib/combat';

type Draft = {
  displayName: string;
  initiative: string;
  armorClass: string;
  currentHp: string;
  maxHp: string;
  tempHp: string;
  hiddenStats: boolean;
  hideName: boolean;
  notes: string;
};

const toDraft = (participant: CombatParticipantView): Draft => ({
  displayName: participant.displayName,
  initiative: String(participant.initiativeValue),
  armorClass: participant.armorClass != null ? String(participant.armorClass) : '',
  currentHp: participant.currentHp != null ? String(participant.currentHp) : '',
  maxHp: participant.maxHp != null ? String(participant.maxHp) : '',
  tempHp: participant.tempHp != null ? String(participant.tempHp) : '',
  hiddenStats: participant.isHiddenFromPlayers,
  hideName: participant.hideName,
  notes: participant.notes ?? '',
});

type DraftKey = keyof Draft;

interface ParticipantEditorProps {
  participant: CombatParticipantView;
  handlers: ParticipantCardHandlers;
  readOnly: boolean;
  onClose: () => void;
}

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="flex items-baseline justify-between gap-2 text-[11px] font-mono uppercase tracking-wide text-secondary">
      {label}
      {hint && <span className="text-[10px] normal-case tracking-normal text-muted">{hint}</span>}
    </span>
    <span className="block mt-1">{children}</span>
  </label>
);

const inputClass =
  'w-full h-10 bg-deep border border-border px-2.5 text-sm text-text outline-none focus:border-primary/60 placeholder:text-muted';

/**
 * Шторка настроек участника (мастер).
 *
 * Один черновик на все поля и одна отправка: раньше каждое поле писало PATCH
 * само по себе, из-за чего правки перетирали друг друга, а внешние обновления
 * подменяли значения под курсором. Здесь черновик синхронизируется только по
 * полям, которые мастер ещё не трогал.
 */
export const ParticipantEditor: React.FC<ParticipantEditorProps> = ({
  participant,
  handlers,
  readOnly,
  onClose,
}) => {
  const [draft, setDraft] = useState<Draft>(() => toDraft(participant));
  const dirtyKeys = useRef<Set<DraftKey>>(new Set());
  const [conditionPick, setConditionPick] = useState(DND_CONDITIONS[0].name);
  const [customName, setCustomName] = useState('');
  const [durationType, setDurationType] = useState<'rounds' | 'until_save' | 'until_removed' | 'permanent'>('rounds');
  const [durationValue, setDurationValue] = useState('3');
  const [effectVisible, setEffectVisible] = useState(true);

  useEffect(() => {
    const incoming = toDraft(participant);
    setDraft((prev) => {
      const next: Draft = { ...prev };
      const target = next as unknown as Record<string, unknown>;
      const source = incoming as unknown as Record<string, unknown>;
      (Object.keys(incoming) as DraftKey[]).forEach((key) => {
        if (!dirtyKeys.current.has(key)) target[key] = source[key];
      });
      return next;
    });
  }, [participant]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = <K extends DraftKey>(key: K, value: Draft[K]) => {
    dirtyKeys.current.add(key);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const dirtyCount = dirtyKeys.current.size;

  const save = () => {
    const patch: CombatParticipantPatch = {};
    const parse = (raw: string): number | null => {
      const value = Number.parseInt(raw, 10);
      return Number.isFinite(value) ? value : null;
    };

    if (dirtyKeys.current.has('displayName') && draft.displayName.trim()) {
      patch.displayName = draft.displayName.trim().slice(0, 80);
    }
    if (dirtyKeys.current.has('initiative')) {
      const value = parse(draft.initiative);
      if (value != null) patch.initiativeValue = value;
    }
    if (dirtyKeys.current.has('armorClass')) {
      patch.armorClass = draft.armorClass.trim() ? parse(draft.armorClass) : null;
    }
    if (dirtyKeys.current.has('currentHp')) {
      const value = parse(draft.currentHp);
      if (value != null) patch.currentHp = Math.max(0, value);
    }
    if (dirtyKeys.current.has('maxHp')) {
      const value = parse(draft.maxHp);
      if (value != null && value > 0) patch.maxHp = value;
    }
    if (dirtyKeys.current.has('tempHp')) {
      const value = parse(draft.tempHp);
      if (value != null) patch.tempHp = Math.max(0, value);
    }
    if (dirtyKeys.current.has('hiddenStats')) patch.isHiddenFromPlayers = draft.hiddenStats;
    if (dirtyKeys.current.has('hideName')) patch.hideName = draft.hideName;
    if (dirtyKeys.current.has('notes')) patch.notes = draft.notes.slice(0, 2000);

    if (Object.keys(patch).length > 0) handlers.onUpdate(participant.id, patch);
    dirtyKeys.current.clear();
  };

  const visibleEffects = useMemo(
    () => participant.effects.filter((effect) => effect.effectType !== 'exhaustion'),
    [participant.effects]
  );

  const isMonster = participant.participantType === 'monster';

  return (
    <div className="fixed inset-0 z-[130] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Настройки участника ${participant.displayName}`}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[30rem] h-full overflow-y-auto bg-deep border-l border-border shadow-glass"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-deep/95 backdrop-blur border-b border-border">
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wide text-muted">
              {isMonster ? 'существо' : 'игрок'} · инициатива {participant.initiativeValue}
            </div>
            <div className="text-base text-text truncate">{participant.displayName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-9 w-9 flex items-center justify-center border border-border text-secondary hover:text-text"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <section className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">Основное</div>

            <Field label="Имя в трекере">
              <input
                value={draft.displayName}
                onChange={(event) => setField('displayName', event.target.value)}
                className={inputClass}
                placeholder="Как показывать имя"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Инициатива">
                <input
                  value={draft.initiative}
                  onChange={(event) => setField('initiative', event.target.value)}
                  inputMode="numeric"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="КД / AC">
                <input
                  value={draft.armorClass}
                  onChange={(event) => setField('armorClass', event.target.value)}
                  inputMode="numeric"
                  placeholder="—"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Текущие HP">
                <input
                  value={draft.currentHp}
                  onChange={(event) => setField('currentHp', event.target.value)}
                  inputMode="numeric"
                  placeholder="—"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Максимум HP">
                <input
                  value={draft.maxHp}
                  onChange={(event) => setField('maxHp', event.target.value)}
                  inputMode="numeric"
                  placeholder="—"
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Временные HP">
                <input
                  value={draft.tempHp}
                  onChange={(event) => setField('tempHp', event.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className={`${inputClass} font-mono`}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">Видимость для игроков</div>
            <button
              type="button"
              onClick={() => setField('hiddenStats', !draft.hiddenStats)}
              className={`w-full h-11 px-3 flex items-center gap-2.5 border text-sm text-left ${
                draft.hiddenStats
                  ? 'border-warning/60 text-warning bg-warning/10'
                  : 'border-border text-secondary hover:text-text'
              }`}
            >
              {draft.hiddenStats ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="flex-1">
                HP, КД и стат-блок скрыты
                <span className="block text-[10px] font-mono uppercase tracking-wide opacity-70">
                  {draft.hiddenStats ? 'игроки не видят числа и способности' : 'игроки видят числа и полосу HP'}
                </span>
              </span>
              <span className={`w-9 h-5 border relative ${draft.hiddenStats ? 'border-warning/70' : 'border-border'}`}>
                <span
                  className={`absolute top-0.5 w-4 h-4 ${draft.hiddenStats ? 'right-0.5 bg-warning' : 'left-0.5 bg-secondary/60'}`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setField('hideName', !draft.hideName)}
              className={`w-full h-11 px-3 flex items-center gap-2.5 border text-sm text-left ${
                draft.hideName
                  ? 'border-warning/60 text-warning bg-warning/10'
                  : 'border-border text-secondary hover:text-text'
              }`}
            >
              {draft.hideName ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="flex-1">
                Имя скрыто
                <span className="block text-[10px] font-mono uppercase tracking-wide opacity-70">
                  игроки видят силуэт и «Неизвестное существо»
                </span>
              </span>
              <span className={`w-9 h-5 border relative ${draft.hideName ? 'border-warning/70' : 'border-border'}`}>
                <span
                  className={`absolute top-0.5 w-4 h-4 ${draft.hideName ? 'right-0.5 bg-warning' : 'left-0.5 bg-secondary/60'}`}
                />
              </span>
            </button>
          </section>

          {participant.deathSaves && (
            <section>
              <div className="text-[11px] font-mono uppercase tracking-wide text-secondary mb-1.5">Спасброски от смерти</div>
              <DeathSaveTracker
                saves={participant.deathSaves}
                canEdit={!readOnly}
                onSave={(kind) => handlers.onDeathSave(participant.id, kind)}
                onStabilize={(stable) => handlers.onStabilize(participant.id, stable)}
              />
            </section>
          )}

          <section>
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary mb-1.5">Истощение</div>
            <ExhaustionTracker
              level={participant.exhaustionLevel}
              canEdit={!readOnly}
              onChange={(level) => handlers.onExhaustion(participant.id, level)}
            />
          </section>

          <section className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wide text-secondary">Состояния и эффекты</div>

            {visibleEffects.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visibleEffects.map((effect) => (
                  <EffectChip
                    key={effect.id}
                    effect={effect}
                    canRemove={!readOnly}
                    onRemove={handlers.onRemoveEffect}
                  />
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted">Активных эффектов нет.</div>
            )}

            <div className="flex items-center gap-1.5">
              <select
                value={conditionPick}
                onChange={(event) => setConditionPick(event.target.value)}
                className="flex-1 h-10 min-w-0 bg-deep border border-border px-2 text-sm text-text outline-none focus:border-primary/60"
              >
                {DND_CONDITIONS.map((condition) => (
                  <option key={condition.name} value={condition.name}>
                    {condition.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  handlers.onAddEffect(participant.id, {
                    effectName: conditionPick,
                    effectType: 'condition',
                    isVisibleToPlayers: effectVisible,
                  })
                }
                className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-primary hover:border-primary/50 disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} /> добавить
              </button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Свой эффект"
                className={`${inputClass} h-10`}
              />
              <select
                value={durationType}
                onChange={(event) =>
                  setDurationType(event.target.value as 'rounds' | 'until_save' | 'until_removed' | 'permanent')
                }
                className="h-10 bg-deep border border-border px-2 text-[11px] text-text outline-none"
                title="Длительность"
              >
                <option value="rounds">раунды</option>
                <option value="until_save">до спасброска</option>
                <option value="until_removed">до снятия</option>
                <option value="permanent">постоянно</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              {durationType === 'rounds' && (
                <input
                  value={durationValue}
                  onChange={(event) => setDurationValue(event.target.value)}
                  inputMode="numeric"
                  className="w-16 h-10 bg-deep border border-border px-2 text-sm font-mono text-text outline-none"
                  title="Раундов"
                />
              )}
              <button
                type="button"
                disabled={readOnly || !customName.trim()}
                onClick={() => {
                  if (!customName.trim()) return;
                  handlers.onAddEffect(participant.id, {
                    effectName: customName.trim().slice(0, 60),
                    effectType: 'custom',
                    durationType,
                    durationValue: durationType === 'rounds' ? Math.max(1, Number.parseInt(durationValue, 10) || 1) : null,
                    isVisibleToPlayers: effectVisible,
                  });
                  setCustomName('');
                }}
                className="h-10 px-3 text-[11px] font-mono uppercase border border-border text-secondary hover:text-primary hover:border-primary/50 disabled:opacity-40"
              >
                + эффект
              </button>
              <label className="ml-auto flex items-center gap-2 text-[11px] font-mono uppercase text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={effectVisible}
                  onChange={(event) => setEffectVisible(event.target.checked)}
                  className="accent-cyan-400 w-4 h-4"
                />
                видно игрокам
              </label>
            </div>
          </section>

          <section>
            <Field label="Заметки мастера" hint="игроки не видят">
              <textarea
                value={draft.notes}
                onChange={(event) => setField('notes', event.target.value)}
                rows={3}
                className="w-full bg-deep border border-border px-2.5 py-2 text-sm text-text outline-none focus:border-primary/60 resize-none"
                placeholder="Тактика, легендарные действия, секреты…"
              />
            </Field>
          </section>

          {!!participant.statblock && (
            <section>
              <div className="text-[11px] font-mono uppercase tracking-wide text-secondary mb-1.5">Стат-блок</div>
              <pre className="p-2.5 max-h-56 overflow-auto text-[11px] leading-relaxed text-secondary whitespace-pre-wrap border border-border bg-surface/60">
                {participant.statblock}
              </pre>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center gap-2 px-4 py-3 bg-deep/95 backdrop-blur border-t border-border">
          <button
            type="button"
            disabled={readOnly || dirtyCount === 0}
            onClick={save}
            className="anime-btn-primary h-10 px-4 text-sm flex items-center gap-2 disabled:opacity-40"
            title="Применить изменения (одним запросом)"
          >
            <Save className="w-4 h-4" strokeWidth={1.75} /> сохранить
            {dirtyCount > 0 && <span className="font-mono text-[11px] opacity-80">({dirtyCount})</span>}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 text-sm border border-border text-secondary hover:text-text"
          >
            закрыть
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Удалить «${participant.displayName}» из боя?`)) {
                  handlers.onRemove(participant.id);
                  onClose();
                }
              }}
              className="ml-auto h-10 px-3 text-sm border border-border text-secondary hover:text-negative flex items-center gap-2"
              title="Убрать участника из боя"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} /> удалить
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
};
