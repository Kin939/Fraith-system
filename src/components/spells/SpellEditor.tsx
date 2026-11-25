import React, { useState } from 'react';
import { FileUp, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
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
        message: 'Укажите классы, которым доступно заклинание.',
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
        title: editingId ? 'Заклинание обновлено' : 'Заклинание добавлено в каталог',
        message: 'Изменения синхронизированы через Durable Object.',
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
        message: 'Каталог SRD/Open5e успешно пополнен.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка импорта SRD JSON',
        message: err instanceof Error ? err.message : 'Ожидается массив или ответ Open5e API',
        variant: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 glass-panel rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-anime font-bold text-sm">Каталог ({spells.length})</h4>
            <button
              type="button"
              onClick={() => selectSpell(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/20 text-primary text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Новое заклинание
            </button>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {spells.map((sp) => (
              <div
                key={sp.id}
                onClick={() => selectSpell(sp)}
                className={`p-2.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-2 ${
                  editingId === sp.id
                    ? 'bg-primary/15 border-primary'
                    : 'bg-bg/50 border-border hover:border-primary/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      {sp.level} ур.
                    </span>
                    {sp.isHomebrew && <Sparkles className="w-3 h-3 text-accent shrink-0" />}
                    <span className="text-xs font-semibold truncate">{sp.name}</span>
                  </div>
                  <div className="text-[11px] text-muted truncate">{sp.classes.join(', ')}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(sp.id);
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
            {editingId ? `Редактирование заклинания #${editingId}` : 'Добавить SRD / Homebrew заклинание'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Название *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название заклинания"
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Уровень (0–9)</label>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="anime-input w-full text-sm"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                  <option key={l} value={l}>
                    {l === 0 ? '0 — Заговор' : `${l} уровень`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Школа магии</label>
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="anime-input w-full text-sm"
              >
                {ALL_SCHOOLS.map((s) => (
                  <option key={s} value={s}>
                    {MAGIC_SCHOOL_LABELS_RU[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Время накладывания</label>
              <input
                value={castingTime}
                onChange={(e) => setCastingTime(e.target.value)}
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Дистанция</label>
              <input
                value={spellRange}
                onChange={(e) => setSpellRange(e.target.value)}
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Компоненты</label>
              <input
                value={components}
                onChange={(e) => setComponents(e.target.value)}
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Длительность</label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="anime-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Источник</label>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="anime-input w-full text-sm"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-xs text-muted">Доступные классы *</label>

            <div>
              <div className="text-[11px] text-muted mb-1">Официальные классы (D&amp;D 5e):</div>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_CLASSES.map((cls) => {
                  const active = selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => toggleClass(cls)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary/25 border-primary text-text'
                          : 'bg-bg/50 border-border text-muted hover:text-text'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-purple-300/90 mb-1">
                Homebrew классы (dnd.su — все 15 классов):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HOMEBREW_CLASSES.map((cls) => {
                  const active = selectedClasses.includes(cls);
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => toggleClass(cls)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-purple-500/25 border-purple-400 text-purple-100'
                          : 'bg-bg/50 border-border text-muted hover:text-text'
                      }`}
                    >
                      {cls} <span className="text-[9px] opacity-75">HB</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isHomebrew}
              onChange={(e) => setIsHomebrew(e.target.checked)}
              className="w-4 h-4 accent-purple-500"
            />
            <span>Пометить как авторское Homebrew-заклинание</span>
          </label>

          <div>
            <label className="block text-xs text-muted mb-1">Полное описание *</label>
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
              className="anime-btn-primary px-5 py-2.5 text-xs inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить заклинание'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Open5e / dnd.su Batch JSON Importer */}
      <div className="glass-panel rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-accent" />
          <h4 className="font-anime font-bold text-sm">
            Массовый импорт SRD-заклинаний (Open5e API / JSON)
          </h4>
        </div>
        <p className="text-xs text-muted">
          Вставьте JSON-ответ из <code>https://api.open5e.com/v1/spells/?format=json</code> или массив
          объектов <code>{`[{ "name": "...", "level_int": 2, "school": "Illusion", "dnd_class": "Wizard, Bard", "desc": "..." }]`}</code>.
        </p>
        <textarea
          data-no-format="true"
          rows={3}
          value={batchJson}
          onChange={(e) => setBatchJson(e.target.value)}
          placeholder='[{"name":"Туманное облако (Fog Cloud)","level":1,"school":"Conjuration","classes":["Wizard","Druid","Ranger","Sorcerer"],"description":"Вы создаёте сферу тумана радиусом 20 футов..."}]'
          className="anime-input w-full font-mono text-xs"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={importing || !batchJson.trim()}
            onClick={handleBatchImport}
            className="px-4 py-2 rounded-xl bg-accent/20 text-accent border border-accent/40 text-xs font-semibold hover:bg-accent/30 disabled:opacity-40"
          >
            {importing ? 'Импорт...' : 'Импортировать в D1'}
          </button>
        </div>
      </div>
    </div>
  );
};
