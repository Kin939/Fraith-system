import React, { useState } from 'react';
import { LayoutTemplate, Plus, Save, Trash2 } from 'lucide-react';
import type { BoardTemplateRecord } from '../../lib/boards';
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from './boardTemplates';

interface TemplatePanelProps {
  templates: BoardTemplateRecord[];
  canManage: boolean;
  canWrite: boolean;
  hasSelection: boolean;
  onApplyBuiltin: (template: BuiltinTemplate) => void;
  onApplyCustom: (template: BoardTemplateRecord) => void;
  onSaveSelection: (name: string, scope: 'board' | 'global') => Promise<void> | void;
  onDelete: (templateId: string) => void;
}

const CATEGORY_LABEL: Record<BuiltinTemplate['category'], string> = {
  thinking: 'Мышление и воркшопы',
  planning: 'Планирование',
  dnd: 'D&D',
  layout: 'Структура и документы',
};

const CATEGORY_ORDER: BuiltinTemplate['category'][] = ['thinking', 'planning', 'dnd', 'layout'];

export const TemplatePanel: React.FC<TemplatePanelProps> = ({
  templates,
  canManage,
  canWrite,
  hasSelection,
  onApplyBuiltin,
  onApplyCustom,
  onSaveSelection,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'board' | 'global'>('board');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || !hasSelection) return;
    setSaving(true);
    try {
      await onSaveSelection(trimmed, scope);
      setName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-3 h-9 border-b border-border shrink-0">
        <LayoutTemplate className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
        <span className="text-[11px] font-mono uppercase tracking-wide text-secondary">Библиотека шаблонов</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {CATEGORY_ORDER.map((category) => {
          const items = BUILTIN_TEMPLATES.filter((template) => template.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="p-3 space-y-1.5 border-b border-border/60">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted">
                {CATEGORY_LABEL[category]}
              </div>
              {items.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => onApplyBuiltin(template)}
                  className="w-full text-left px-2 py-1.5 border border-border/70 hover:border-primary/60 hover:bg-raised/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="text-[11px] text-text">{template.name}</div>
                  <div className="text-[10px] text-muted">{template.hint}</div>
                </button>
              ))}
            </div>
          );
        })}

        <div className="p-3 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wide text-muted">Шаблоны Мастера</div>
          {templates.length === 0 && (
            <div className="text-[10px] text-muted leading-relaxed">
              Сохранённых шаблонов нет. Выделите объекты на холсте и сохраните их как шаблон.
            </div>
          )}
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-1 border border-border/70 px-2 py-1.5 hover:border-primary/60 transition-colors"
            >
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => onApplyCustom(template)}
                className="flex-1 text-left disabled:opacity-40"
              >
                <div className="text-[11px] text-text truncate">{template.name}</div>
                <div className="text-[10px] text-muted">
                  {template.boardId ? 'доска' : 'общий'} · {template.createdByName}
                </div>
              </button>
              {template.canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(template.id)}
                  className="w-6 h-6 flex items-center justify-center text-muted hover:text-negative"
                  title="Удалить шаблон"
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {canManage && (
        <div className="p-3 border-t border-border space-y-2 shrink-0">
          <div className="text-[10px] font-mono uppercase tracking-wide text-muted flex items-center gap-1">
            <Plus className="w-3 h-3" strokeWidth={1.5} /> Сохранить выделение
          </div>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Название шаблона"
            className="w-full h-7 bg-deep border border-border px-2 text-[11px] text-text outline-none focus:border-primary/60"
          />
          <div className="flex items-center gap-1">
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as 'board' | 'global')}
              className="h-7 bg-deep border border-border text-[10px] text-muted px-1 outline-none"
            >
              <option value="board">для этой доски</option>
              <option value="global">для всех досок</option>
            </select>
            <button
              type="button"
              disabled={!hasSelection || !name.trim() || saving}
              onClick={save}
              className="ml-auto anime-btn-primary px-2 py-1 text-[10px] flex items-center gap-1 disabled:opacity-40"
            >
              <Save className="w-3 h-3" strokeWidth={1.5} /> Сохранить
            </button>
          </div>
          {!hasSelection && (
            <div className="text-[10px] text-muted">Сначала выделите объекты на холсте.</div>
          )}
        </div>
      )}
    </div>
  );
};
