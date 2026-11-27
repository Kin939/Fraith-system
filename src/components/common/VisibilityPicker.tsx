import React from 'react';
import { Check, Eye, Users } from 'lucide-react';
import type { PartyPlayerSummary } from '../../lib/types';
import { PeerAvatar } from './PeerAvatar';

interface VisibilityPickerProps {
  players: PartyPlayerSummary[];
  /** Выбранные игроки. Пустой массив = видно всем игрокам. */
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  /** Компактный режим для форм с плотной сеткой */
  dense?: boolean;
  label?: string;
}

/**
 * Выбор видимости квеста/файла: «вся партия» либо конкретные игроки.
 *
 * Хранится как список user.id; пустой список означает «видно всем» — так
 * старые записи и обычные квесты остаются публичными без миграции данных.
 */
export const VisibilityPicker: React.FC<VisibilityPickerProps> = ({
  players,
  value,
  onChange,
  disabled: isDisabled = false,
  dense = false,
  label = 'Кому видно',
}) => {
  const isPersonal = value.length > 0;

  const togglePlayer = (userId: number) => {
    if (isDisabled) return;
    const next = value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId];
    // Пустой список сервер понимает как «виден всем» — не даём случайно
    // опубликовать личный квест/файл, сняв последнюю галочку.
    if (next.length === 0) return;
    onChange(next.sort((a, b) => a - b));
  };

  return (
    <div className={`space-y-2 ${dense ? '' : 'p-3 border border-border bg-bg/60'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-mono uppercase tracking-wide text-secondary inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> {label}
        </span>
        <div className="inline-flex items-center bg-surface border border-border p-0.5 gap-0.5">
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => onChange([])}
            className={`h-7 px-2.5 text-[11px] inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
              !isPersonal ? 'bg-raised text-text font-medium' : 'text-secondary hover:text-text'
            }`}
            title="Квест/файл виден всей партии"
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.75} /> Вся партия
          </button>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              if (players.length === 0) return;
              onChange(value.length > 0 ? value : players.map((p) => p.userId));
            }}
            className={`h-7 px-2.5 text-[11px] inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
              isPersonal ? 'bg-raised text-text font-medium' : 'text-secondary hover:text-text'
            }`}
            title="Выбрать конкретных игроков"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} /> Выбранные
          </button>
        </div>
      </div>

      {isPersonal ? (
        <div className="flex flex-wrap gap-1.5">
          {players.map((player) => {
            const active = value.includes(player.userId);
            return (
              <button
                key={player.userId}
                type="button"
                disabled={isDisabled}
                onClick={() => togglePlayer(player.userId)}
                className={`h-9 pl-1 pr-3 inline-flex items-center gap-2 border text-xs transition-colors disabled:opacity-50 ${
                  active
                    ? 'border-primary/60 text-text bg-primary/10'
                    : 'border-border text-secondary hover:text-text hover:border-primary/40'
                }`}
                title={active ? 'Скрыть от этого игрока' : 'Показать этому игроку'}
              >
                <PeerAvatar
                  name={player.characterName || player.displayName}
                  color="#22d3ee"
                  avatarUrl={player.avatarUrl}
                  size={24}
                  active={active}
                />
                <span className="truncate max-w-[9rem]">
                  {player.characterName || player.displayName}
                </span>
                {active && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />}
              </button>
            );
          })}
          {players.length === 0 && (
            <span className="text-[11px] text-muted">Загружаем игроков партии…</span>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted leading-snug">
          {players.length > 0
            ? `Виден всем игрокам партии (${players.length}). Переключите на «Выбранные», чтобы скрыть от части состава.`
            : 'Виден всем игрокам партии.'}
        </p>
      )}

      {isPersonal && (
        <p className="text-[11px] text-primary/80 leading-snug">
          Виден только: {value.length > 0
            ? players
                .filter((p) => value.includes(p.userId))
                .map((p) => p.characterName || p.displayName)
                .join(', ')
            : 'вся партия'}
          . Остальные игроки не увидят ни запись, ни заметки к ней.
        </p>
      )}
    </div>
  );
};
