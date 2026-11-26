import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  Check,
  Lock,
  Plus,
  Unlock,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import { getSlotTheme, getUserThemeSlot } from '../../lib/theme';
import type { ChatParticipantBadge, ChatPoll, NextSessionBanner } from '../../lib/types';
import { formatRussianSessionSlot } from './PollComposerModal';

interface PollCardProps {
  poll: ChatPoll;
  compact?: boolean;
}

function getParticipantColor(p: Pick<ChatParticipantBadge, 'role' | 'playerId'>): string {
  const slot = getUserThemeSlot(p);
  return getSlotTheme(slot).primary;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, compact = false }) => {
  const user = useCampaignStore((s) => s.user);
  const updateChatPollInStore = useCampaignStore((s) => s.updateChatPollInStore);
  const setNextSessionInStore = useCampaignStore((s) => s.setNextSessionInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [busyOptionId, setBusyOptionId] = useState<number | null>(null);
  const [addingOption, setAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('19:00');
  const [submittingOption, setSubmittingOption] = useState(false);
  const [togglingClose, setTogglingClose] = useState(false);
  const [confirmingOptionId, setConfirmingOptionId] = useState<number | null>(null);

  const canManage = Boolean(user && (user.role === 'dm' || user.id === poll.creatorId));
  const canAddOption =
    !poll.isClosed && Boolean(user && (poll.allowAddOptions || canManage));

  const maxVotes = useMemo(() => {
    let m = 0;
    for (const o of poll.options) {
      if (o.voteCount > m) m = o.voteCount;
    }
    return m;
  }, [poll.options]);

  const handleToggleVote = async (optionId: number) => {
    if (!user || poll.isClosed || busyOptionId !== null) return;
    setBusyOptionId(optionId);
    try {
      const res = await apiFetch<{ poll: ChatPoll }>(`/api/chat/polls/${poll.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionId }),
      });
      updateChatPollInStore(res.poll);
    } catch (err) {
      pushToast({
        title: 'Ошибка голосования',
        message: err instanceof Error ? err.message : 'Не удалось сохранить голос',
        variant: 'error',
      });
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    let label = newOptionText.trim();
    let dateIso: string | null = null;

    if (poll.kind === 'date' && !label && newSlotDate) {
      label = formatRussianSessionSlot(newSlotDate, newSlotTime);
      dateIso = newSlotTime ? `${newSlotDate}T${newSlotTime}` : newSlotDate;
    } else if (poll.kind === 'date' && newSlotDate) {
      dateIso = newSlotTime ? `${newSlotDate}T${newSlotTime}` : newSlotDate;
    }

    if (!label) return;

    setSubmittingOption(true);
    try {
      const res = await apiFetch<{ poll: ChatPoll }>(`/api/chat/polls/${poll.id}/options`, {
        method: 'POST',
        body: JSON.stringify({ label, dateIso }),
      });
      updateChatPollInStore(res.poll);
      setNewOptionText('');
      setNewSlotDate('');
      setAddingOption(false);
    } catch (err) {
      pushToast({
        title: 'Не удалось добавить вариант',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setSubmittingOption(false);
    }
  };

  const handleToggleClose = async () => {
    if (!canManage || togglingClose) return;
    setTogglingClose(true);
    try {
      const res = await apiFetch<{ poll: ChatPoll }>(`/api/chat/polls/${poll.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ isClosed: !poll.isClosed }),
      });
      updateChatPollInStore(res.poll);
    } catch (err) {
      pushToast({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось изменить статус опроса',
        variant: 'error',
      });
    } finally {
      setTogglingClose(false);
    }
  };

  const handleConfirmSessionDate = async (optionId: number) => {
    if (!canManage || confirmingOptionId !== null) return;
    setConfirmingOptionId(optionId);
    try {
      const res = await apiFetch<{ poll: ChatPoll; nextSession: NextSessionBanner }>(
        `/api/chat/polls/${poll.id}/confirm-session`,
        {
          method: 'POST',
          body: JSON.stringify({ optionId }),
        }
      );
      updateChatPollInStore(res.poll);
      setNextSessionInStore(res.nextSession);
      pushToast({
        title: 'Дата игры утверждена',
        message: `Следующий сбор: ${res.nextSession.label}`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось утвердить дату',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setConfirmingOptionId(null);
    }
  };

  return (
    <div
      className={`bg-deep border border-border hud-cut-sm ${
        compact ? 'p-3' : 'p-3.5 sm:p-4'
      } space-y-3 max-w-xl w-full`}
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
            {poll.kind === 'date' ? (
              <>
                <CalendarClock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Выбор даты игры</span>
              </>
            ) : (
              <>
                <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Голосование</span>
              </>
            )}
          </span>

          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span>{poll.isAnonymous ? 'Анонимный' : 'Открытый'}</span>
            <span>·</span>
            <span>{poll.allowMultiple ? 'Несколько ответов' : 'Один ответ'}</span>
            {poll.isClosed && (
              <>
                <span>·</span>
                <span className="text-warning font-medium">Завершено</span>
              </>
            )}
          </div>
        </div>

        <div className="text-sm font-medium text-text leading-snug">{poll.question}</div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const votedByMe = Boolean(user && opt.userIds.includes(user.id));
          const pct =
            poll.totalVoters > 0
              ? Math.round((opt.voteCount / poll.totalVoters) * 100)
              : 0;
          const isLeader = maxVotes > 0 && opt.voteCount === maxVotes;
          const isFullParty = opt.voteCount >= 4;
          const isConfirmed = poll.confirmedOptionId === opt.id;

          return (
            <div key={opt.id} className="space-y-1">
              <button
                type="button"
                disabled={poll.isClosed || busyOptionId !== null}
                onClick={() => handleToggleVote(opt.id)}
                className={`relative w-full text-left overflow-hidden border transition-colors p-2.5 ${
                  isConfirmed
                    ? 'border-positive/60 bg-surface'
                    : votedByMe
                      ? 'border-primary/60 bg-surface'
                      : 'border-border bg-surface/60 hover:bg-surface hover:border-border'
                } ${poll.isClosed ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {/* Progress Fill */}
                <div
                  className={`absolute inset-y-0 left-0 pointer-events-none transition-all duration-300 ${
                    isConfirmed
                      ? 'bg-positive/15'
                      : isLeader
                        ? 'bg-primary/15'
                        : 'bg-white/[0.04]'
                  }`}
                  style={{ width: `${pct}%` }}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-4 h-4 shrink-0 flex items-center justify-center border transition-colors ${
                        votedByMe
                          ? 'bg-primary border-primary text-deep'
                          : 'border-border bg-deep'
                      }`}
                    >
                      {votedByMe && <Check className="w-3 h-3" strokeWidth={2.2} />}
                    </span>
                    <span className="text-xs sm:text-sm text-text leading-snug break-words">
                      {opt.label}
                    </span>
                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] bg-positive/15 border border-positive/40 text-positive shrink-0">
                        <CalendarCheck2 className="w-3 h-3" strokeWidth={1.5} />
                        <span>Выбрано</span>
                      </span>
                    )}
                    {!isConfirmed && isFullParty && poll.kind === 'date' && (
                      <span className="px-1.5 py-0.5 text-[11px] bg-positive/15 border border-positive/40 text-positive shrink-0">
                        Все могут
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                    <span className={isLeader ? 'text-text font-medium' : 'text-secondary'}>
                      {opt.voteCount}
                    </span>
                    <span className="text-muted w-9 text-right">{pct}%</span>
                  </div>
                </div>
              </button>

              {/* Open Voter Chips + DM/Author Confirm Date Action */}
              {((!poll.isAnonymous && opt.voters.length > 0) ||
                (canManage && poll.kind === 'date' && opt.dateIso && !isConfirmed)) && (
                <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!poll.isAnonymous &&
                      opt.voters.map((v) => {
                        const dotColor = getParticipantColor(v);
                        return (
                          <span
                            key={v.userId}
                            className="inline-flex items-center gap-1 text-[11px] text-secondary bg-surface px-1.5 py-0.5 border border-border"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: dotColor }}
                            />
                            <span>{v.displayName}</span>
                          </span>
                        );
                      })}
                  </div>

                  {canManage && poll.kind === 'date' && !isConfirmed && (
                    <button
                      type="button"
                      disabled={confirmingOptionId !== null}
                      onClick={() => handleConfirmSessionDate(opt.id)}
                      className="text-[11px] text-muted hover:text-positive transition-colors ml-auto inline-flex items-center gap-1"
                      title="Назначить этот вариант датой следующей игры"
                    >
                      <CalendarCheck2 className="w-3 h-3" strokeWidth={1.5} />
                      <span>
                        {confirmingOptionId === opt.id ? 'Сохранение…' : 'Утвердить дату'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Option Inline Form */}
      {canAddOption && (
        <div>
          {!addingOption ? (
            <button
              type="button"
              onClick={() => setAddingOption(true)}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>
                {poll.kind === 'date' ? 'Предложить другое время' : 'Добавить вариант'}
              </span>
            </button>
          ) : (
            <form onSubmit={handleAddOption} className="p-2.5 bg-surface border border-border space-y-2">
              {poll.kind === 'date' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={newSlotDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      setNewSlotDate(d);
                      if (d) {
                        setNewOptionText(formatRussianSessionSlot(d, newSlotTime));
                      }
                    }}
                    className="anime-input px-2 py-1 text-xs font-mono tabular-nums"
                  />
                  <input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => {
                      const t = e.target.value;
                      setNewSlotTime(t);
                      if (newSlotDate) {
                        setNewOptionText(formatRussianSessionSlot(newSlotDate, t));
                      }
                    }}
                    className="anime-input px-2 py-1 text-xs font-mono tabular-nums w-24"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  placeholder={
                    poll.kind === 'date'
                      ? 'Например: Воскресенье после 19:30'
                      : 'Ваш вариант ответа'
                  }
                  className="anime-input flex-1 px-2.5 py-1 text-xs"
                />
                <button
                  type="submit"
                  disabled={submittingOption}
                  className="anime-btn-primary h-7 px-2.5 text-xs"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setAddingOption(false)}
                  className="anime-btn-secondary h-7 px-2 text-xs"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-border flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="font-mono tabular-nums">
          Проголосовало: {poll.totalVoters}
        </span>

        {canManage && (
          <button
            type="button"
            disabled={togglingClose}
            onClick={handleToggleClose}
            className="inline-flex items-center gap-1 text-secondary hover:text-text transition-colors"
          >
            {poll.isClosed ? (
              <>
                <Unlock className="w-3 h-3" strokeWidth={1.5} />
                <span>Открыть снова</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" strokeWidth={1.5} />
                <span>Завершить опрос</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
