import React from 'react';
import { ImagePlus, Loader2, Star, Trash2, Wand2 } from 'lucide-react';
import {
  QUEST_ACCENT_PRESETS,
  QUEST_EMBLEM_OPTIONS,
  QUEST_PATTERN_OPTIONS,
  questEmblemUrl,
  questTileCssVars,
} from '../../lib/questStyle';
import type { Quest, QuestTilePattern, QuestTileStyle } from '../../lib/types';
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

interface StylePreset {
  id: string;
  label: string;
  hint: string;
  patch: Partial<QuestTileDraft>;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'urgent',
    label: 'Срочно',
    hint: 'Багровый · опасность · череп',
    patch: { accent: '#f43f5e', pattern: 'hazard', emblem: 'skull', isImportant: true },
  },
  {
    id: 'epic',
    label: 'Эпик',
    hint: 'Золото · звёзды · корона',
    patch: { accent: '#f59e0b', pattern: 'stars', emblem: 'crown', isImportant: true },
  },
  {
    id: 'arcane',
    label: 'Тайна',
    hint: 'Аметист · руны · сфера',
    patch: { accent: '#7c4dff', pattern: 'runes', emblem: 'orb', isImportant: false },
  },
  {
    id: 'hunt',
    label: 'Охота',
    hint: 'Циан · сетка · дракон',
    patch: { accent: '#00e5ff', pattern: 'grid', emblem: 'dragon', isImportant: false },
  },
  {
    id: 'stealth',
    label: 'Тихо',
    hint: 'Сталь · без узора · щит',
    patch: { accent: '#94a3b8', pattern: 'none', emblem: 'shield', isImportant: false },
  },
];

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
        <button
          type="button"
          onClick={() => onChange({ isImportant: !draft.isImportant })}
          className={`h-8 px-2.5 text-[11px] inline-flex items-center gap-1.5 border transition-colors ${
            draft.isImportant
              ? 'border-[color:var(--q-accent-strong)] text-text'
              : 'border-border text-secondary hover:text-text'
          }`}
          style={{ ['--q-accent-strong' as string]: `${accent}80` }}
        >
          <Star
            className="w-3.5 h-3.5"
            strokeWidth={1.6}
            fill={draft.isImportant ? 'currentColor' : 'none'}
            style={{ color: draft.isImportant ? accent : undefined }}
          />
          <span>{draft.isImportant ? 'Важный' : 'Обычный'}</span>
        </button>
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

      {/* Presets */}
      <div className="space-y-1.5">
        <div className="text-xs text-secondary inline-flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
          <span>Готовые стили</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.patch)}
              title={preset.hint}
              className="h-7 px-2 text-[11px] bg-deep border border-border text-secondary hover:text-text hover:border-border/80 transition-colors inline-flex items-center gap-1.5"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: preset.patch.accent || '#00e5ff' }}
              />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent */}
      <div className="space-y-1.5">
        <div className="text-xs text-secondary">Акцентный цвет</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUEST_ACCENT_PRESETS.map((preset) => {
            const active = (draft.accent || '').toLowerCase() === preset.hex;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ accent: preset.hex })}
                title={preset.label}
                className={`w-7 h-7 border transition-transform hover:scale-105 ${
                  active ? 'border-text' : 'border-border'
                }`}
                style={{
                  backgroundColor: preset.hex,
                  boxShadow: active ? `0 0 10px -1px ${preset.hex}` : undefined,
                }}
              />
            );
          })}
          <label
            className="h-7 px-2 text-[11px] bg-deep border border-border text-secondary hover:text-text inline-flex items-center gap-1.5 cursor-pointer"
            title="Свой цвет"
          >
            <input
              type="color"
              value={accent}
              onChange={(e) => onChange({ accent: e.target.value })}
              className="w-4 h-4 bg-transparent border-0 p-0 cursor-pointer"
            />
            <span>Свой</span>
          </label>
          {draft.accent && (
            <button
              type="button"
              onClick={() => onChange({ accent: null })}
              className="h-7 px-2 text-[11px] border border-border text-muted hover:text-text"
              title="Вернуть цвет статуса"
            >
              Авто
            </button>
          )}
        </div>
      </div>

      {/* Emblem */}
      <div className="space-y-1.5">
        <div className="text-xs text-secondary">Эмблема</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ emblem: null })}
            className={`h-9 px-2 text-[11px] border transition-colors ${
              draft.emblem ? 'border-border text-muted hover:text-text' : 'border-text text-text'
            }`}
          >
            Без
          </button>
          {QUEST_EMBLEM_OPTIONS.map((emblem) => {
            const active = draft.emblem === emblem.id;
            return (
              <button
                key={emblem.id}
                type="button"
                onClick={() => onChange({ emblem: emblem.id })}
                title={emblem.label}
                className={`w-9 h-9 flex items-center justify-center border transition-colors ${
                  active
                    ? 'border-text bg-raised'
                    : 'border-border bg-deep hover:bg-raised/70'
                }`}
              >
                <img
                  src={questEmblemUrl(emblem.id) ?? ''}
                  alt={emblem.label}
                  draggable={false}
                  className="w-5 h-5 object-contain"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Pattern */}
      <div className="space-y-1.5">
        <div className="text-xs text-secondary">Узор фона</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {QUEST_PATTERN_OPTIONS.map((pattern) => {
            const active = draft.pattern === pattern.id;
            return (
              <button
                key={pattern.id}
                type="button"
                onClick={() => onChange({ pattern: pattern.id as QuestTilePattern })}
                title={pattern.description}
                className={`relative h-11 border text-left px-2 overflow-hidden transition-colors ${
                  active ? 'border-text text-text' : 'border-border text-secondary hover:text-text'
                }`}
                style={{ ['--q-accent' as string]: accent, ['--q-accent-soft' as string]: `${accent}44` }}
              >
                {pattern.id !== 'none' && (
                  <span
                    aria-hidden
                    className={`quest-tile__pattern quest-pattern--${pattern.id}`}
                  />
                )}
                <span className="relative z-10 text-[11px]">{pattern.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
