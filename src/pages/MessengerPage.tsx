import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  Download,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { PlayerAvatar } from '../components/common/PlayerAvatar';
import {
  CustomEmojiGlyph,
  RichEmojiText,
} from '../components/messenger/CustomEmoji';
import {
  EmojiPickerPopover,
  QUICK_REACTION_EMOJIS,
  recordRecentEmoji,
} from '../components/messenger/EmojiPickerPopover';
import { PollCard } from '../components/messenger/PollCard';
import {
  CreatePollPayload,
  formatRussianSessionSlot,
  PollComposerModal,
} from '../components/messenger/PollComposerModal';
import { sendCampaignSocketMessage } from '../hooks/useWebSocket';
import { apiFetch, uploadChatAttachment } from '../lib/api';
import { ensureEmojiPackLoaded } from '../lib/emojiPack';
import { useCampaignStore } from '../lib/store';
import { getSlotTheme, getUserThemeSlot } from '../lib/theme';
import type {
  ChatAttachment,
  ChatMessage,
  ChatPollKind,
  CustomCampaignEmoji,
  NextSessionBanner,
  PlayerId,
  UserRole,
} from '../lib/types';

type MessengerFilterTab = 'all' | 'polls' | 'files' | 'pinned';

const RU_MONTHS = [
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

function parseSqliteUtcDate(raw: string): Date {
  if (!raw) return new Date();
  if (raw.includes('T')) {
    return new Date(raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`);
  }
  return new Date(`${raw.replace(' ', 'T')}Z`);
}

function formatMessageTime(raw: string): string {
  const dt = parseSqliteUtcDate(raw);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDayHeading(raw: string): string {
  const dt = parseSqliteUtcDate(raw);
  if (Number.isNaN(dt.getTime())) return '';
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
  const msgKey = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;

  if (msgKey === todayKey) return 'Сегодня';
  if (msgKey === yesterdayKey) return 'Вчера';

  const day = dt.getDate();
  const month = RU_MONTHS[dt.getMonth()] ?? '';
  return dt.getFullYear() === now.getFullYear()
    ? `${day} ${month}`
    : `${day} ${month} ${dt.getFullYear()}`;
}

function getDayGroupKey(raw: string): string {
  const dt = parseSqliteUtcDate(raw);
  if (Number.isNaN(dt.getTime())) return raw.slice(0, 10);
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function buildDownloadUrl(att: ChatAttachment): string {
  const sep = att.url.includes('?') ? '&' : '?';
  return `${att.url}${sep}name=${encodeURIComponent(att.name)}`;
}

function getSenderAccentColor(role: UserRole, playerId: PlayerId | null): string {
  const slot = getUserThemeSlot({ role, playerId });
  return getSlotTheme(slot).primary;
}

function renderFileIcon(att: ChatAttachment) {
  const lower = att.name.toLowerCase();
  if (att.kind === 'audio') return <FileAudio className="w-4 h-4 text-primary" strokeWidth={1.5} />;
  if (att.kind === 'video') return <FileVideo className="w-4 h-4 text-primary" strokeWidth={1.5} />;
  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) {
    return <FileArchive className="w-4 h-4 text-primary" strokeWidth={1.5} />;
  }
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
    return <FileSpreadsheet className="w-4 h-4 text-primary" strokeWidth={1.5} />;
  }
  if (lower.endsWith('.json') || lower.endsWith('.md')) {
    return <FileCode2 className="w-4 h-4 text-primary" strokeWidth={1.5} />;
  }
  return <FileText className="w-4 h-4 text-primary" strokeWidth={1.5} />;
}

export const MessengerPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const messages = useCampaignStore((s) => s.chatMessages);
  const nextSession = useCampaignStore((s) => s.nextSession);
  const onlineUsers = useCampaignStore((s) => s.onlineUsers);
  const typingUsers = useCampaignStore((s) => s.typingUsers);
  const charactersById = useCampaignStore((s) => s.charactersById);

  const setChatMessages = useCampaignStore((s) => s.setChatMessages);
  const setCustomEmojis = useCampaignStore((s) => s.setCustomEmojis);
  const upsertChatMessage = useCampaignStore((s) => s.upsertChatMessage);
  const removeChatMessage = useCampaignStore((s) => s.removeChatMessage);
  const setNextSessionInStore = useCampaignStore((s) => s.setNextSessionInStore);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [filterTab, setFilterTab] = useState<MessengerFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Modals & Popovers
  const [pollModalKind, setPollModalKind] = useState<ChatPollKind | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<number | null>(null);
  const [fullEmojiReactionMsgId, setFullEmojiReactionMsgId] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<ChatAttachment | null>(null);
  const [editingSessionBanner, setEditingSessionBanner] = useState(false);
  const [sessionDateInput, setSessionDateInput] = useState('');
  const [sessionTimeInput, setSessionTimeInput] = useState('19:00');
  const [sessionLabelInput, setSessionLabelInput] = useState('');
  const [sessionNoteInput, setSessionNoteInput] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Scroll & Drag-drop state
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  const streamRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);
  const lastTypingSentRef = useRef<number>(0);

  // Preload stylized emoji pack & refresh latest messages on mount
  useEffect(() => {
    void ensureEmojiPackLoaded();
    let active = true;
    void apiFetch<{
      messages: ChatMessage[];
      nextSession: NextSessionBanner | null;
      customEmojis?: CustomCampaignEmoji[];
    }>('/api/chat')
      .then((res) => {
        if (!active) return;
        setChatMessages(res.messages);
        setNextSessionInStore(res.nextSession);
        if (Array.isArray(res.customEmojis)) {
          setCustomEmojis(res.customEmojis);
        }
      })
      .catch(() => {
        // Already loaded via bootstrap
      });
    return () => {
      active = false;
    };
  }, [setChatMessages, setCustomEmojis, setNextSessionInStore]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (filterTab === 'all' && stickToBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [messages.length, filterTab, scrollToBottom]);

  const handleStreamScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 120;
    setShowScrollBottomBtn(distanceFromBottom > 260);
  };

  const jumpToMessage = (messageId: number) => {
    if (filterTab !== 'all') {
      setFilterTab('all');
    }
    window.setTimeout(() => {
      const target = document.getElementById(`chat-msg-${messageId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMsgId(messageId);
        window.setTimeout(() => {
          setHighlightedMsgId((cur) => (cur === messageId ? null : cur));
        }, 2000);
      }
    }, 60);
  };

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.isPinned),
    [messages]
  );

  const latestPinned = pinnedMessages[pinnedMessages.length - 1] ?? null;

  const pollMessages = useMemo(
    () => messages.filter((m) => m.poll !== null).slice().reverse(),
    [messages]
  );

  const allAttachmentsList = useMemo(() => {
    const items: Array<{ attachment: ChatAttachment; message: ChatMessage }> = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      for (const att of m.attachments) {
        items.push({ attachment: att, message: m });
      }
    }
    return items;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      if (filterTab === 'pinned' && !m.isPinned) return false;
      if (!q) return true;
      if (m.content.toLowerCase().includes(q)) return true;
      if (m.senderDisplayName.toLowerCase().includes(q)) return true;
      if (m.poll?.question.toLowerCase().includes(q)) return true;
      if (m.attachments.some((a) => a.name.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [messages, filterTab, searchQuery]);

  const getSenderSubtitle = (msg: ChatMessage): string => {
    if (msg.senderRole === 'dm') return 'Мастер';
    if (msg.senderPlayerId) {
      const charName = charactersById[msg.senderPlayerId]?.characterName?.trim();
      if (charName) return charName;
      return `Игрок ${msg.senderPlayerId}`;
    }
    return 'Игрок';
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 10 - pendingAttachments.length);
    if (files.length === 0) return;

    setUploadingCount((c) => c + files.length);
    for (const file of files) {
      try {
        const res = await uploadChatAttachment(file);
        setPendingAttachments((prev) => [...prev, res.attachment]);
      } catch (err) {
        pushToast({
          title: `Не удалось прикрепить ${file.name}`,
          message: err instanceof Error ? err.message : 'Ошибка загрузки файла',
          variant: 'error',
        });
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      e.preventDefault();
      void handleUploadFiles(clipboardFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void handleUploadFiles(e.dataTransfer.files);
    }
  };

  const insertEmojiAtCursor = (emojiToken: string) => {
    const needsSpacer = emojiToken.startsWith(':') && emojiToken.endsWith(':');
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => {
        const prefix =
          needsSpacer && prev.length > 0 && !/\s$/.test(prev) ? `${prev} ` : prev;
        return `${prefix}${emojiToken}${needsSpacer ? ' ' : ''}`;
      });
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(end);
    const padLeft = needsSpacer && before.length > 0 && !/\s$/.test(before) ? ' ' : '';
    const padRight = needsSpacer && (after.length === 0 || !/^\s/.test(after)) ? ' ' : '';
    const inserted = `${padLeft}${emojiToken}${padRight}`;
    const next = before + inserted + after;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2400) {
      lastTypingSentRef.current = now;
      sendCampaignSocketMessage('chat:typing', {});
    }
  };

  const handleSendOrSaveEdit = async () => {
    if (sending || uploadingCount > 0) return;

    if (editingMessage) {
      const clean = draft.trim();
      if (!clean && editingMessage.attachments.length === 0 && !editingMessage.pollId) return;
      setSending(true);
      try {
        const res = await apiFetch<{ message: ChatMessage }>(
          `/api/chat/messages/${editingMessage.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({ content: clean }),
          }
        );
        upsertChatMessage(res.message, false);
        setEditingMessage(null);
        setDraft('');
      } catch (err) {
        pushToast({
          title: 'Не удалось сохранить изменения',
          message: err instanceof Error ? err.message : 'Попробуйте снова',
          variant: 'error',
        });
      } finally {
        setSending(false);
      }
      return;
    }

    const clean = draft.trim();
    if (!clean && pendingAttachments.length === 0) return;

    setSending(true);
    try {
      const res = await apiFetch<{ message: ChatMessage }>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          content: clean,
          replyToId: replyTo?.id ?? null,
          attachments: pendingAttachments,
        }),
      });
      stickToBottomRef.current = true;
      upsertChatMessage(res.message, false);
      setDraft('');
      setPendingAttachments([]);
      setReplyTo(null);
      setShowEmojiPicker(false);
      requestAnimationFrame(() => scrollToBottom('smooth'));
    } catch (err) {
      pushToast({
        title: 'Ошибка отправки сообщения',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreatePoll = async (payload: CreatePollPayload) => {
    const res = await apiFetch<{ message: ChatMessage }>('/api/chat/polls', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    stickToBottomRef.current = true;
    upsertChatMessage(res.message, false);
    if (filterTab !== 'all' && filterTab !== 'polls') {
      setFilterTab('all');
    }
    requestAnimationFrame(() => scrollToBottom('smooth'));
  };

  const handleToggleReaction = async (messageId: number, emoji: string) => {
    recordRecentEmoji(emoji);
    setReactionPickerMsgId(null);
    setFullEmojiReactionMsgId(null);
    try {
      const res = await apiFetch<{ message: ChatMessage }>(
        `/api/chat/messages/${messageId}/react`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }
      );
      upsertChatMessage(res.message, false);
    } catch (err) {
      pushToast({
        title: 'Ошибка реакции',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    }
  };

  const handleTogglePin = async (msg: ChatMessage) => {
    try {
      const res = await apiFetch<{ message: ChatMessage }>(
        `/api/chat/messages/${msg.id}/pin`,
        {
          method: 'POST',
          body: JSON.stringify({ isPinned: !msg.isPinned }),
        }
      );
      upsertChatMessage(res.message, false);
      pushToast({
        title: res.message.isPinned ? 'Сообщение закреплено' : 'Сообщение откреплено',
        message: res.message.isPinned
          ? 'Оно доступно в шапке мессенджера и во вкладке «Закреплённые»'
          : 'Сообщение убрано из закреплённых',
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось изменить закрепление',
        variant: 'error',
      });
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!window.confirm('Удалить это сообщение для всех участников?')) return;
    try {
      await apiFetch(`/api/chat/messages/${msg.id}`, { method: 'DELETE' });
      removeChatMessage(msg.id);
    } catch (err) {
      pushToast({
        title: 'Не удалось удалить сообщение',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    }
  };

  const openSessionEditor = () => {
    setSessionLabelInput(nextSession?.label ?? '');
    setSessionNoteInput(nextSession?.note ?? '');
    setSessionDateInput('');
    setEditingSessionBanner(true);
  };

  const handleSaveNextSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const label =
      sessionLabelInput.trim() ||
      (sessionDateInput ? formatRussianSessionSlot(sessionDateInput, sessionTimeInput) : '');
    if (!label) return;

    setSavingSession(true);
    try {
      const res = await apiFetch<{ nextSession: NextSessionBanner }>('/api/chat/session', {
        method: 'PUT',
        body: JSON.stringify({
          label,
          dateIso: sessionDateInput
            ? sessionTimeInput
              ? `${sessionDateInput}T${sessionTimeInput}`
              : sessionDateInput
            : nextSession?.dateIso ?? null,
          note: sessionNoteInput.trim(),
        }),
      });
      setNextSessionInStore(res.nextSession);
      setEditingSessionBanner(false);
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения сбора',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    } finally {
      setSavingSession(false);
    }
  };

  const handleClearNextSession = async () => {
    try {
      await apiFetch('/api/chat/session', { method: 'DELETE' });
      setNextSessionInStore(null);
      setEditingSessionBanner(false);
    } catch (err) {
      pushToast({
        title: 'Ошибка',
        message: err instanceof Error ? err.message : 'Не удалось очистить дату сбора',
        variant: 'error',
      });
    }
  };

  if (!user) return null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDraggingFiles) setIsDraggingFiles(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDraggingFiles(false);
        }
      }}
      onDrop={handleDrop}
      className="relative flex flex-col h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-4rem)] min-h-[540px] glass-panel hud-cut border border-border overflow-hidden"
    >
      {/* Drag & Drop Overlay */}
      {isDraggingFiles && (
        <div
          onDragLeave={() => setIsDraggingFiles(false)}
          className="absolute inset-0 z-40 bg-deep/90 border-2 border-dashed border-primary flex flex-col items-center justify-center gap-2 pointer-events-none"
        >
          <UploadCloud className="w-8 h-8 text-primary" strokeWidth={1.5} />
          <div className="text-sm font-medium text-text">
            Отпустите файлы или изображения, чтобы прикрепить к сообщению
          </div>
          <div className="text-xs text-muted">До 8 МБ на файл · изображения, PDF, JSON, архивы</div>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="bg-deep border-b border-border px-4 py-3 space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MessageSquare className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-medium text-text truncate">
                  Мессенджер и планирование игр
                </h1>
                <span className="text-xs font-mono text-muted tabular-nums shrink-0">
                  В сети: {onlineUsers.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPollModalKind('date')}
              className="anime-btn-primary h-8 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <CalendarClock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Выбрать дату игры</span>
            </button>
            <button
              type="button"
              onClick={() => setPollModalKind('general')}
              className="anime-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Опрос</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Чат', count: messages.length },
                { id: 'polls', label: 'Голосования', count: pollMessages.length },
                { id: 'files', label: 'Медиа и файлы', count: allAttachmentsList.length },
                { id: 'pinned', label: 'Закреплённые', count: pinnedMessages.length },
              ] as Array<{ id: MessengerFilterTab; label: string; count: number }>
            ).map((t) => {
              const active = filterTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterTab(t.id)}
                  className={`h-8 px-2.5 text-xs inline-flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-raised text-text font-medium border-b-primary'
                      : 'text-secondary hover:text-text border-b-transparent'
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className="font-mono text-[11px] text-muted tabular-nums">
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-56">
            <Search
              className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск в мессенджере…"
              className="anime-input w-full pl-8 pr-7 py-1 text-xs h-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Next Session Schedule Banner */}
      <div className="bg-surface border-b border-border px-4 py-2 shrink-0">
        {!editingSessionBanner ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {nextSession ? (
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <CalendarCheck2 className="w-4 h-4 text-positive shrink-0" strokeWidth={1.5} />
                <span className="text-muted">Следующая сессия:</span>
                <span className="font-medium text-text tabular-nums">{nextSession.label}</span>
                {nextSession.note && (
                  <span className="text-secondary truncate max-w-md">
                    · {nextSession.note}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted">
                <CalendarClock className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} />
                <span>Дата следующей игры пока не утверждена</span>
              </div>
            )}

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={openSessionEditor}
                className="text-xs text-primary hover:underline"
              >
                {nextSession ? 'Изменить дату' : 'Назначить вручную'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveNextSession} className="flex flex-wrap items-center gap-2 py-0.5">
            <input
              type="date"
              value={sessionDateInput}
              onChange={(e) => {
                const d = e.target.value;
                setSessionDateInput(d);
                if (d) {
                  setSessionLabelInput(formatRussianSessionSlot(d, sessionTimeInput));
                }
              }}
              className="anime-input px-2 py-1 text-xs font-mono tabular-nums"
            />
            <input
              type="time"
              value={sessionTimeInput}
              onChange={(e) => {
                const t = e.target.value;
                setSessionTimeInput(t);
                if (sessionDateInput) {
                  setSessionLabelInput(formatRussianSessionSlot(sessionDateInput, t));
                }
              }}
              className="anime-input px-2 py-1 text-xs font-mono tabular-nums w-24"
            />
            <input
              type="text"
              value={sessionLabelInput}
              onChange={(e) => setSessionLabelInput(e.target.value)}
              placeholder="Например: Суббота, 28 ноября · 18:00"
              className="anime-input px-2.5 py-1 text-xs flex-1 min-w-[200px]"
            />
            <input
              type="text"
              value={sessionNoteInput}
              onChange={(e) => setSessionNoteInput(e.target.value)}
              placeholder="Заметка (Discord / адрес / уровень)"
              className="anime-input px-2.5 py-1 text-xs flex-1 min-w-[180px]"
            />
            <button
              type="submit"
              disabled={savingSession}
              className="anime-btn-primary h-7 px-3 text-xs"
            >
              Сохранить
            </button>
            {nextSession && (
              <button
                type="button"
                onClick={handleClearNextSession}
                className="anime-btn-secondary h-7 px-2.5 text-xs text-negative"
              >
                Сбросить
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditingSessionBanner(false)}
              className="anime-btn-secondary h-7 px-2.5 text-xs"
            >
              Отмена
            </button>
          </form>
        )}
      </div>

      {/* Pinned Message Strip (shown in main chat when at least 1 message is pinned) */}
      {filterTab === 'all' && latestPinned && (
        <div className="bg-deep/90 border-b border-border px-4 py-1.5 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => jumpToMessage(latestPinned.id)}
            className="flex items-center gap-2 min-w-0 text-left flex-1 group"
          >
            <Pin className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 truncate text-xs">
              <span className="text-primary font-medium mr-1.5">Закреплено:</span>
              <span className="text-secondary group-hover:text-text transition-colors">
                {latestPinned.poll ? (
                  <RichEmojiText text={`Голосование: ${latestPinned.poll.question}`} inlineOnly />
                ) : latestPinned.content ? (
                  <RichEmojiText text={latestPinned.content} inlineOnly />
                ) : (
                  `Вложение (${latestPinned.attachments.length})`
                )}
              </span>
            </div>
          </button>
          {pinnedMessages.length > 1 && (
            <button
              type="button"
              onClick={() => setFilterTab('pinned')}
              className="text-[11px] text-muted hover:text-text shrink-0 font-mono tabular-nums"
            >
              Все ({pinnedMessages.length})
            </button>
          )}
        </div>
      )}

      {/* Main Content Area by Filter Tab */}
      {filterTab === 'polls' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {pollMessages.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CalendarClock className="w-6 h-6 text-muted mx-auto" strokeWidth={1.5} />
              <div className="text-sm text-secondary">
                Пока нет активных опросов или голосований за дату игры
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPollModalKind('date')}
                  className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5"
                >
                  <CalendarClock className="w-4 h-4" strokeWidth={1.5} />
                  <span>Создать выбор даты</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPollModalKind('general')}
                  className="anime-btn-secondary h-9 px-4 text-xs inline-flex items-center gap-1.5"
                >
                  <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
                  <span>Создать опрос</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              {pollMessages.map((m) =>
                m.poll ? (
                  <div key={m.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted px-1">
                      <span>
                        Автор: <strong className="font-medium text-secondary">{m.senderDisplayName}</strong> ·{' '}
                        {formatDayHeading(m.createdAt)} в {formatMessageTime(m.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => jumpToMessage(m.id)}
                        className="text-primary hover:underline"
                      >
                        К сообщению
                      </button>
                    </div>
                    <PollCard poll={m.poll} />
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      ) : filterTab === 'files' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {allAttachmentsList.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ImageIcon className="w-6 h-6 text-muted mx-auto" strokeWidth={1.5} />
              <div className="text-sm text-secondary">
                В чате пока нет отправленных изображений и файлов
              </div>
              <div className="text-xs text-muted">
                Перетащите файлы или скриншоты в чат, чтобы поделиться с отрядом
              </div>
            </div>
          ) : (
            <>
              {/* Shared Photos Grid */}
              {allAttachmentsList.some((x) => x.attachment.kind === 'image') && (
                <div className="space-y-2.5">
                  <h2 className="text-xs font-medium text-secondary">Изображения и карты</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {allAttachmentsList
                      .filter((x) => x.attachment.kind === 'image')
                      .map(({ attachment, message }, idx) => (
                        <div
                          key={`${attachment.key}-${idx}`}
                          className="group relative bg-deep border border-border overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setLightboxImage(attachment)}
                            className="block w-full aspect-[4/3] overflow-hidden leading-none"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              loading="lazy"
                              className="block w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                            />
                          </button>
                          <div className="p-2 flex items-center justify-between gap-2 text-[11px] text-muted">
                            <span className="truncate text-secondary">{message.senderDisplayName}</span>
                            <button
                              type="button"
                              onClick={() => jumpToMessage(message.id)}
                              className="text-primary hover:underline shrink-0"
                            >
                              В чат
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Shared Documents / Audio / Video */}
              {allAttachmentsList.some((x) => x.attachment.kind !== 'image') && (
                <div className="space-y-2.5">
                  <h2 className="text-xs font-medium text-secondary">Файлы и документы</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {allAttachmentsList
                      .filter((x) => x.attachment.kind !== 'image')
                      .map(({ attachment, message }, idx) => (
                        <div
                          key={`${attachment.key}-${idx}`}
                          className="p-3 bg-deep border border-border flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-surface border border-border flex items-center justify-center shrink-0">
                              {renderFileIcon(attachment)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-text truncate">
                                {attachment.name}
                              </div>
                              <div className="text-[11px] text-muted font-mono tabular-nums">
                                {formatFileSize(attachment.size)} · {message.senderDisplayName}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => jumpToMessage(message.id)}
                              className="anime-btn-secondary h-8 px-2.5 text-xs"
                            >
                              В чат
                            </button>
                            <a
                              href={buildDownloadUrl(attachment)}
                              download={attachment.name}
                              className="anime-btn-secondary h-8 w-8 flex items-center justify-center"
                              title="Скачать файл"
                            >
                              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Chat / Pinned Stream */
        <div
          ref={streamRef}
          onScroll={handleStreamScroll}
          className="relative flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-1"
        >
          {filteredMessages.length === 0 ? (
            <div className="py-16 text-center space-y-3 max-w-md mx-auto">
              <MessageSquare className="w-6 h-6 text-muted mx-auto" strokeWidth={1.5} />
              <div className="text-sm font-medium text-text">
                {searchQuery
                  ? 'Сообщений по запросу не найдено'
                  : filterTab === 'pinned'
                    ? 'Нет закреплённых сообщений'
                    : 'Добро пожаловать в мессенджер кампании'}
              </div>
              {!searchQuery && filterTab === 'all' && (
                <p className="text-xs text-secondary leading-relaxed">
                  Обсуждайте планы похода, делитесь картами, анкетами и файлами, а также
                  запускайте голосование за дату следующей игры. Все сообщения сохраняются в базе
                  кампании.
                </p>
              )}
            </div>
          ) : (
            filteredMessages.map((msg, idx) => {
              const prev = idx > 0 ? filteredMessages[idx - 1] : null;
              const dayKey = getDayGroupKey(msg.createdAt);
              const prevDayKey = prev ? getDayGroupKey(prev.createdAt) : null;
              const showDayDivider = dayKey !== prevDayKey;

              const prevTimeMs = prev ? parseSqliteUtcDate(prev.createdAt).getTime() : 0;
              const currTimeMs = parseSqliteUtcDate(msg.createdAt).getTime();
              const isGroupedWithPrev =
                !showDayDivider &&
                prev !== null &&
                prev.userId === msg.userId &&
                !msg.replyPreview &&
                !msg.poll &&
                currTimeMs - prevTimeMs < 5 * 60 * 1000;

              const isMine = msg.userId === user.id;
              const canDelete = isMine || user.role === 'dm';
              const accentColor = getSenderAccentColor(msg.senderRole, msg.senderPlayerId);
              const imageAttachments = msg.attachments.filter((a) => a.kind === 'image');
              const otherAttachments = msg.attachments.filter((a) => a.kind !== 'image');

              return (
                <React.Fragment key={msg.id}>
                  {showDayDivider && (
                    <div className="py-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-mono text-muted px-2.5 py-0.5 bg-deep border border-border">
                        {formatDayHeading(msg.createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <div
                    id={`chat-msg-${msg.id}`}
                    className={`group relative flex items-start gap-3 px-2.5 py-1.5 transition-colors rounded-sm ${
                      isGroupedWithPrev ? 'mt-0' : 'mt-2.5'
                    } ${
                      highlightedMsgId === msg.id
                        ? 'bg-primary/15 border border-primary/40'
                        : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    {/* Left Avatar / Time Gutter */}
                    {isGroupedWithPrev ? (
                      <div className="w-8 shrink-0 text-[10px] font-mono text-muted opacity-0 group-hover:opacity-100 text-center pt-1 tabular-nums select-none">
                        {formatMessageTime(msg.createdAt)}
                      </div>
                    ) : (
                      <PlayerAvatar
                        avatarUrl={msg.senderAvatarUrl}
                        displayName={msg.senderDisplayName}
                        role={msg.senderRole}
                        playerId={msg.senderPlayerId}
                        size="sm"
                        accentColor={accentColor}
                        className="mt-0.5"
                        title={`${msg.senderDisplayName} · портрет персонажа`}
                      />
                    )}

                    {/* Message Body */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {!isGroupedWithPrev && (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span
                            className="text-xs font-medium"
                            style={{ color: accentColor }}
                          >
                            {msg.senderDisplayName}
                          </span>
                          <span className="text-[11px] text-muted">
                            {getSenderSubtitle(msg)}
                          </span>
                          <span className="text-[11px] font-mono text-muted tabular-nums">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                          {msg.editedAt && (
                            <span className="text-[10px] text-muted">(изм.)</span>
                          )}
                          {msg.isPinned && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                              <Pin className="w-3 h-3" strokeWidth={1.5} />
                              <span>закреплено</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reply Quote */}
                      {msg.replyPreview && (
                        <button
                          type="button"
                          onClick={() => jumpToMessage(msg.replyPreview!.id)}
                          className="flex items-center gap-2 pl-2 pr-3 py-1 bg-deep border-l-2 border-l-primary text-left max-w-xl hover:bg-raised transition-colors"
                        >
                          <PlayerAvatar
                            avatarUrl={msg.replyPreview.senderAvatarUrl}
                            displayName={msg.replyPreview.senderDisplayName}
                            role={msg.replyPreview.senderRole}
                            playerId={msg.replyPreview.senderPlayerId}
                            size="xs"
                            showRoleBadge={false}
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-primary">
                              {msg.replyPreview.senderDisplayName}
                            </div>
                            <div className="text-xs text-muted truncate max-w-md">
                              {msg.replyPreview.content ? (
                                <RichEmojiText text={msg.replyPreview.content} inlineOnly />
                              ) : msg.replyPreview.hasPoll ? (
                                'Голосование'
                              ) : msg.replyPreview.hasAttachments ? (
                                'Вложение'
                              ) : (
                                'Сообщение'
                              )}
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Text Content with Stylized Custom Emojis */}
                      {msg.content && (
                        <div className="text-sm text-text whitespace-pre-wrap break-words leading-relaxed max-w-3xl">
                          <RichEmojiText
                            text={msg.content}
                            allowJumbo={msg.attachments.length === 0 && !msg.poll}
                          />
                          {isGroupedWithPrev && msg.editedAt && (
                            <span className="ml-1.5 text-[10px] text-muted">(изм.)</span>
                          )}
                        </div>
                      )}

                      {/* Image Attachments (Tight Natural Aspect Ratio for 1 Image, Cropped Collage Grid for 2+ Images — Zero Black Bars) */}
                      {imageAttachments.length === 1 && (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() => setLightboxImage(imageAttachments[0])}
                            className="group/img relative inline-block max-w-full sm:max-w-[360px] rounded-md overflow-hidden border border-border/80 leading-none align-top"
                          >
                            <img
                              src={imageAttachments[0].url}
                              alt={imageAttachments[0].name}
                              loading="lazy"
                              className="block w-auto h-auto max-w-full max-h-[380px] object-cover group-hover/img:brightness-105 transition"
                            />
                          </button>
                        </div>
                      )}

                      {imageAttachments.length > 1 && (
                        <div
                          className={`grid gap-1.5 pt-0.5 max-w-md ${
                            imageAttachments.length === 2 || imageAttachments.length === 4
                              ? 'grid-cols-2'
                              : 'grid-cols-2 sm:grid-cols-3'
                          }`}
                        >
                          {imageAttachments.map((img, i) => (
                            <button
                              key={`${img.key}-${i}`}
                              type="button"
                              onClick={() => setLightboxImage(img)}
                              className="group/img relative aspect-square w-full rounded-md overflow-hidden border border-border/80 leading-none"
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                loading="lazy"
                                className="block w-full h-full object-cover group-hover/img:scale-[1.03] transition-transform"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Non-Image Attachments (Audio / Video / Documents / JSON sheets) */}
                      {otherAttachments.length > 0 && (
                        <div className="space-y-1.5 pt-0.5 max-w-lg">
                          {otherAttachments.map((att, i) => {
                            if (att.kind === 'audio') {
                              return (
                                <div
                                  key={`${att.key}-${i}`}
                                  className="p-2.5 bg-deep border border-border space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-xs text-secondary">
                                    <span className="truncate">{att.name}</span>
                                    <span className="font-mono text-[11px] text-muted tabular-nums">
                                      {formatFileSize(att.size)}
                                    </span>
                                  </div>
                                  <audio controls src={att.url} className="w-full h-8" />
                                </div>
                              );
                            }
                            if (att.kind === 'video') {
                              return (
                                <div
                                  key={`${att.key}-${i}`}
                                  className="bg-deep border border-border overflow-hidden"
                                >
                                  <video
                                    controls
                                    src={att.url}
                                    className="max-h-72 w-full bg-black"
                                  />
                                </div>
                              );
                            }
                            return (
                              <a
                                key={`${att.key}-${i}`}
                                href={buildDownloadUrl(att)}
                                download={att.name}
                                className="flex items-center justify-between gap-3 p-2.5 bg-deep hover:bg-raised border border-border transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center shrink-0">
                                    {renderFileIcon(att)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-text truncate">
                                      {att.name}
                                    </div>
                                    <div className="text-[11px] font-mono text-muted tabular-nums">
                                      {formatFileSize(att.size)} · Скачать
                                    </div>
                                  </div>
                                </div>
                                <Download
                                  className="w-4 h-4 text-muted shrink-0"
                                  strokeWidth={1.5}
                                />
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* Embedded Poll Card */}
                      {msg.poll && (
                        <div className="pt-1">
                          <PollCard poll={msg.poll} />
                        </div>
                      )}

                      {/* Emoji Reactions Row */}
                      {msg.reactions.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {msg.reactions.map((r) => {
                            const reactedByMe = r.userIds.includes(user.id);
                            const namesTooltip = r.users
                              .map((u) => u.displayName)
                              .join(', ');
                            return (
                              <button
                                key={r.emoji}
                                type="button"
                                title={namesTooltip}
                                onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                className={`h-7 px-2 text-xs inline-flex items-center gap-1.5 border rounded-sm transition-colors ${
                                  reactedByMe
                                    ? 'bg-primary/15 border-primary/50 text-text'
                                    : 'bg-deep border-border text-secondary hover:text-text'
                                }`}
                              >
                                <CustomEmojiGlyph token={r.emoji} sizeClass="w-4 h-4" />
                                <span className="font-mono text-[11px] tabular-nums">
                                  {r.count}
                                </span>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() =>
                              setReactionPickerMsgId((cur) =>
                                cur === msg.id ? null : msg.id
                              )
                            }
                            className="h-6 w-6 inline-flex items-center justify-center bg-deep border border-border text-muted hover:text-text transition-colors"
                            title="Добавить реакцию"
                          >
                            <Plus className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Hover Message Action Bar */}
                    <div
                      className={`absolute right-2 -top-3 z-20 flex items-center bg-raised border border-border shadow-glass transition-opacity ${
                        reactionPickerMsgId === msg.id || fullEmojiReactionMsgId === msg.id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setReactionPickerMsgId((cur) => (cur === msg.id ? null : msg.id))
                        }
                        className="w-7 h-7 flex items-center justify-center text-secondary hover:text-text hover:bg-surface transition-colors"
                        title="Реакция эмодзи"
                      >
                        <Smile className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessage(null);
                          setReplyTo(msg);
                          textareaRef.current?.focus();
                        }}
                        className="w-7 h-7 flex items-center justify-center text-secondary hover:text-text hover:bg-surface transition-colors"
                        title="Ответить"
                      >
                        <Reply className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePin(msg)}
                        className={`w-7 h-7 flex items-center justify-center hover:bg-surface transition-colors ${
                          msg.isPinned ? 'text-primary' : 'text-secondary hover:text-text'
                        }`}
                        title={msg.isPinned ? 'Открепить' : 'Закрепить'}
                      >
                        <Pin className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      {isMine && !msg.poll && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(null);
                            setEditingMessage(msg);
                            setDraft(msg.content);
                            textareaRef.current?.focus();
                          }}
                          className="w-7 h-7 flex items-center justify-center text-secondary hover:text-text hover:bg-surface transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg)}
                          className="w-7 h-7 flex items-center justify-center text-secondary hover:text-negative hover:bg-surface transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>

                    {/* Quick Stylized Emoji Reaction Bar */}
                    {reactionPickerMsgId === msg.id && (
                      <div className="absolute right-2 top-5 z-30 p-1 bg-surface border border-border shadow-glass flex items-center gap-1">
                        {QUICK_REACTION_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, em)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-raised transition-transform hover:scale-110 rounded-sm"
                          >
                            <CustomEmojiGlyph token={em} sizeClass="w-5 h-5" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setReactionPickerMsgId(null);
                            setFullEmojiReactionMsgId(msg.id);
                          }}
                          className="w-8 h-8 flex items-center justify-center text-muted hover:text-text hover:bg-raised transition-colors"
                          title="Все 1500+ эмодзи"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}

                    {/* Full Emoji Picker for Message Reaction */}
                    {fullEmojiReactionMsgId === msg.id && (
                      <div className="absolute right-2 top-8 z-40">
                        <EmojiPickerPopover
                          compact
                          onSelect={(em) => handleToggleReaction(msg.id, em)}
                          onClose={() => setFullEmojiReactionMsgId(null)}
                        />
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* Floating Scroll-to-Bottom Button */}
          {showScrollBottomBtn && (
            <button
              type="button"
              onClick={() => {
                stickToBottomRef.current = true;
                scrollToBottom('smooth');
              }}
              className="sticky bottom-3 ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-raised border border-border shadow-glass text-xs text-text hover:border-primary/50 transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
              <span>Вниз</span>
            </button>
          )}
        </div>
      )}

      {/* Typing Indicator + Composer Area (shown on Chat & Pinned views) */}
      {(filterTab === 'all' || filterTab === 'pinned') && (
        <div className="bg-deep border-t border-border p-3 space-y-2 shrink-0">
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="text-[11px] text-muted px-1">
              {typingUsers.map((t) => t.displayName).join(', ')}{' '}
              {typingUsers.length === 1 ? 'печатает…' : 'печатают…'}
            </div>
          )}

          {/* Reply or Edit Context Banner */}
          {(replyTo || editingMessage) && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface border border-border border-l-2 border-l-primary text-xs">
              <div className="min-w-0">
                <div className="font-medium text-primary">
                  {editingMessage
                    ? 'Редактирование сообщения'
                    : `Ответ пользователю ${replyTo?.senderDisplayName}`}
                </div>
                <div className="text-muted truncate max-w-lg">
                  {(editingMessage ?? replyTo)?.content || 'Вложение / опрос'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  if (editingMessage) {
                    setEditingMessage(null);
                    setDraft('');
                  }
                }}
                className="text-muted hover:text-text p-1"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* Pending Attachments Queue */}
          {(pendingAttachments.length > 0 || uploadingCount > 0) && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {pendingAttachments.map((att, idx) => (
                <div
                  key={`${att.key}-${idx}`}
                  className="relative flex items-center gap-2 p-1.5 pr-2 bg-surface border border-border shrink-0 max-w-[220px]"
                >
                  {att.kind === 'image' ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="block w-9 h-9 object-cover rounded-sm shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-deep border border-border flex items-center justify-center shrink-0">
                      {renderFileIcon(att)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs text-text truncate">{att.name}</div>
                    <div className="text-[10px] font-mono text-muted tabular-nums">
                      {formatFileSize(att.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-muted hover:text-negative p-0.5 shrink-0"
                    title="Убрать файл"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {uploadingCount > 0 && (
                <div className="px-3 py-2 bg-surface border border-border text-xs text-muted shrink-0">
                  Загрузка файлов ({uploadingCount})…
                </div>
              )}
            </div>
          )}

          {/* Input Row */}
          <div className="relative flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  void handleUploadFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />

            {/* Attach Files & Photos */}
            {!editingMessage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 shrink-0 flex items-center justify-center bg-surface hover:bg-raised border border-border text-secondary hover:text-text transition-colors"
                title="Прикрепить фото или файл (также работает перетаскивание и Ctrl+V)"
              >
                <Paperclip className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}

            {/* Quick Date Poll Shortcut */}
            {!editingMessage && (
              <button
                type="button"
                onClick={() => setPollModalKind('date')}
                className="w-10 h-10 shrink-0 hidden sm:flex items-center justify-center bg-surface hover:bg-raised border border-border text-secondary hover:text-primary transition-colors"
                title="Создать голосование за дату игры или опрос"
              >
                <CalendarClock className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}

            {/* Message Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onPaste={handlePaste}
              onChange={(e) => {
                setDraft(e.target.value);
                notifyTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendOrSaveEdit();
                } else if (e.key === 'Escape' && (editingMessage || replyTo)) {
                  setEditingMessage(null);
                  setReplyTo(null);
                }
              }}
              placeholder="Написать сообщение… (Enter — отправить, Shift+Enter — перенос строки)"
              className="anime-input flex-1 min-h-[40px] max-h-36 py-2 px-3 text-sm resize-y"
            />

            {/* Emoji Tab / Picker Toggle */}
            <div className="relative shrink-0">
              {showEmojiPicker && (
                <EmojiPickerPopover
                  align="right"
                  onSelect={(emoji) => insertEmojiAtCursor(emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className={`w-10 h-10 flex items-center justify-center border transition-colors ${
                  showEmojiPicker
                    ? 'bg-raised border-primary text-primary'
                    : 'bg-surface hover:bg-raised border-border text-secondary hover:text-text'
                }`}
                title="Открыть вкладку эмодзи"
              >
                <Smile className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Send Button */}
            <button
              type="button"
              disabled={
                sending ||
                uploadingCount > 0 ||
                (!draft.trim() && pendingAttachments.length === 0 && !editingMessage)
              }
              onClick={() => void handleSendOrSaveEdit()}
              className="anime-btn-primary h-10 px-4 text-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              title="Отправить (Enter)"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {editingMessage ? 'Сохранить' : 'Отправить'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Poll Composer Modal */}
      {pollModalKind && (
        <PollComposerModal
          initialKind={pollModalKind}
          onClose={() => setPollModalKind(null)}
          onSubmit={handleCreatePoll}
        />
      )}

      {/* Fullscreen Image Lightbox (Exact Image Bounds — No Black Padding Frame) */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="inline-flex flex-col items-center gap-3 max-w-[94vw]"
          >
            <div className="w-full min-w-[260px] flex items-center justify-between gap-3 px-3 py-2 bg-surface border border-border rounded-sm">
              <div className="min-w-0">
                <div className="text-xs font-medium text-text truncate">
                  {lightboxImage.name}
                </div>
                <div className="text-[11px] font-mono text-muted tabular-nums">
                  {formatFileSize(lightboxImage.size)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={lightboxImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="anime-btn-secondary h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Открыть</span>
                </a>
                <a
                  href={buildDownloadUrl(lightboxImage)}
                  download={lightboxImage.name}
                  className="anime-btn-secondary h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Скачать</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="anime-btn-secondary h-8 w-8 flex items-center justify-center"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="block w-auto h-auto max-h-[80vh] max-w-[92vw] rounded-md border border-border/80 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
