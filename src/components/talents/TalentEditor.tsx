import React, { useEffect, useState } from 'react';
import { Plus, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { useCampaignStore } from '../../lib/store';
import type { PurchasedTalent, TalentNode } from '../../lib/types';
import { TalentTree } from './TalentTree';

export interface TalentNodeModalProps {
  open: boolean;
  editingNode: TalentNode | null;
  initialPos: { x: number; y: number };
  allNodes: TalentNode[];
  onClose: () => void;
}

export const TalentNodeModal: React.FC<TalentNodeModalProps> = ({
  open,
  editingNode,
  initialPos,
  allNodes,
  onClose,
}) => {
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(2);
  const [parentId, setParentId] = useState<number | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingNode) {
      setTitle(editingNode.title);
      setDescription(editingNode.description);
      setCost(editingNode.cost);
      setParentId(editingNode.parentId);
      setImageKey(editingNode.imageKey);
    } else {
      setTitle('');
      setDescription('');
      setCost(2);
      setParentId(null);
      setImageKey(null);
    }
  }, [open, editingNode]);

  if (!open) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImageAsset(file, 'talents');
      setImageKey(res.key);
      pushToast({
        title: 'Иконка таланта загружена',
        message: res.key,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки иконки',
        message: err instanceof Error ? err.message : 'Не удалось загрузить файл',
        variant: 'error',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = editingNode
        ? await apiFetch<{
            inspirationPoints: number;
            nodes: TalentNode[];
            purchases: PurchasedTalent[];
          }>(`/api/dm/talents/${editingNode.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              cost,
              parentId,
              imageKey,
            }),
          })
        : await apiFetch<{
            inspirationPoints: number;
            nodes: TalentNode[];
            purchases: PurchasedTalent[];
          }>('/api/dm/talents', {
            method: 'POST',
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              cost,
              positionX: initialPos.x,
              positionY: initialPos.y,
              parentId,
              imageKey,
            }),
          });
      setTalentsBundle(res);
      pushToast({
        title: editingNode ? 'Талант обновлён' : 'Талант добавлен',
        message: editingNode
          ? 'Данные таланта сохранены'
          : 'Перетащите плитку мышью в нужное место дерева',
        variant: 'success',
      });
      onClose();
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения таланта',
        message: err instanceof Error ? err.message : 'Проверьте данные',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingNode) return;
    if (!window.confirm(`Удалить узел таланта «${editingNode.title}»?`)) return;
    const res = await apiFetch<{
      inspirationPoints: number;
      nodes: TalentNode[];
      purchases: PurchasedTalent[];
    }>(`/api/dm/talents/${editingNode.id}`, {
      method: 'DELETE',
    });
    setTalentsBundle(res);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-panel hud-cut max-w-lg w-full p-6 space-y-4 shadow-glass"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h3 className="font-medium text-base text-text">
            {editingNode ? 'Редактирование таланта' : 'Новый узел дерева талантов'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5">Название таланта</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Благословение единства"
            className="anime-input w-full h-9 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-secondary mb-1.5">Стоимость (очки вдохновения)</label>
            <input
              type="number"
              min={0}
              value={cost}
              onChange={(e) => setCost(Math.max(0, Number(e.target.value)))}
              className="anime-input w-full h-9 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Родительский узел</label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
              className="anime-input w-full h-9 text-sm"
            >
              <option value="">Корневой узел (без родителя)</option>
              {allNodes
                .filter((n) => n.id !== editingNode?.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5">Описание эффекта</label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Бонус или способность, которую получает отряд"
            className="anime-input w-full text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <img
            src={resolveImageUrl(imageKey, 'spark')}
            alt="Иконка"
            className="w-12 h-12 object-cover border border-border bg-deep"
          />
          <label className="hud-btn-secondary h-8 px-3 text-xs cursor-pointer inline-flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
            <span>{uploading ? 'Загрузка…' : 'Загрузить иконку'}</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          {editingNode ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="h-9 px-3 border border-border text-xs text-muted hover:text-negative hover:border-negative/30 inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Удалить</span>
            </button>
          ) : (
            <span className="text-xs text-muted">
              После создания двигайте плитку по холсту
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-border text-xs text-secondary hover:text-text transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5"
            >
              {editingNode ? (
                <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              <span>{saving ? 'Сохранение…' : editingNode ? 'Сохранить' : 'Создать'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export const TalentEditor: React.FC = () => {
  const nodes = useCampaignStore((s) => s.talentNodes);
  const inspirationPoints = useCampaignStore((s) => s.inspirationPoints);
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [customInspirationSet, setCustomInspirationSet] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TalentNode | null>(null);
  const [spawnPos, setSpawnPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });

  const handleSetInspiration = async () => {
    const val = Number.parseInt(customInspirationSet, 10);
    if (Number.isNaN(val) || val < 0) return;
    const res = await apiFetch<{
      inspirationPoints: number;
      nodes: TalentNode[];
      purchases: PurchasedTalent[];
    }>('/api/dm/inspiration', {
      method: 'POST',
      body: JSON.stringify({ setPoints: val }),
    });
    setTalentsBundle(res);
    setCustomInspirationSet('');
    pushToast({
      title: 'Счётчик вдохновения обновлён',
      message: `Установлено значение: ${res.inspirationPoints}`,
      variant: 'info',
    });
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel hud-cut p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-muted mt-1 shrink-0" strokeWidth={1.5} />
          <div>
            <div className="font-medium text-base text-text flex items-center gap-2">
              <span>Общий пул вдохновения:</span>
              <span className="font-mono text-primary tabular-nums">{inspirationPoints}</span>
            </div>
            <div className="text-xs text-secondary mt-0.5">
              Очки общие для всей группы — любой открытый талант действует на весь отряд
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[-1, 1, 2, 5, 10].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={async () => {
                const res = await apiFetch<{
                  inspirationPoints: number;
                  nodes: TalentNode[];
                  purchases: PurchasedTalent[];
                }>('/api/dm/inspiration', {
                  method: 'POST',
                  body: JSON.stringify({ delta }),
                });
                setTalentsBundle(res);
              }}
              className="h-9 px-3 border border-border bg-bg hover:bg-raised font-mono text-xs text-secondary hover:text-text tabular-nums transition-colors"
            >
              {delta > 0 ? `+${delta}` : `${delta}`}
            </button>
          ))}

          <input
            type="number"
            min={0}
            value={customInspirationSet}
            onChange={(e) => setCustomInspirationSet(e.target.value)}
            placeholder="Точное число"
            className="anime-input w-28 h-9 text-xs py-1 font-mono"
          />
          <button
            type="button"
            onClick={() => void handleSetInspiration()}
            className="anime-btn-primary h-9 px-4 text-xs"
          >
            Задать
          </button>
        </div>
      </div>

      <TalentTree
        nodes={nodes}
        inspirationPoints={inspirationPoints}
        selectedEditorId={editingNode?.id ?? null}
        onRequestCreateAt={(x, y) => {
          setEditingNode(null);
          setSpawnPos({ x, y });
          setModalOpen(true);
        }}
        onRequestEditNode={(node) => {
          setEditingNode(node);
          setModalOpen(true);
        }}
      />

      <TalentNodeModal
        open={modalOpen}
        editingNode={editingNode}
        initialPos={spawnPos}
        allNodes={nodes}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};
