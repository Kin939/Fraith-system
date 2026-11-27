import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ImagePlus, Loader2, Save, Swords, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, uploadImageAsset } from '../../lib/api';
import { resolveImageUrl } from '../../lib/artwork';
import { NPC_ATTITUDE_META, NPC_ATTITUDE_OPTIONS } from '../../lib/npc';
import { createEmptyNpcSheet, npcSheetHasStats } from '../../lib/npcSheet';
import { useCampaignStore } from '../../lib/store';
import type { CampaignNpc, NpcAttitude, NpcSheet } from '../../lib/types';
import { NpcSheetFields } from './NpcSheetFields';

interface NpcEditorProps {
  /** null → creating a brand-new contact */
  npc: CampaignNpc | null;
  onClose: () => void;
}

const TEXT_LIMIT = 4000;

export const NpcEditor: React.FC<NpcEditorProps> = ({ npc, onClose }) => {
  const setNpcs = useCampaignStore((s) => s.setNpcs);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [faction, setFaction] = useState('');
  const [location, setLocation] = useState('');
  const [attitude, setAttitude] = useState<NpcAttitude>('neutral');
  const [description, setDescription] = useState('');
  const [secretNotes, setSecretNotes] = useState('');
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [sheet, setSheet] = useState<NpcSheet>(() => createEmptyNpcSheet());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(npc?.name ?? '');
    setRole(npc?.role ?? '');
    setFaction(npc?.faction ?? '');
    setLocation(npc?.location ?? '');
    setAttitude(npc?.attitude ?? 'neutral');
    setDescription(npc?.description ?? '');
    setSecretNotes(npc?.secretNotes ?? '');
    setImageKey(npc?.imageKey ?? null);
    setIsRevealed(npc?.isRevealed ?? false);
    const incomingSheet = npc?.sheet ?? createEmptyNpcSheet();
    setSheet(incomingSheet);
    setSheetOpen(npcSheetHasStats(incomingSheet));
    setError(null);
  }, [npc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImageAsset(file, 'npcs');
      setImageKey(res.key);
    } catch (err) {
      pushToast({
        title: 'Ошибка загрузки портрета',
        message: err instanceof Error ? err.message : 'Попробуйте другой файл',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) {
      if (!name.trim()) setError('Укажите имя NPC');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        role: role.trim(),
        faction: faction.trim(),
        location: location.trim(),
        attitude,
        description: description.trim(),
        secretNotes: secretNotes.trim(),
        imageKey,
        isRevealed,
        sortOrder: npc?.sortOrder ?? 0,
        sheet,
      };
      const res = npc
        ? await apiFetch<{ npcs: CampaignNpc[] }>(`/api/dm/npcs/${npc.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ npcs: CampaignNpc[] }>('/api/dm/npcs', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setNpcs(res.npcs);
      pushToast({
        title: npc ? 'NPC обновлён' : 'NPC создан',
        message: isRevealed
          ? 'Контакт открыт игрокам и виден всем за столом'
          : 'Контакт скрыт от игроков — откройте его, когда придёт время',
        variant: 'success',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить NPC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={npc ? 'Редактирование NPC' : 'Новый NPC'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="glass-panel hud-cut w-full max-w-2xl my-4 sm:my-8 p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-lg text-text">
              {npc ? 'Редактирование связи' : 'Новая связь'}
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Сначала NPC создаётся скрытым. Откройте его игрокам, когда отряд встретит его в
              истории.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center text-muted hover:text-text transition-colors shrink-0"
            title="Закрыть"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Portrait */}
        <div className="flex items-center gap-3 p-3 bg-bg border border-border">
          <div className="w-16 h-16 shrink-0 overflow-hidden hud-cut-sm border border-border bg-deep">
            {imageKey ? (
              <img
                src={resolveImageUrl(imageKey, 'crown')}
                alt="Портрет NPC"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <ImagePlus className="w-5 h-5" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="hud-btn-secondary h-8 inline-flex items-center gap-1.5 px-3 text-xs cursor-pointer">
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} />
              ) : (
                <Upload className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
              )}
              <span>{uploading ? 'Загрузка…' : 'Загрузить портрет'}</span>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
            <div className="text-[11px] text-muted truncate">
              {imageKey ? imageKey : 'Без портрета — покажем монограмму'}
            </div>
          </div>
          {imageKey && (
            <button
              type="button"
              onClick={() => setImageKey(null)}
              className="h-7 w-7 inline-flex items-center justify-center text-muted hover:text-negative transition-colors shrink-0"
              title="Убрать портрет"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-secondary mb-1.5">Имя NPC *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Селина Ветрокрылая"
              className="anime-input w-full h-9 text-sm"
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1.5">Роль / занятие</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Капитан стражи"
              className="anime-input w-full h-9 text-sm"
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1.5">Фракция</label>
            <input
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
              placeholder="Серебряный конклав"
              className="anime-input w-full h-9 text-sm"
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1.5">Локация</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Порт Фрайт"
              className="anime-input w-full h-9 text-sm"
              maxLength={80}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5">Отношение к отряду</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {NPC_ATTITUDE_OPTIONS.map((option) => {
              const meta = NPC_ATTITUDE_META[option];
              const active = attitude === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAttitude(option)}
                  className={`h-8 px-2.5 text-xs border inline-flex items-center gap-1.5 transition-colors ${
                    active ? 'bg-raised text-text' : 'bg-bg text-secondary hover:text-text'
                  }`}
                  style={{
                    borderColor: active ? `${meta.color}88` : undefined,
                    color: active ? meta.color : undefined,
                  }}
                  title={meta.hint}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5">
            Описание для игроков
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, TEXT_LIMIT))}
            placeholder="Что отряд знает о нём: внешность, манера, чем может помочь…"
            className="anime-input w-full text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1.5 inline-flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5 text-[#f59e0b]" strokeWidth={1.5} />
            <span>Тайные заметки мастера</span>
          </label>
          <textarea
            rows={3}
            value={secretNotes}
            onChange={(e) => setSecretNotes(e.target.value.slice(0, TEXT_LIMIT))}
            placeholder="Истинные мотивы, тайные связи, что скрывает… Игроки этого не увидят."
            className="anime-input w-full text-sm"
          />
        </div>

        {/* Боевой лист: статы для трекера «Бой» */}
        <div className="border border-border bg-bg">
          <button
            type="button"
            onClick={() => setSheetOpen((prev) => !prev)}
            className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
          >
            <Swords className="w-4 h-4 text-primary shrink-0" strokeWidth={1.6} />
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-text">Боевой лист</span>
              <span className="block text-[11px] text-muted">
                {npcSheetHasStats(sheet)
                  ? `КД ${sheet.ac ?? '—'} · HP ${sheet.hp ?? '—'}${sheet.cr ? ` · CR ${sheet.cr}` : ''}`
                  : 'АС, HP, характеристики, атаки — чтобы добавить НПС в бой одним кликом'}
              </span>
            </span>
            <span className="text-[10px] font-mono uppercase text-secondary shrink-0">
              {sheetOpen ? 'свернуть' : 'заполнить'}
            </span>
          </button>
          {sheetOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-border/70">
              <NpcSheetFields sheet={sheet} onChange={setSheet} />
            </div>
          )}
        </div>

        <label className="flex items-start gap-2.5 p-3 bg-bg border border-border cursor-pointer text-xs text-secondary">
          <input
            type="checkbox"
            checked={isRevealed}
            onChange={(e) => setIsRevealed(e.target.checked)}
            className="w-4 h-4 mt-0.5"
          />
          <span className="inline-flex items-start gap-1.5">
            {isRevealed ? (
              <Eye className="w-3.5 h-3.5 text-positive shrink-0 mt-0.5" strokeWidth={1.6} />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" strokeWidth={1.6} />
            )}
            <span>
              {isRevealed
                ? 'Открыт игрокам: контакт виден во вкладке «Связи» всем участникам.'
                : 'Скрыт от игроков: виден только вам в панели мастера.'}
            </span>
          </span>
        </label>

        {error && <div className="text-xs text-negative">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs text-secondary hover:text-text transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="anime-btn-primary h-10 px-5 text-xs inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" strokeWidth={1.5} />
            <span>{saving ? 'Сохранение…' : npc ? 'Сохранить NPC' : 'Создать NPC'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
