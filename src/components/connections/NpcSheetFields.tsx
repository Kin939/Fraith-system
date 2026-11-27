import React from 'react';
import { Shield, Heart, Footprints, Sparkles, Swords } from 'lucide-react';
import { NPC_ABILITY_KEYS, abilityModifier } from '../../lib/npcSheet';
import type { NpcAbilities, NpcSheet } from '../../lib/types';

interface NpcSheetFieldsProps {
  sheet: NpcSheet;
  onChange: (next: NpcSheet) => void;
  disabled?: boolean;
  /** Компактный вариант — для шторки боя */
  dense?: boolean;
}

const inputClass =
  'w-full h-9 bg-deep border border-border px-2 text-sm text-text outline-none focus:border-primary/60 font-mono';
const textInputClass =
  'w-full h-9 bg-deep border border-border px-2 text-sm text-text outline-none focus:border-primary/60';
const areaClass =
  'w-full bg-deep border border-border px-2 py-1.5 text-[12px] leading-relaxed text-text outline-none focus:border-primary/60 resize-y';

/**
 * Поля боевого листа НПС. Один компонент на два места: карточка в «Связях»
 * (полный редактор) и шторка участника в трекере «Бой», где мастер правит
 * статы на ходу.
 */
export const NpcSheetFields: React.FC<NpcSheetFieldsProps> = ({
  sheet,
  onChange,
  disabled = false,
  dense = false,
}) => {
  const patch = (next: Partial<NpcSheet>) => onChange({ ...sheet, ...next });

  const patchAbility = (key: keyof NpcAbilities, raw: string) => {
    const parsed = raw.trim() === '' ? null : Number.parseInt(raw, 10);
    onChange({
      ...sheet,
      abilities: {
        ...sheet.abilities,
        [key]: Number.isFinite(parsed as number) ? parsed : null,
      },
    });
  };

  const numberInput = (
    value: number | null,
    onValue: (raw: string) => void,
    placeholder: string,
    min: number,
    max: number
  ) => (
    <input
      value={value ?? ''}
      onChange={(event) => onValue(event.target.value)}
      inputMode="numeric"
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      className={inputClass}
    />
  );

  return (
    <div className={`space-y-3 ${dense ? '' : 'rounded-none'}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1">
            <Shield className="w-3 h-3" strokeWidth={1.8} /> КД
          </span>
          {numberInput(sheet.ac, (raw) => patch({ ac: raw === '' ? null : Number.parseInt(raw, 10) || null }), '15', 0, 40)}
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1">
            <Heart className="w-3 h-3" strokeWidth={1.8} /> HP
          </span>
          {numberInput(sheet.hp, (raw) => patch({ hp: raw === '' ? null : Number.parseInt(raw, 10) || null }), '27', 0, 9999)}
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" strokeWidth={1.8} /> CR
          </span>
          <input
            value={sheet.cr}
            onChange={(event) => patch({ cr: event.target.value })}
            disabled={disabled}
            placeholder="3"
            className={textInputClass}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1">
            <Swords className="w-3 h-3" strokeWidth={1.8} /> Иниц. бонус
          </span>
          {numberInput(
            sheet.initiativeBonus,
            (raw) => patch({ initiativeBonus: raw === '' ? null : Number.parseInt(raw, 10) || null }),
            '+2',
            -20,
            20
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Кости хитов</span>
          <input
            value={sheet.hitDice}
            onChange={(event) => patch({ hitDice: event.target.value })}
            disabled={disabled}
            placeholder="5d8 + 10"
            className={`${textInputClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1">
            <Footprints className="w-3 h-3" strokeWidth={1.8} /> Скорость
          </span>
          <input
            value={sheet.speed}
            onChange={(event) => patch({ speed: event.target.value })}
            disabled={disabled}
            placeholder="30 фт."
            className={textInputClass}
          />
        </label>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-wide text-secondary mb-1">Характеристики</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {NPC_ABILITY_KEYS.map(({ key, short, label }) => (
            <label key={key} className="block" title={label}>
              <span className="block text-center text-[10px] font-mono text-muted">{short}</span>
              <input
                value={sheet.abilities[key] ?? ''}
                onChange={(event) => patchAbility(key, event.target.value)}
                inputMode="numeric"
                disabled={disabled}
                placeholder="10"
                className={`${inputClass} text-center`}
              />
              <span className="block text-center text-[9px] font-mono text-muted mt-0.5">
                {abilityModifier(sheet.abilities[key])}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Спасброски</span>
          <input
            value={sheet.saves}
            onChange={(event) => patch({ saves: event.target.value })}
            disabled={disabled}
            placeholder="ТЕЛ +5, МДР +2"
            className={textInputClass}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Навыки</span>
          <input
            value={sheet.skills}
            onChange={(event) => patch({ skills: event.target.value })}
            disabled={disabled}
            placeholder="Внимательность +4, Обман +6"
            className={textInputClass}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Чувства</span>
          <input
            value={sheet.senses}
            onChange={(event) => patch({ senses: event.target.value })}
            disabled={disabled}
            placeholder="тёмное зрение 60 фт."
            className={textInputClass}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Языки</span>
          <input
            value={sheet.languages}
            onChange={(event) => patch({ languages: event.target.value })}
            disabled={disabled}
            placeholder="общий, эльфийский"
            className={textInputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">
          Особенности (черты, сопротивления)
        </span>
        <textarea
          rows={dense ? 2 : 3}
          value={sheet.traits}
          onChange={(event) => patch({ traits: event.target.value })}
          disabled={disabled}
          placeholder="Сопротивление огню. Тактика: держит строй, прикрывает союзников."
          className={areaClass}
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1">
          <Swords className="w-3 h-3" strokeWidth={1.8} /> Действия и атаки
        </span>
        <textarea
          rows={dense ? 3 : 4}
          value={sheet.actions}
          onChange={(event) => patch({ actions: event.target.value })}
          disabled={disabled}
          placeholder="Мультиатака: два удара длинным мечом. +5, 1d8+3 рубящего."
          className={areaClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Бонусные действия</span>
          <textarea
            rows={2}
            value={sheet.bonusActions}
            onChange={(event) => patch({ bonusActions: event.target.value })}
            disabled={disabled}
            placeholder="Рывок, Засада"
            className={areaClass}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Реакции</span>
          <textarea
            rows={2}
            value={sheet.reactions}
            onChange={(event) => patch({ reactions: event.target.value })}
            disabled={disabled}
            placeholder="Парирование: +3 к КД против одной атаки"
            className={areaClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] font-mono uppercase tracking-wide text-secondary">Легендарные действия</span>
        <textarea
          rows={2}
          value={sheet.legendary}
          onChange={(event) => patch({ legendary: event.target.value })}
          disabled={disabled}
          placeholder="3 действия: удар хвостом, рык, перемещение"
          className={areaClass}
        />
      </label>
    </div>
  );
};
