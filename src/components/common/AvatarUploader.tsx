import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { deletePlayerAvatar, uploadPlayerAvatar } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { PlayerId } from '../../lib/types';
import { PlayerAvatar } from './PlayerAvatar';

interface AvatarUploaderProps {
  playerId: PlayerId;
  displayName: string;
  avatarUrl?: string | null;
  accentColor?: string;
  canEdit?: boolean;
  compact?: boolean;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  playerId,
  displayName,
  avatarUrl,
  accentColor,
  canEdit = true,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const applyPlayerAvatar = useCampaignStore((s) => s.applyPlayerAvatar);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const user = useCampaignStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadPlayerAvatar(file, playerId);
      applyPlayerAvatar(playerId, res.avatarUrl, res.userId);
      pushToast({
        title: 'Портрет обновлён',
        message: 'Новый аватар уже виден в мессенджере и в ростере отряда',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось загрузить портрет',
        message: err instanceof Error ? err.message : 'Попробуйте другое изображение',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Сбросить загруженный портрет и вернуться к иллюстрации из листа LSS?')) {
      return;
    }
    setBusy(true);
    try {
      const res = await deletePlayerAvatar(playerId);
      applyPlayerAvatar(playerId, null, res.userId);
      pushToast({
        title: 'Портрет сброшен',
        message: 'Аватаром снова станет иллюстрация из листа персонажа',
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось сбросить портрет',
        message: err instanceof Error ? err.message : 'Попробуйте позже',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const isOwnSlot = user?.role === 'dm' || user?.playerId === playerId;

  return (
    <div
      className={`flex items-center gap-3 ${
        compact ? '' : 'p-3 bg-bg border border-border hud-cut-sm'
      }`}
    >
      <PlayerAvatar
        avatarUrl={avatarUrl}
        displayName={displayName}
        role="player"
        playerId={playerId}
        size={compact ? 'sm' : 'md'}
        accentColor={accentColor}
        showRoleBadge={false}
      />

      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-text truncate">Портрет персонажа</div>
        <div className="text-[11px] text-muted leading-snug">
          {avatarUrl
            ? 'Идёт в аватар мессенджера и карточки отряда'
            : 'По умолчанию берётся из листа LSS'}
        </div>
      </div>

      {canEdit && isOwnSlot && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePick}
            disabled={busy}
            className="hud-btn-secondary h-8 px-2.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
            title="Загрузить портрет"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            ) : avatarUrl ? (
              <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            <span className="hidden sm:inline">{avatarUrl ? 'Заменить' : 'Загрузить'}</span>
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              className="h-8 w-8 inline-flex items-center justify-center text-muted hover:text-negative transition-colors disabled:opacity-60"
              title="Сбросить к портрету из листа"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={handleFile}
        className="hidden"
      />
      {!canEdit && (
        <Trash2 className="w-3.5 h-3.5 text-muted/50" strokeWidth={1.5} aria-hidden />
      )}
    </div>
  );
};
