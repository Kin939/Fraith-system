import React, { useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  CalendarPlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { ChatPollKind } from '../../lib/types';

export interface CreatePollPayload {
  kind: ChatPollKind;
  question: string;
  options: Array<{ label: string; dateIso: string | null }>;
  allowMultiple: boolean;
  isAnonymous: boolean;
  allowAddOptions: boolean;
  comment: string;
  pinMessage: boolean;
}

interface PollComposerModalProps {
  initialKind?: ChatPollKind;
  onClose: () => void;
  onSubmit: (payload: CreatePollPayload) => Promise<void>;
}

const RU_WEEKDAYS = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
];

const RU_MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatRussianSessionSlot(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return `${dateStr} ${timeStr}`.trim();
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  const weekday = RU_WEEKDAYS[dt.getDay()] ?? '';
  const monthName = RU_MONTHS_GENITIVE[dt.getMonth()] ?? '';
  const cleanTime = (timeStr || '').trim();
  return cleanTime
    ? `${weekday}, ${d} ${monthName} · ${cleanTime}`
    : `${weekday}, ${d} ${monthName}`;
}

function getUpcomingDayIso(targetDayOfWeek: number, offsetWeeks = 0): string {
  const now = new Date();
  const currentDay = now.getDay();
  let diff = (targetDayOfWeek - currentDay + 7) % 7;
  if (diff === 0) diff = 7;
  diff += offsetWeeks * 7;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildDefaultWeekendSlots(): Array<{ label: string; dateIso: string | null }> {
  const fri = getUpcomingDayIso(5, 0);
  const sat = getUpcomingDayIso(6, 0);
  const sun = getUpcomingDayIso(0, 0);
  return [
    {
      label: formatRussianSessionSlot(fri, '19:00'),
      dateIso: `${fri}T19:00`,
    },
    {
      label: formatRussianSessionSlot(sat, '18:00'),
      dateIso: `${sat}T18:00`,
    },
    {
      label: formatRussianSessionSlot(sun, '17:00'),
      dateIso: `${sun}T17:00`,
    },
  ];
}

export const PollComposerModal: React.FC<PollComposerModalProps> = ({
  initialKind = 'date',
  onClose,
  onSubmit,
}) => {
  const [kind, setKind] = useState<ChatPollKind>(initialKind);
  const [question, setQuestion] = useState(
    initialKind === 'date' ? 'Когда собираемся на следующую игру?' : ''
  );
  const [options, setOptions] = useState<Array<{ label: string; dateIso: string | null }>>(() =>
    initialKind === 'date'
      ? buildDefaultWeekendSlots()
      : [
          { label: '', dateIso: null },
          { label: '', dateIso: null },
        ]
  );

  const [slotDate, setSlotDate] = useState<string>(() => getUpcomingDayIso(6, 0));
  const [slotTime, setSlotTime] = useState<string>('18:00');
  const [allowMultiple, setAllowMultiple] = useState<boolean>(initialKind === 'date');
  const [allowAddOptions, setAllowAddOptions] = useState<boolean>(initialKind === 'date');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [pinMessage, setPinMessage] = useState<boolean>(initialKind === 'date');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchKind = (nextKind: ChatPollKind) => {
    setKind(nextKind);
    setError(null);
    if (nextKind === 'date') {
      if (!question.trim()) {
        setQuestion('Когда собираемся на следующую игру?');
      }
      if (options.every((o) => !o.label.trim())) {
        setOptions(buildDefaultWeekendSlots());
      }
      setAllowMultiple(true);
      setAllowAddOptions(true);
      setIsAnonymous(false);
      setPinMessage(true);
    } else {
      if (question === 'Когда собираемся на следующую игру?') {
        setQuestion('');
      }
      if (options.some((o) => o.dateIso)) {
        setOptions([
          { label: '', dateIso: null },
          { label: '', dateIso: null },
        ]);
      }
      setPinMessage(false);
    }
  };

  const handleAddCalendarSlot = () => {
    if (!slotDate) return;
    const formatted = formatRussianSessionSlot(slotDate, slotTime);
    const iso = slotTime ? `${slotDate}T${slotTime}` : slotDate;
    setOptions((prev) => [...prev.filter((o) => o.label.trim() !== ''), { label: formatted, dateIso: iso }]);
  };

  const handleAddPassOption = () => {
    const passLabel = 'На этих выходных не смогу / пас';
    if (options.some((o) => o.label === passLabel)) return;
    setOptions((prev) => [...prev, { label: passLabel, dateIso: null }]);
  };

  const handleAddBlankOption = () => {
    if (options.length >= 20) return;
    setOptions((prev) => [...prev, { label: '', dateIso: null }]);
  };

  const handleOptionChange = (idx: number, value: string) => {
    setOptions((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, label: value } : item))
    );
  };

  const handleRemoveOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = question.trim();
    const cleanOptions = options
      .map((o) => ({ label: o.label.trim(), dateIso: o.dateIso }))
      .filter((o) => o.label.length > 0);

    if (!cleanQuestion) {
      setError('Укажите тему голосования');
      return;
    }
    if (cleanOptions.length < 2) {
      setError('Добавьте минимум 2 варианта ответа');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        kind,
        question: cleanQuestion,
        options: cleanOptions,
        allowMultiple,
        isAnonymous,
        allowAddOptions,
        comment: comment.trim(),
        pinMessage,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать голосование');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-surface border border-border hud-cut shadow-glass overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-deep border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {kind === 'date' ? (
              <CalendarClock className="w-4 h-4 text-primary" strokeWidth={1.5} />
            ) : (
              <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.5} />
            )}
            <h2 className="text-base font-medium text-text">
              {kind === 'date' ? 'Планирование даты игры' : 'Новое голосование в чате'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text p-1 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Poll Kind Switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchKind('date')}
              className={`h-9 px-3 text-xs flex items-center justify-center gap-2 border transition-colors ${
                kind === 'date'
                  ? 'bg-raised border-primary text-text font-medium'
                  : 'bg-deep border-border text-secondary hover:text-text'
              }`}
            >
              <CalendarClock className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <span>Выбор даты игры</span>
            </button>
            <button
              type="button"
              onClick={() => switchKind('general')}
              className={`h-9 px-3 text-xs flex items-center justify-center gap-2 border transition-colors ${
                kind === 'general'
                  ? 'bg-raised border-primary text-text font-medium'
                  : 'bg-deep border-border text-secondary hover:text-text'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <span>Обычный опрос</span>
            </button>
          </div>

          {/* Question */}
          <div className="space-y-1.5">
            <label className="block text-xs text-secondary">Вопрос или название сбора</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                kind === 'date'
                  ? 'Когда собираемся на следующую сессию?'
                  : 'Например: Куда направляемся из города или что заказываем к игре?'
              }
              className="anime-input w-full px-3 py-2 text-sm"
            />
          </div>

          {/* Date-Time Slot Builder (only in Date Poll mode) */}
          {kind === 'date' && (
            <div className="p-3 bg-deep border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-secondary">
                  Добавить слот по календарю
                </span>
                <button
                  type="button"
                  onClick={handleAddPassOption}
                  className="text-xs text-primary hover:underline"
                >
                  + Вариант «Не смогу»
                </button>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="anime-input px-2.5 py-1.5 text-xs font-mono tabular-nums flex-1 min-w-[140px]"
                />
                <input
                  type="time"
                  value={slotTime}
                  onChange={(e) => setSlotTime(e.target.value)}
                  className="anime-input px-2.5 py-1.5 text-xs font-mono tabular-nums w-28"
                />
                <button
                  type="button"
                  onClick={handleAddCalendarSlot}
                  className="anime-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5 shrink-0"
                >
                  <CalendarPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>В список</span>
                </button>
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary">
                Варианты ответа ({options.length})
              </span>
              <button
                type="button"
                onClick={handleAddBlankOption}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Свой вариант</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-right font-mono text-xs text-muted tabular-nums shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Вариант ${idx + 1}`}
                    className="anime-input flex-1 px-3 py-1.5 text-sm"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-negative transition-colors shrink-0"
                      title="Удалить вариант"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Optional note / message */}
          <div className="space-y-1.5">
            <label className="block text-xs text-secondary">
              Комментарий к голосованию (необязательно)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Например: Отметьте все дни, когда свободны после 18:30"
              className="anime-input w-full px-3 py-2 text-xs"
            />
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <label className="flex items-center gap-2.5 p-2.5 bg-deep border border-border cursor-pointer text-xs text-text">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              <span>Выбор нескольких вариантов</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 bg-deep border border-border cursor-pointer text-xs text-text">
              <input
                type="checkbox"
                checked={allowAddOptions}
                onChange={(e) => setAllowAddOptions(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              <span>Участники могут добавлять варианты</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 bg-deep border border-border cursor-pointer text-xs text-text">
              <input
                type="checkbox"
                checked={pinMessage}
                onChange={(e) => setPinMessage(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              <span>Закрепить в шапке мессенджера</span>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 bg-deep border border-border cursor-pointer text-xs text-text">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              <span>Анонимное голосование</span>
            </label>
          </div>

          {error && (
            <div className="p-2.5 bg-negative/10 border border-negative/40 text-xs text-negative">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="anime-btn-secondary h-9 px-4 text-xs"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-2"
            >
              <span>{submitting ? 'Публикация…' : 'Опубликовать голосование'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
