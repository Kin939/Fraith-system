import React, { useState } from 'react';
import { Check, Eye, LayoutDashboard, Lock, Pencil, Plus, Settings2, Trash2, Type, X } from 'lucide-react';
import type {
  BoardBackground,
  BoardFontPreset,
  BoardMember,
  BoardPermission,
  BoardSummary,
} from '../../lib/boards';
import { BOARD_FONT_PRESETS } from '../../lib/boardFonts';
import { PeerAvatar } from './BoardPresence';

const BG_COLORS: Array<{ value: string; label: string }> = [
  { value: '', label: 'тема' },
  { value: '#0b0d13', label: 'графит' },
  { value: '#0d1b2a', label: 'ночь' },
  { value: '#101a14', label: 'мох' },
  { value: '#1a1020', label: 'аметист' },
  { value: '#231413', label: 'сепия' },
];

interface BoardListProps {
  boards: BoardSummary[];
  members: BoardMember[];
  activeId: string | null;
  isDm: boolean;
  onSelect: (boardId: string) => void;
  onCreate: (name: string) => void;
  onRename: (boardId: string, name: string) => void;
  onDelete: (boardId: string) => void;
  onBackground: (boardId: string, background: BoardBackground) => void;
  onFontPreset: (boardId: string, preset: BoardFontPreset) => void;
  onBgColor: (boardId: string, color: string) => void;
  onAccess: (boardId: string, userId: number, permission: BoardPermission | null) => void;
}

const BACKGROUNDS: Array<{ id: BoardBackground; label: string }> = [
  { id: 'dots', label: 'точки' },
  { id: 'lines', label: 'линии' },
  { id: 'squares', label: 'клетки' },
  { id: 'plain', label: 'чистый' },
];

/**
 * Список досок кампании.
 * Любой участник может создать доску; переименование/удаление/настройки —
 * у автора доски и у Мастера.
 */
