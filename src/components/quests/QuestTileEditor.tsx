import React from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { TileStyleControls } from '../common/TileStyleControls';
import { questTileCssVars } from '../../lib/questStyle';
import type { Quest, QuestTileStyle } from '../../lib/types';
import { QuestTile } from './QuestTile';

export interface QuestTileDraft extends QuestTileStyle {
  imageKey: string | null;
}

interface QuestTileEditorProps {
  /** Preview model built from the current form state */
  previewQuest: Quest;
  draft: QuestTileDraft;
  onChange: (patch: Partial<QuestTileDraft>) => void;
  onUploadCover: (file: File) => void;
  onRemoveCover: () => void;
  uploadingCover?: boolean;
}

export const QuestTileEditor: React.FC<QuestTileEditorProps> = ({
  previewQuest,
  draft,
  onChange,
  onUploadCover,
  onRemoveCover,
  uploadingCover = false,
}) => {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const accent = draft.accent || '#00e5ff';
  const previewWithDraft: Quest = {
    ...previewQuest,
    tileStyle: {
      accent: draft.accent,
      emblem: draft.emblem,
      pattern: draft.pattern,
      isImportant: draft.isImportant,
    },
    imageKey: draft.imageKey,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-medium text-text">Редактор плитки</h5>
          <p className="text-[11px] text-muted">
            Цвет, эмблема, узор и метка «важно» — игроки увидят плитку такой же
          </p>
        </div>
        <span
          className="h-7 px-2 text-[11px] inline-flex items-center gap-1.5 border"
          style={{
            borderColor: draft.isImportant ? `${accent}aa` : undefined,
            color: draft.isImportant ? accent : undefined,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span className="font-mono">{accent}</span>
        </span>
      </div>

      {/* Live preview */}
      <div
        className="p-3 bg-bg border border-border space-y-2"
        style={questTileCssVars(previewWithDraft)}
      >
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
          Предпросмотр
        </div>
        <QuestTile quest={previewWithDraft} selected={false} onSelect={() => {}} compact />
      </div>

      <TileStyleControls
        value={{
          accent: draft.accent,
          emblem: draft.emblem,
          pattern: draft.pattern,
          isImportant: draft.isImportant,
        }}
        onChange={(patch) => onChange(patch as Partial<QuestTileDraft>)}
        importantLabel="Важный"
        importantInactiveLabel="Обычный"
      />

      {/* Cover */}
      <div className="flex items-center gap-2 p-2 bg-bg border border-border">
        <div className="w-14 h-10 bg-deep border border-border overflow-hidden shrink-0">
          {draft.imageKey ? (
            <img
              src={`/api/r2/${encodeURIComponent(draft.imageKey)}`}
              alt="Обложка"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <ImagePlus className="w-4 h-4" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-text">Иллюстрация плитки</div>
          <div className="text-[10px] text-muted truncate">
            {draft.imageKey ? draft.imageKey : 'Показывается эмблема или статус'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingCover}
            className="h-7 px-2 text-[11px] border border-border text-secondary hover:text-text inline-flex items-center gap-1 disabled:opacity-60"
          >
            {uploadingCover ? (
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.6} />
            ) : (
              <ImagePlus className="w-3 h-3" strokeWidth={1.6} />
            )}
            <span>Загрузить</span>
          </button>
          {draft.imageKey && (
            <button
              type="button"
              onClick={onRemoveCover}
              className="h-7 w-7 flex items-center justify-center text-muted hover:text-negative"
              title="Убрать иллюстрацию"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.6} />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onUploadCover(file);
          }}
        />
      </div>
    </div>
  );
};
