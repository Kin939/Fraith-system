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
        title: 'Портрет существа загружен',
        message: res.key,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки',
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
        message: 'Бестиарий синхронизирован у всех участников',
        variant: 'success',
      });
      if (!editingId) selectCreature(null);
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения',
        message: err instanceof Error ? err.message : 'Проверьте данные',
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-5 glass-panel hud-cut p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-text">Существа по опасности ({creatures.length})</h4>
          <button
            type="button"
            onClick={() => selectCreature(null)}
            className="hud-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Добавить</span>
          </button>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {creatures.map((c) => (
            <div
              key={c.id}
              onClick={() => selectCreature(c)}
              className={`p-3 border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                editingId === c.id
                  ? 'bg-raised border-primary/60'
                  : 'bg-bg border-border hover:bg-raised/60'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="hud-keycap">
                    {c.cr}
                  </span>
                  <span className="text-sm font-medium text-text truncate">{c.name}</span>
                </div>
                <div className="text-xs text-muted mt-1">{c.creatureType}</div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void quickToggleReveal(c);
                  }}
                  title={c.isRevealed ? 'Скрыть от игроков' : 'Открыть игрокам'}
                  className={`p-1.5 transition-colors ${
                    c.isRevealed ? 'text-positive' : 'text-muted hover:text-text'
                  }`}
                >
                  {c.isRevealed ? (
                    <Eye className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(c.id);
                  }}
                  className="p-1.5 text-muted hover:text-negative transition-colors"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="xl:col-span-7 glass-panel hud-cut p-6 space-y-4"
      >
        <h4 className="font-medium text-base text-text">
          {editingId ? `Редактирование существа #${editingId}` : 'Новое существо бестиария'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-secondary mb-1.5">Имя существа</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Древний теневой дракон"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Уровень опасности (CR)</label>
            <input
              required
              value={cr}
              onChange={(e) => setCr(e.target.value)}
              placeholder="1/4, 1/2, 2, 13"
              className="anime-input w-full h-9 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Тип существа</label>
            <input
              value={creatureType}
              onChange={(e) => setCreatureType(e.target.value)}
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Класс доспеха (КД)</label>
            <input
              type="number"
              value={ac}
              onChange={(e) => setAc(Number(e.target.value))}
              className="anime-input w-full h-9 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Хиты</label>
            <input
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="anime-input w-full h-9 text-sm font-mono"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3 bg-bg border border-border cursor-pointer text-xs text-secondary">
          <input
            type="checkbox"
            checked={isRevealed}
            onChange={(e) => setIsRevealed(e.target.checked)}
            className="w-4 h-4"
          />
          <span>
            Открыто игрокам. Пока выключено — в бестиарии отображается силуэт и подпись «???».
          </span>
        </label>

        <div>
          <label className="block text-xs text-secondary mb-1.5">Описание, повадки и особенности</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="anime-input w-full text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 p-3 bg-bg border border-border">
          <img
            src={resolveImageUrl(imageKey, 'dragon')}
            alt="Портрет"
            className="w-16 h-16 rounded-full object-cover border border-border"
          />
          <div className="space-y-1">
            <label className="hud-btn-secondary h-8 inline-flex items-center gap-1.5 px-3 text-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              <span>{uploading ? 'Загрузка…' : 'Загрузить портрет'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
            <div className="text-xs text-muted">
              Портрет: <code>{imageKey || 'по умолчанию'}</code>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="anime-btn-primary h-10 px-5 text-xs inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" strokeWidth={1.5} />
            <span>{saving ? 'Сохранение…' : editingId ? 'Сохранить существо' : 'Создать существо'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
