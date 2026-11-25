import React, { useState } from 'react';
import { Eye, EyeOff, Plus, Save, Trash2, Upload } from 'lucide-react';
import { apiFetch, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { useCampaignStore } from '../../lib/store';
import type { BestiaryCreature } from '../../lib/types';

export const BestiaryEditor: React.FC = () => {
  const creatures = useCampaignStore((s) => s.bestiary);
  const setBestiary = useCampaignStore((s) => s.setBestiary);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [cr, setCr] = useState('1');
  const [creatureType, setCreatureType] = useState('Чудовище');
  const [ac, setAc] = useState(14);
  const [hp, setHp] = useState('45 (6d10 + 12)');
  const [description, setDescription] = useState('');
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectCreature = (c: BestiaryCreature | null) => {
    if (!c) {
      setEditingId(null);
      setName('');
      setCr('1');
      setCreatureType('Чудовище');
      setAc(14);
      setHp('45 (6d10 + 12)');
      setDescription('');
      setImageKey(null);
      setIsRevealed(false);
      setSortOrder(0);
      return;
    }
    setEditingId(c.id);
    setName(c.name);
    setCr(c.cr);
    setCreatureType(c.creatureType);
    setAc(c.ac);
    setHp(c.hp);
    setDescription(c.description);
    setImageKey(c.imageKey);
    setIsRevealed(c.isRevealed);
    setSortOrder(c.sortOrder);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImageAsset(file, 'bestiary');
      setImageKey(res.key);
      pushToast({
        title: 'Портрет существа загружен в R2',
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
        name,
        cr,
        creatureType,
        ac,
        hp,
        description,
        imageKey,
        isRevealed,
        sortOrder,
      };
      const res = editingId
        ? await apiFetch<{ creatures: BestiaryCreature[] }>(`/api/dm/bestiary/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ creatures: BestiaryCreature[] }>('/api/dm/bestiary', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setBestiary(res.creatures);
      pushToast({
        title: editingId ? 'Запись бестиария обновлена' : 'Существо добавлено',
        message: 'Сортировка по CR пересчитана и отправлена игрокам.',
        variant: 'success',
      });
      if (!editingId) selectCreature(null);
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения',
        message: err instanceof Error ? err.message : 'Проверьте введённые данные',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const quickToggleReveal = async (c: BestiaryCreature) => {
    const res = await apiFetch<{ creatures: BestiaryCreature[] }>(`/api/dm/bestiary/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...c,
        isRevealed: !c.isRevealed,
      }),
    });
    setBestiary(res.creatures);
    if (editingId === c.id) setIsRevealed(!c.isRevealed);
  };

  const handleDelete = async (id: number) => {
    const res = await apiFetch<{ creatures: BestiaryCreature[] }>(`/api/dm/bestiary/${id}`, {
      method: 'DELETE',
    });
    setBestiary(res.creatures);
    if (editingId === id) selectCreature(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      <div className="xl:col-span-5 glass-panel rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-anime font-bold text-sm">Существа по CR ({creatures.length})</h4>
          <button
            type="button"
            onClick={() => selectCreature(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/20 text-primary text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {creatures.map((c) => (
            <div
              key={c.id}
              onClick={() => selectCreature(c)}
              className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between gap-2 ${
                editingId === c.id
                  ? 'bg-primary/15 border-primary'
                  : 'bg-bg/50 border-border hover:border-primary/40'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    CR {c.cr}
                  </span>
                  <span className="text-sm font-semibold truncate">{c.name}</span>
                </div>
                <div className="text-[11px] text-muted mt-0.5">{c.creatureType}</div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void quickToggleReveal(c);
                  }}
                  title={c.isRevealed ? 'Скрыть (заглушка ???)' : 'Открыть игрокам'}
                  className={`p-1.5 rounded-lg ${
                    c.isRevealed ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {c.isRevealed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(c.id);
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="xl:col-span-7 glass-panel rounded-3xl p-5 space-y-4"
      >
        <h4 className="font-anime font-bold text-base">
          {editingId ? `Редактирование существа #${editingId}` : 'Новое существо бестиария'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Имя существа *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Древний Теневой Дракон"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Уровень опасности (CR) *</label>
            <input
              required
              value={cr}
              onChange={(e) => setCr(e.target.value)}
              placeholder="1/4, 1/2, 2, 13..."
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Тип существа</label>
            <input
              value={creatureType}
              onChange={(e) => setCreatureType(e.target.value)}
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Класс Доспеха (AC)</label>
            <input
              type="number"
              value={ac}
              onChange={(e) => setAc(Number(e.target.value))}
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Хиты (HP)</label>
            <input
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="anime-input w-full text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-bg/60 border border-border cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={isRevealed}
            onChange={(e) => setIsRevealed(e.target.checked)}
            className="w-4 h-4 accent-purple-500"
          />
          <span>
            Открыто в бестиарии (<code>is_revealed = 1</code>). Если выключено — игроки видят только
            круглый портрет с <strong>?</strong> и <strong>???</strong>.
          </span>
        </label>

        <div>
          <label className="block text-xs text-muted mb-1">Описание, повадки и способности</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="anime-input w-full text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-bg/60 border border-border">
          <img
            src={resolveImageUrl(imageKey, '🐉')}
            alt="Портрет"
            className="w-16 h-16 rounded-full object-cover border border-primary"
          />
          <div className="space-y-1">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary text-xs font-medium cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>{uploading ? 'Загрузка...' : 'Загрузить портрет в R2'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
            <div className="text-[11px] text-muted">
              Ключ R2: <code>{imageKey || 'preset'}</code>
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
            <span>{saving ? 'Сохранение...' : editingId ? 'Обновить существо' : 'Создать существо'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
