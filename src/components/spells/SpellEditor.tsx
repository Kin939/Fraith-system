import React, { useState } from 'react';
import { FileUp, Plus, Save, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { DND_HOMEBREW_CLASSES_META, MAGIC_SCHOOL_LABELS_RU } from '../../lib/lss';
import { useCampaignStore } from '../../lib/store';
import type { Spell } from '../../lib/types';

const OFFICIAL_CLASSES = [
  'волшебник',
  'бард',
  'друид',
  'жрец',
  'изобретатель',
  'колдун',
  'паладин',
  'следопыт',
  'чародей',
  'варвар',
  'воин',
  'монах',
  'плут',
];

const HOMEBREW_CLASSES = DND_HOMEBREW_CLASSES_META.map((c) => c.labelLower);
const ALL_SCHOOLS = [
  'Воплощение',
  'Вызов',
  'Иллюзия',
  'Некромантия',
  'Ограждение',
  'Очарование',
  'Преобразование',
  'Прорицание',
];

export const SpellEditor: React.FC = () => {
  const spells = useCampaignStore((s) => s.spells);
  const setSpells = useCampaignStore((s) => s.setSpells);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [school, setSchool] = useState('Воплощение');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['волшебник']);
  const [castingTime, setCastingTime] = useState('1 действие');
  const [spellRange, setSpellRange] = useState('60 футов');
  const [components, setComponents] = useState('В, С');
  const [duration, setDuration] = useState('Мгновенная');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('HB');
  const [isHomebrew, setIsHomebrew] = useState(true);
  const [saving, setSaving] = useState(false);

  const [batchJson, setBatchJson] = useState('');
  const [importing, setImporting] = useState(false);

  const selectSpell = (sp: Spell | null) => {
    if (!sp) {
      setEditingId(null);
      setName('');
      setLevel(1);
      setSchool('Воплощение');
      setSelectedClasses(['волшебник']);
      setCastingTime('1 действие');
      setSpellRange('60 футов');
      setComponents('В, С');
      setDuration('Мгновенная');
      setDescription('');
      setSource('HB');
      setIsHomebrew(true);
      return;
    }
    setEditingId(sp.id);
    setName(sp.name);
    setLevel(sp.level);
    setSchool(sp.school);
    setSelectedClasses(sp.classes);
    setCastingTime(sp.castingTime);
    setSpellRange(sp.spellRange);
    setComponents(sp.components);
    setDuration(sp.duration);
    setDescription(sp.description);
    setSource(sp.source);
    setIsHomebrew(sp.isHomebrew);
  };

  const toggleClass = (cls: string) => {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClasses.length === 0) {
      pushToast({
        title: 'Выберите хотя бы один класс',
        message: 'Укажите классы, которым доступно заклинание',
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        level,
        school,
        classes: selectedClasses,
        castingTime,
        spellRange,
        components,
        duration,
        description,
        source,
        isHomebrew,
      };
      const res = editingId
        ? await apiFetch<{ spells: Spell[] }>(`/api/dm/spells/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ spells: Spell[] }>('/api/dm/spells', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setSpells(res.spells);
      pushToast({
        title: editingId ? 'Заклинание обновлено' : 'Заклинание добавлено',
        message: 'Каталог обновлён у всех участников',
        variant: 'success',
      });
      if (!editingId) selectSpell(null);
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения заклинания',
        message: err instanceof Error ? err.message : 'Проверьте поля',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await apiFetch<{ spells: Spell[] }>(`/api/dm/spells/${id}`, {
      method: 'DELETE',
    });
    setSpells(res.spells);
    if (editingId === id) selectSpell(null);
  };

  const handleBatchImport = async () => {
    if (!batchJson.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(batchJson) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { results?: unknown[] }).results)
          ? (parsed as { results: unknown[] }).results
          : [];
      const res = await apiFetch<{ imported: number; spells: Spell[] }>('/api/dm/spells/import', {
        method: 'POST',
        body: JSON.stringify({ spells: arr }),
      });
      setSpells(res.spells);
      setBatchJson('');
      pushToast({
        title: `Импортировано заклинаний: ${res.imported}`,
        message: 'Каталог заклинаний пополнен',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка импорта JSON',
        message: err instanceof Error ? err.message : 'Ожидается массив заклинаний',
        variant: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 glass-panel hud-cut p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-text">Каталог ({spells.length})</h4>
            <button
              type="button"
              onClick={() => selectSpell(null)}
              className="hud-btn-secondary h-8 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Новое заклинание</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {spells.map((sp) => (
              <div
                key={sp.id}
                onClick={() => selectSpell(sp)}
                className={`p-2.5 border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                  editingId === sp.id
                    ? 'bg-raised border-primary/60'
                    : 'bg-bg border-border hover:bg-raised/60'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="hud-keycap">
                      [{sp.level}]
                    </span>
                    <span className="text-xs font-medium text-text truncate">{sp.name}</span>
                    {sp.isHomebrew && (
                      <span className="font-mono text-xs text-muted shrink-0">Авт.</span>
                    )}
                  </div>
                  <div className="text-xs text-muted truncate mt-1">{sp.classes.join(', ')}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(sp.id);
                  }}
                  className="p-1.5 text-muted hover:text-negative transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 glass-panel hud-cut p-6 space-y-4"
        >
          <h4 className="font-medium text-base text-text">
            {editingId ? `Редактирование заклинания #${editingId}` : 'Добавить заклинание'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-secondary mb-1.5">Название</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название заклинания"
                className="anime-input w-full h-9 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Круг (0–9)</label>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="anime-input w-full h-9 text-sm"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                  <option key={l} value={l}>
                    {l === 0 ? '0 — Заговор' : `${l} круг`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Школа магии</label>
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="anime-input w-full h-9 text-sm"
              >
                {ALL_SCHOOLS.map((s) => (
                  <option key={s} value={s}>
                    {MAGIC_SCHOOL_LABELS_RU[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Время накладывания</label>
              <input
                value={castingTime}
                onChange={(e) => setCastingTime(e.target.value)}
                className="anime-input w-full h-9 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Дистанция</label>
              <input
                value={spellRange}
                onChange={(e) => setSpellRange(e.target.value)}
                className="anime-input w-full h-9 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Компоненты</label>
              <input
                value={components}
                onChange={(e) => setComponents(e.target.value)}
                className="anime-input w-full h-9 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Длительность</label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="anime-input w-full h-9 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-secondary mb-1.5">Источник</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="anime-input w-full h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-secondary">Доступные классы</label>

            <div>
              <div className="text-xs text-muted mb-1.5">Официальные классы D&amp;D 5e</div>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_CLASSES.map((cls) => {
                  const active = selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => toggleClass(cls)}
                      className={`h-7 px-2.5 text-xs border transition-colors ${
                        active
                          ? 'bg-raised border-primary/60 text-text font-medium'
                          : 'bg-bg border-border text-secondary hover:text-text'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted mb-1.5">
                Авторские классы (dnd.su)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HOMEBREW_CLASSES.map((cls) => {
                  const active = selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => toggleClass(cls)}
                      className={`h-7 px-2.5 text-xs border transition-colors ${
                        active
                          ? 'bg-raised border-primary/60 text-text font-medium'
                          : 'bg-bg border-border text-secondary hover:text-text'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={isHomebrew}
              onChange={(e) => setIsHomebrew(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Пометить как авторское заклинание кампании</span>
          </label>

          <div>
            <label className="block text-xs text-secondary mb-1.5">Полное описание</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="anime-input w-full text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="anime-btn-primary h-10 px-5 text-xs inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" strokeWidth={1.5} />
              <span>{saving ? 'Сохранение…' : editingId ? 'Сохранить изменения' : 'Добавить заклинание'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="glass-panel hud-cut p-6 space-y-3">
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-muted" strokeWidth={1.5} />
          <h4 className="font-medium text-sm text-text">
            Массовый импорт заклинаний (Open5e / JSON)
          </h4>
        </div>
        <p className="text-xs text-secondary">
          Вставьте ответ из <code>https://api.open5e.com/v1/spells/?format=json</code> или массив объектов заклинаний.
        </p>
        <textarea
          data-no-format="true"
          rows={3}
          value={batchJson}
          onChange={(e) => setBatchJson(e.target.value)}
          placeholder='[{"name":"Туманное облако","level":1,"school":"Вызов","classes":["Wizard","Druid"],"description":"..."}]'
          className="anime-input w-full font-mono text-xs"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={importing || !batchJson.trim()}
            onClick={handleBatchImport}
            className="hud-btn-secondary h-9 px-4 text-xs disabled:opacity-40"
          >
            {importing ? 'Импорт…' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  );
};
