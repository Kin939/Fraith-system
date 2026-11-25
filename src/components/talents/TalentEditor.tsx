import React, { useState } from 'react';
import { Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { apiFetch, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { useCampaignStore } from '../../lib/store';
import type { PurchasedTalent, TalentNode } from '../../lib/types';

export const TalentEditor: React.FC = () => {
  const nodes = useCampaignStore((s) => s.talentNodes);
  const inspirationPoints = useCampaignStore((s) => s.inspirationPoints);
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(2);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [parentId, setParentId] = useState<number | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customInspirationSet, setCustomInspirationSet] = useState<string>('');

  const selectNode = (n: TalentNode | null) => {
    if (!n) {
      setEditingId(null);
      setTitle('');
      setDescription('');
      setCost(2);
      setPositionX(0);
      setPositionY(0);
      setParentId(null);
      setImageKey(null);
      return;
    }
    setEditingId(n.id);
    setTitle(n.title);
    setDescription(n.description);
    setCost(n.cost);
    setPositionX(n.positionX);
    setPositionY(n.positionY);
    setParentId(n.parentId);
    setImageKey(n.imageKey);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImageAsset(file, 'talents');
      setImageKey(res.key);
      pushToast({
        title: 'Иконка таланта сохранена в R2',
        message: res.key,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка R2',
        message: err instanceof Error ? err.message : 'Не удалось загрузить файл',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        cost,
        positionX,
        positionY,
        parentId,
        imageKey,
      };
      const res = editingId
        ? await apiFetch<{
            inspirationPoints: number;
            nodes: TalentNode[];
            purchases: PurchasedTalent[];
          }>(`/api/dm/talents/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{
            inspirationPoints: number;
            nodes: TalentNode[];
            purchases: PurchasedTalent[];
          }>('/api/dm/talents', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setTalentsBundle(res);
      pushToast({
        title: editingId ? 'Узел таланта обновлён' : 'Узел таланта добавлен',
        message: 'Дерево талантов синхронизировано.',
        variant: 'success',
      });
      if (!editingId) selectNode(null);
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения узла',
        message: err instanceof Error ? err.message : 'Проверьте данные',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await apiFetch<{
      inspirationPoints: number;
      nodes: TalentNode[];
      purchases: PurchasedTalent[];
    }>(`/api/dm/talents/${id}`, {
      method: 'DELETE',
    });
    setTalentsBundle(res);
    if (editingId === id) selectNode(null);
  };

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
      title: 'Счётчик вдохновений обновлён',
      message: `Установлено значение: ${res.inspirationPoints} ✦`,
      variant: 'info',
    });
  };

  return (
    <div className="space-y-5">
      {/* Inspiration Dispenser */}
      <div className="glass-panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-accent" />
          <div>
            <div className="font-anime font-bold text-base">
              Управление общим пулом Вдохновений: <span className="text-accent">{inspirationPoints} ✦</span>
            </div>
            <div className="text-xs text-muted">
              Очки общие для всей группы и могут накапливаться без ограничений.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[1, 2, 5, 10].map((delta) => (
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
              className="px-3 py-1.5 rounded-xl bg-primary/20 text-primary border border-primary/40 text-xs font-bold hover:bg-primary/30"
            >
              +{delta} ✦
            </button>
          ))}

          <input
            type="number"
            min={0}
            value={customInspirationSet}
            onChange={(e) => setCustomInspirationSet(e.target.value)}
            placeholder="Точное число..."
            className="anime-input w-32 text-xs py-1.5"
          />
          <button
            type="button"
            onClick={handleSetInspiration}
            className="px-3 py-1.5 rounded-xl border border-border bg-surface text-xs font-semibold hover:border-accent"
          >
            Задать
          </button>
        </div>
      </div>

      {/* Talent Nodes CRUD */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 glass-panel rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-anime font-bold text-sm">Узлы дерева ({nodes.length})</h4>
            <button
              type="button"
              onClick={() => selectNode(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/20 text-primary text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Новый узел
            </button>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {nodes.map((n) => (
              <div
                key={n.id}
                onClick={() => selectNode(n)}
                className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between gap-2 ${
                  editingId === n.id
                    ? 'bg-primary/15 border-primary'
                    : 'bg-bg/50 border-border hover:border-primary/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{n.title}</div>
                  <div className="text-[11px] text-muted">
                    Стоимость: {n.cost} ✦ • Сетка ({n.positionX}, {n.positionY})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(n.id);
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 glass-panel rounded-3xl p-5 space-y-4"
        >
          <h4 className="font-anime font-bold text-base">
            {editingId ? `Редактирование узла #${editingId}` : 'Добавление плитки таланта'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Название навыка *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Астральное Пробуждение"
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Стоимость (вдохновения) *</label>
              <input
                type="number"
                min={0}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Родительский узел (связь)</label>
              <select
                value={parentId ?? ''}
                onChange={(e) =>
                  setParentId(e.target.value ? Number(e.target.value) : null)
                }
                className="anime-input w-full text-sm"
              >
                <option value="">— Нет (корневой талант) —</option>
                {nodes
                  .filter((n) => n.id !== editingId)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      #{n.id} — {n.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Координата сетки X (столбец 0..6)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={positionX}
                onChange={(e) => setPositionX(Number(e.target.value))}
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Координата сетки Y (ряд 0..8)</label>
              <input
                type="number"
                min={0}
                max={12}
                value={positionY}
                onChange={(e) => setPositionY(Number(e.target.value))}
                className="anime-input w-full text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Описание эффекта *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="anime-input w-full text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-bg/60 border border-border">
            <img
              src={resolveImageUrl(imageKey, '✦')}
              alt="Иконка"
              className="w-14 h-14 rounded-2xl object-cover border border-primary"
            />
            <div className="space-y-1">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary text-xs font-medium cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-primary" />
                <span>{uploading ? 'Загрузка...' : 'Загрузить иконку в R2'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
              <div className="text-[11px] text-muted">
                image_key: <code>{imageKey || 'preset'}</code>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="anime-btn-primary px-5 py-2.5 text-xs inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Сохранение...' : editingId ? 'Обновить узел' : 'Создать узел'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
