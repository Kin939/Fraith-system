import React, { useEffect, useState } from 'react';
import { Plus, Save, Star, Trash2, Upload } from 'lucide-react';
import { apiFetch, patchQuestTile, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { normalizeQuestPattern } from '../../lib/questStyle';
import { useCampaignStore } from '../../lib/store';
import type { Quest, QuestStatus, QuestTilePattern } from '../../lib/types';
import { QuestTileEditor, type QuestTileDraft } from './QuestTileEditor';
import { VisibilityPicker } from '../common/VisibilityPicker';
import { fetchPartyPlayers } from '../../lib/api';
import type { PartyPlayerSummary } from '../../lib/types';

interface QuestEditorProps {
  initialQuest?: Quest | null;
  onDone?: () => void;
}

export const QuestEditor: React.FC<QuestEditorProps> = ({ initialQuest, onDone }) => {
  const quests = useCampaignStore((s) => s.quests);
  const setQuests = useCampaignStore((s) => s.setQuests);
  const pushToast = useCampaignStore((s) => s.pushToast);
  const dmFocusQuestId = useCampaignStore((s) => s.dmFocusQuestId);
  const clearFocusQuest = useCampaignStore((s) => s.clearFocusQuest);

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
  const [tileAccent, setTileAccent] = useState<string | null>(null);
  const [tileEmblem, setTileEmblem] = useState<string | null>(null);
  const [tilePattern, setTilePattern] = useState<QuestTilePattern>('none');
  const [isImportant, setIsImportant] = useState(false);
  /** Личные квесты: пустой список = виден всей партии. */
  const [visibleUserIds, setVisibleUserIds] = useState<number[]>([]);
  const [partyPlayers, setPartyPlayers] = useState<PartyPlayerSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
      setTileAccent(null);
      setTileEmblem(null);
      setTilePattern('none');
      setIsImportant(false);
      setVisibleUserIds([]);
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
    setTileAccent(q.tileStyle?.accent ?? null);
    setTileEmblem(q.tileStyle?.emblem ?? null);
    setTilePattern(normalizeQuestPattern(q.tileStyle?.pattern));
    setIsImportant(Boolean(q.tileStyle?.isImportant));
    setVisibleUserIds(q.visibleUserIds ?? []);
  };

  useEffect(() => {
    if (initialQuest !== undefined) {
      loadQuestIntoForm(initialQuest);
    }
  }, [initialQuest]);

  useEffect(() => {
    let alive = true;
    void fetchPartyPlayers()
      .then((players) => {
        if (alive) setPartyPlayers(players);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Deep link from the "Оформление" button on a quest tile
  useEffect(() => {
    if (!dmFocusQuestId) return;
    const target = quests.find((q) => q.id === dmFocusQuestId);
    if (target) {
      loadQuestIntoForm(target);
      clearFocusQuest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmFocusQuestId, quests]);

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadImageAsset(file, 'quests');
      setImageKey(res.key);
      pushToast({
        title: 'Иллюстрация загружена',
        message: 'Не забудьте сохранить квест, чтобы обновить плитку',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки изображения',
        message: err instanceof Error ? err.message : 'Попробуйте другой файл',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const tileDraft: QuestTileDraft = {
    accent: tileAccent,
    emblem: tileEmblem,
    pattern: tilePattern,
    isImportant,
    imageKey,
  };

  const applyTileDraftPatch = (patch: Partial<QuestTileDraft>) => {
    if (patch.accent !== undefined) setTileAccent(patch.accent);
    if (patch.emblem !== undefined) setTileEmblem(patch.emblem);
    if (patch.pattern !== undefined) setTilePattern(normalizeQuestPattern(patch.pattern));
    if (patch.isImportant !== undefined) setIsImportant(patch.isImportant);
    if (patch.imageKey !== undefined) setImageKey(patch.imageKey);
  };

  const previewQuest: Quest = {
    id: editingId ?? 0,
    title: title || 'Новый квест',
    shortDesc: shortDesc || 'Краткое описание появится на плитке',
    fullDesc,
    reward,
    parameters: { location, giver, difficulty, deadline },
    progressCurrent,
    progressTarget,
    imageKey,
    status,
    createdAt: new Date().toISOString(),
    tileStyle: { accent: tileAccent, emblem: tileEmblem, pattern: tilePattern, isImportant },
    notesCount: quests.find((q) => q.id === editingId)?.notesCount ?? 0,
    visibleUserIds,
  };

  const handleToggleImportant = async (quest: Quest) => {
    setTogglingId(quest.id);
    try {
      const quests = await patchQuestTile(quest.id, {
        isImportant: !quest.tileStyle?.isImportant,
      });
      setQuests(quests);
      if (editingId === quest.id) {
        setIsImportant(!quest.tileStyle?.isImportant);
      }
    } catch (err) {
      pushToast({
        title: 'Не удалось обновить плитку',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    } finally {
      setTogglingId(null);
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
        tileAccent,
        tileEmblem,
        tilePattern,
        isImportant,
        visibleUserIds,
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
        message: 'Обновление отправлено игрокам за столом',
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
      message: 'Запись удалена',
      variant: 'info',
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-3 glass-panel hud-cut p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-text">Список квестов ({quests.length})</h4>
          <button
            type="button"
            onClick={() => loadQuestIntoForm(null)}
            className="hud-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Новый квест</span>
          </button>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {quests.map((q) => (
            <div
              key={q.id}
              onClick={() => loadQuestIntoForm(q)}
              className={`p-3 border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                editingId === q.id
                  ? 'bg-raised border-primary/60'
                  : 'bg-bg border-border hover:bg-raised/60'
              }`}
            >
              <div className="min-w-0 flex items-start gap-1.5">
                {q.tileStyle?.isImportant && (
                  <Star
                    className="w-3.5 h-3.5 shrink-0 mt-0.5"
                    strokeWidth={1.6}
                    fill="currentColor"
                    style={{ color: q.tileStyle?.accent || '#f59e0b' }}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text truncate">{q.title}</div>
                  <div className="text-xs text-muted font-mono tabular-nums mt-0.5">
                    {q.progressCurrent} из {q.progressTarget} · {q.status}
                    {q.visibleUserIds.length > 0 ? ` · личный (${q.visibleUserIds.length})` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleImportant(q);
                  }}
                  disabled={togglingId === q.id}
                  className={`p-1.5 transition-colors disabled:opacity-50 ${
                    q.tileStyle?.isImportant
                      ? 'text-[color:var(--primary)] hover:text-text'
                      : 'text-muted hover:text-text'
                  }`}
                  title={q.tileStyle?.isImportant ? 'Снять метку важного' : 'Отметить важным'}
                >
                  <Star
                    className="w-4 h-4"
                    strokeWidth={1.5}
                    fill={q.tileStyle?.isImportant ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(q.id);
                  }}
                  className="p-1.5 text-muted hover:text-negative transition-colors"
                  title="Удалить квест"
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
        className="xl:col-span-5 glass-panel hud-cut p-6 space-y-4"
      >
        <h4 className="font-medium text-base text-text">
          {editingId ? `Редактирование квеста #${editingId}` : 'Новый квест'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-secondary mb-1.5">Название квеста</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название поручения"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-secondary mb-1.5">Краткое описание (на карточке)</label>
            <input
              required
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Краткая цель задания"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Текущий прогресс</label>
            <input
              type="number"
              min={0}
              value={progressCurrent}
              onChange={(e) => setProgressCurrent(Number(e.target.value))}
              className="anime-input w-full h-9 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Целевой прогресс</label>
            <input
              type="number"
              min={1}
              value={progressTarget}
              onChange={(e) => setProgressTarget(Number(e.target.value))}
              className="anime-input w-full h-9 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QuestStatus)}
              className="anime-input w-full h-9 text-sm"
            >
              <option value="active">Активен</option>
              <option value="available">Доступен</option>
              <option value="completed">Завершён</option>
              <option value="failed">Провален</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Награда</label>
            <input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="300 зм, редкий свиток"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Локация</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Хрустальные штольни"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Заказчик</label>
            <input
              value={giver}
              onChange={(e) => setGiver(e.target.value)}
              placeholder="Капитан Лира Вейл"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Сложность</label>
            <input
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="Средняя (ур. 5)"
              className="anime-input w-full h-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Срок выполнения</label>
            <input
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="До полнолуния"
              className="anime-input w-full h-9 text-sm"
            />
          </div>
        </div>

        <VisibilityPicker
          players={partyPlayers}
          value={visibleUserIds}
          onChange={setVisibleUserIds}
          dense
          label="Кому виден квест"
        />

        <div>
          <label className="block text-xs text-secondary mb-1.5">Полное описание</label>
          <textarea
            rows={4}
            value={fullDesc}
            onChange={(e) => setFullDesc(e.target.value)}
            className="anime-input w-full text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 p-3 bg-bg border border-border">
          <img
            src={resolveImageUrl(imageKey, 'blades')}
            alt="Превью"
            className="w-20 h-14 object-cover border border-border"
          />
          <div className="space-y-1 min-w-0">
            <label className={`hud-btn-secondary h-8 inline-flex items-center gap-1.5 px-3 text-xs cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              <span>{uploading ? 'Загрузка…' : 'Загрузить иллюстрацию'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleCoverUpload(file);
                }}
                className="hidden"
              />
            </label>
            <div className="text-xs text-muted truncate">
              Иллюстрация: <code>{imageKey || 'эмблема плитки'}</code>
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
            <span>{saving ? 'Сохранение…' : editingId ? 'Сохранить квест' : 'Создать квест'}</span>
          </button>
        </div>
      </form>

      <div className="xl:col-span-4 lg:sticky lg:top-6 self-start">
        <div className="glass-panel hud-cut p-5">
          <QuestTileEditor
            previewQuest={previewQuest}
            draft={tileDraft}
            onChange={applyTileDraftPatch}
            onUploadCover={(file) => void handleCoverUpload(file)}
            onRemoveCover={() => setImageKey(null)}
            uploadingCover={uploading}
          />
          <p className="mt-3 text-[11px] text-muted leading-relaxed">
            Подсказка: отметьте квест звёздочкой — он поднимется в начало списка и получит
            акцентное свечение и бегущий блик. Цвет и эмблема применяются сразу к плитке,
            предпросмотр выше показывает, как её увидят игроки.
          </p>
        </div>
      </div>
    </div>
  );
};
