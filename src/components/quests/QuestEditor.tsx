import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Upload } from 'lucide-react';
import { apiFetch, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { useCampaignStore } from '../../lib/store';
import type { Quest, QuestStatus } from '../../lib/types';

interface QuestEditorProps {
  initialQuest?: Quest | null;
  onDone?: () => void;
}

export const QuestEditor: React.FC<QuestEditorProps> = ({ initialQuest, onDone }) => {
  const quests = useCampaignStore((s) => s.quests);
  const setQuests = useCampaignStore((s) => s.setQuests);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [editingId, setEditingId] = useState<number | null>(initialQuest?.id ?? null);
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [fullDesc, setFullDesc] = useState('');
  const [reward, setReward] = useState('');
  const [location, setLocation] = useState('');
  const [giver, setGiver] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [deadline, setDeadline] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTarget, setProgressTarget] = useState(10);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [status, setStatus] = useState<QuestStatus>('active');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadQuestIntoForm = (q: Quest | null) => {
    if (!q) {
      setEditingId(null);
      setTitle('');
      setShortDesc('');
      setFullDesc('');
      setReward('');
      setLocation('');
      setGiver('');
      setDifficulty('');
      setDeadline('');
      setProgressCurrent(0);
      setProgressTarget(10);
      setImageKey(null);
      setStatus('active');
      return;
    }
    setEditingId(q.id);
    setTitle(q.title);
    setShortDesc(q.shortDesc);
    setFullDesc(q.fullDesc);
    setReward(q.reward);
    setLocation(q.parameters.location || '');
    setGiver(q.parameters.giver || '');
    setDifficulty(q.parameters.difficulty || '');
    setDeadline(q.parameters.deadline || '');
    setProgressCurrent(q.progressCurrent);
    setProgressTarget(q.progressTarget);
    setImageKey(q.imageKey);
    setStatus(q.status);
  };

  useEffect(() => {
    if (initialQuest !== undefined) {
      loadQuestIntoForm(initialQuest);
    }
  }, [initialQuest]);

  const handleR2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImageAsset(file, 'quests');
      setImageKey(res.key);
      pushToast({
        title: 'Изображение загружено в R2',
        message: `Ключ объекта: ${res.key}`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки в R2',
        message: err instanceof Error ? err.message : 'Попробуйте другой файл',
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
        shortDesc,
        fullDesc,
        reward,
        parameters: { location, giver, difficulty, deadline },
        progressCurrent,
        progressTarget,
        imageKey,
        status,
      };
      const res = editingId
        ? await apiFetch<{ quests: Quest[] }>(`/api/dm/quests/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ quests: Quest[] }>('/api/dm/quests', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setQuests(res.quests);
      pushToast({
        title: editingId ? 'Квест обновлён' : 'Квест создан',
        message: 'Все игроки получили обновление через WebSocket.',
        variant: 'success',
      });
      if (!editingId) loadQuestIntoForm(null);
      onDone?.();
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения квеста',
        message: err instanceof Error ? err.message : 'Проверьте поля формы',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await apiFetch<{ quests: Quest[] }>(`/api/dm/quests/${id}`, {
      method: 'DELETE',
    });
    setQuests(res.quests);
    if (editingId === id) loadQuestIntoForm(null);
    pushToast({
      title: 'Квест удалён',
      message: 'Запись удалена из D1.',
      variant: 'info',
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Existing Quests Selector */}
      <div className="xl:col-span-5 glass-panel rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-anime font-bold text-sm">Список квестов ({quests.length})</h4>
          <button
            type="button"
            onClick={() => loadQuestIntoForm(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30"
          >
            <Plus className="w-3.5 h-3.5" />
            Новый квест
          </button>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {quests.map((q) => (
            <div
              key={q.id}
              onClick={() => loadQuestIntoForm(q)}
              className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                editingId === q.id
                  ? 'bg-primary/15 border-primary'
                  : 'bg-bg/50 border-border hover:border-primary/40'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{q.title}</div>
                <div className="text-xs text-muted">
                  {q.progressCurrent}/{q.progressTarget} • {q.status}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(q.id);
                }}
                className="p-1.5 rounded-lg text-muted hover:text-rose-400"
                title="Удалить квест"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="xl:col-span-7 glass-panel rounded-3xl p-5 space-y-4"
      >
        <h4 className="font-anime font-bold text-base">
          {editingId ? `Редактирование квеста #${editingId}` : 'Создание нового квеста'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Название квеста *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название задания"
              className="anime-input w-full text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Краткое описание (на плитке) *</label>
            <input
              required
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Краткая цель задания"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Текущий прогресс</label>
            <input
              type="number"
              min={0}
              value={progressCurrent}
              onChange={(e) => setProgressCurrent(Number(e.target.value))}
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Целевой прогресс</label>
            <input
              type="number"
              min={1}
              value={progressTarget}
              onChange={(e) => setProgressTarget(Number(e.target.value))}
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QuestStatus)}
              className="anime-input w-full text-sm"
            >
              <option value="active">Активен (active)</option>
              <option value="available">Доступен (available)</option>
              <option value="completed">Завершён (completed)</option>
              <option value="failed">Провален (failed)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Награда</label>
            <input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="300 ЗМ, Редкий свиток"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Локация</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Хрустальные штольни"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Заказчик</label>
            <input
              value={giver}
              onChange={(e) => setGiver(e.target.value)}
              placeholder="Капитан Лира Вейл"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Сложность</label>
            <input
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="Средняя (Ур. 5)"
              className="anime-input w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Срок выполнения</label>
            <input
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="До полнолуния"
              className="anime-input w-full text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Полное описание</label>
          <textarea
            rows={4}
            value={fullDesc}
            onChange={(e) => setFullDesc(e.target.value)}
            className="anime-input w-full text-sm"
          />
        </div>

        {/* R2 Image Upload */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-bg/60 border border-border">
          <img
            src={resolveImageUrl(imageKey, '⚔')}
            alt="Превью"
            className="w-20 h-14 rounded-xl object-cover border border-border"
          />
          <div className="space-y-1">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary text-xs font-medium cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>{uploading ? 'Загрузка в R2...' : 'Загрузить иллюстрацию в R2'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleR2Upload}
                className="hidden"
              />
            </label>
            <div className="text-[11px] text-muted">
              Текущий image_key: <code>{imageKey || 'по умолчанию'}</code>
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
            <span>{saving ? 'Сохранение...' : editingId ? 'Обновить квест' : 'Создать квест'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