export const BoardList: React.FC<BoardListProps> = ({
  boards,
  members,
  activeId,
  isDm,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onBackground,
  onFontPreset,
  onBgColor,
  onAccess,
}) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const players = members.filter((member) => member.role === 'player');
  const memberById = new Map(members.map((member) => [member.id, member]));

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="w-64 h-full border-r border-border bg-deep/97 backdrop-blur-sm flex flex-col min-h-0 shadow-glass">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-wide text-secondary">
          Доски · {boards.length}
        </span>
        <button
          type="button"
          onClick={() => setCreating((prev) => !prev)}
          className="w-6 h-6 flex items-center justify-center border border-border text-muted hover:text-primary transition-colors"
          title="Новая доска"
        >
          <Plus className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>

      {creating && (
        <div className="p-2 border-b border-border space-y-1.5 shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitCreate();
              if (event.key === 'Escape') setCreating(false);
            }}
            placeholder="Название доски"
            className="w-full h-7 bg-surface border border-border px-2 text-[11px] text-text outline-none focus:border-primary/60"
          />
          <div className="flex items-center gap-1">
            <button type="button" onClick={submitCreate} className="anime-btn-primary px-2 py-1 text-[10px]">
              Создать
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-2 py-1 text-[10px] border border-border text-muted hover:text-text"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
        {boards.map((board) => {
          const isActive = board.id === activeId;
          const canEdit = isDm || board.canEdit;
          return (
            <div key={board.id} className={`${isActive ? 'bg-raised/60' : 'hover:bg-raised/30'} transition-colors`}>
              <div className="flex items-center gap-1 px-2 py-2">
                {renamingId === board.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => setRenamingId(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onRename(board.id, renameValue.trim() || board.name);
                        setRenamingId(null);
                      }
                      if (event.key === 'Escape') setRenamingId(null);
                    }}
                    className="flex-1 h-7 bg-surface border border-border px-2 text-[11px] text-text outline-none focus:border-primary/60"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(board.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-1.5"
                  >
                    <LayoutDashboard
                      className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`}
                      strokeWidth={1.5}
                    />
                    <span className={`text-[11px] truncate ${isActive ? 'text-text' : 'text-secondary'}`}>
                      {board.name}
                    </span>
                    {board.permission === 'read' && (
                      <Lock className="w-3 h-3 text-warning shrink-0" strokeWidth={1.5} />
                    )}
                  </button>
                )}

                {canEdit && (
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(board.id);
                        setRenameValue(board.name);
                      }}
                      className="w-5 h-5 flex items-center justify-center text-muted hover:text-text"
                      title="Переименовать"
                    >
                      <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsId(settingsId === board.id ? null : board.id)}
                      className={`w-5 h-5 flex items-center justify-center ${
                        settingsId === board.id ? 'text-primary' : 'text-muted hover:text-primary'
                      }`}
                      title="Доступ, фон и шрифты"
                    >
                      <Settings2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Удалить доску «${board.name}»? Содержимое холста будет стёрто.`)) {
                          onDelete(board.id);
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center text-muted hover:text-negative"
                      title="Удалить доску"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>

              {canEdit && settingsId === board.id && (
                <div className="px-2 pb-2 space-y-2">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wide text-muted mb-1">Фон</div>
                    <div className="grid grid-cols-4 gap-1">
                      {BACKGROUNDS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onBackground(board.id, option.id)}
                          className={`h-6 text-[9px] border transition-colors ${
                            board.background === option.id
                              ? 'border-primary/70 text-primary bg-primary/10'
                              : 'border-border text-muted hover:text-text'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wide text-muted mb-1">Цвет холста</div>
                    <div className="flex items-center gap-1">
                      {BG_COLORS.map((swatch) => {
                        const active = (board.bgColor ?? '') === swatch.value;
                        return (
                          <button
                            key={swatch.label}
                            type="button"
                            onClick={() => onBgColor(board.id, swatch.value)}
                            className={`w-6 h-6 border transition-transform hover:scale-110 ${
                              active ? 'border-primary ring-1 ring-primary/50' : 'border-border'
                            }`}
                            style={{
                              background: swatch.value || 'linear-gradient(135deg,#0b0d13,#1a1020)',
                            }}
                            title={swatch.label}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wide text-muted mb-1 flex items-center gap-1">
                      <Type className="w-2.5 h-2.5" strokeWidth={2} /> Шрифты (RU + EN)
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {BOARD_FONT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onFontPreset(board.id, preset.id)}
                          className={`px-1 py-1 text-[9px] border text-left transition-colors ${
                            (board.fontPreset ?? 'classic') === preset.id
                              ? 'border-primary/70 text-primary bg-primary/10'
                              : 'border-border text-muted hover:text-text'
                          }`}
                          title={preset.hint}
                        >
                          <div className="truncate">{preset.label}</div>
                          <div className="truncate opacity-70">{preset.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-wide text-muted mb-1">
                      Доступ игроков
                    </div>
                    <div className="space-y-1">
                      {players.map((player) => {
                        const current: BoardPermission | null =
                          board.access?.find((entry) => entry.userId === player.id)?.permission ?? null;
                        return (
                          <div key={player.id} className="flex items-center gap-1">
                            <PeerAvatar
                              name={player.displayName}
                              color={current === 'write' ? '#4cc38a' : current === 'read' ? '#e5a93b' : '#64748b'}
                              avatarUrl={player.avatarUrl}
                              size={16}
                            />
                            <span className="flex-1 text-[10px] text-secondary truncate">
                              {player.displayName}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAccess(board.id, player.id, null)}
                              className={`w-5 h-5 flex items-center justify-center border ${
                                current === null ? 'border-negative/60 text-negative' : 'border-border text-muted'
                              }`}
                              title="Нет доступа"
                            >
                              <X className="w-2.5 h-2.5" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onAccess(board.id, player.id, 'read')}
                              className={`w-5 h-5 flex items-center justify-center border ${
                                current === 'read' ? 'border-warning/70 text-warning' : 'border-border text-muted'
                              }`}
                              title="Чтение"
                            >
                              <Eye className="w-2.5 h-2.5" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onAccess(board.id, player.id, 'write')}
                              className={`w-5 h-5 flex items-center justify-center border ${
                                current === 'write' ? 'border-positive/70 text-positive' : 'border-border text-muted'
                              }`}
                              title="Запись"
                            >
                              <Check className="w-2.5 h-2.5" strokeWidth={2} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {boards.length === 0 && (
          <div className="p-3 text-[11px] text-muted leading-relaxed">
            Доступных досок нет. Создайте первую кнопкой «+».
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border shrink-0 space-y-1">
        <div className="text-[10px] text-muted font-mono uppercase tracking-wide">
          {members.length} участника · {memberById.size} в кампании
        </div>
      </div>
    </div>
  );
};
