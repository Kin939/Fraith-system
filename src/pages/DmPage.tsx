import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Eye,
  KeyRound,
  Palette,
  Save,
  ScrollText,
  Skull,
  Sparkles,
  Users,
} from 'lucide-react';
import { BestiaryEditor } from '../components/bestiary/BestiaryEditor';
import { AccountsManager } from '../components/dm/AccountsManager';
import { ThemeEditor } from '../components/dm/ThemeEditor';
import { QuestEditor } from '../components/quests/QuestEditor';
import { SpellEditor } from '../components/spells/SpellEditor';
import { TalentEditor } from '../components/talents/TalentEditor';
import { apiFetch } from '../lib/api';
import {
  DND_HOMEBREW_CLASS_BY_KEY,
  DND_HOMEBREW_CLASSES_META,
  DND_OFFICIAL_CLASS_LABELS_RU,
  normalizeDndClass,
} from '../lib/lss';
import { useCampaignStore } from '../lib/store';
import type { CharacterProfile, PlayerId } from '../lib/types';

type DmSection = 'accounts' | 'quests' | 'bestiary' | 'spells' | 'talents' | 'roster' | 'themes';

export const DmPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const charactersById = useCampaignStore((s) => s.charactersById);
  const updateCharacterProfileInStore = useCampaignStore((s) => s.updateCharacterProfileInStore);
  const setDmSelectedPlayerId = useCampaignStore((s) => s.setDmSelectedPlayerId);
  const setActiveTab = useCampaignStore((s) => s.setActiveTab);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const [section, setSection] = useState<DmSection>('accounts');

  if (user?.role !== 'dm') {
    return (
      <div className="glass-panel hud-cut p-8 text-center text-negative text-sm">
        Доступ к разделу открыт только Мастеру кампании
      </div>
    );
  }

  const sections: Array<{ id: DmSection; label: string; icon: React.ReactNode }> = [
    { id: 'accounts', label: 'Пароли и доступы', icon: <KeyRound className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'quests', label: 'Квесты', icon: <ScrollText className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'bestiary', label: 'Бестиарий', icon: <Skull className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'spells', label: 'Заклинания', icon: <BookOpen className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'talents', label: 'Таланты и вдохновение', icon: <Sparkles className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'roster', label: 'Герои и лимиты', icon: <Users className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'themes', label: 'Темы аккаунтов', icon: <Palette className="w-4 h-4" strokeWidth={1.5} /> },
  ];

  const handleSaveCharacterSettings = async (profile: CharacterProfile) => {
    try {
      const res = await apiFetch<{ profile: CharacterProfile }>(
        `/api/dm/characters/${profile.playerId}`,
        {
          method: 'PUT',
          body: JSON.stringify(profile),
        }
      );
      updateCharacterProfileInStore(profile.playerId, res.profile);
      pushToast({
        title: `Игрок ${profile.playerId} обновлён`,
        message: 'Класс, максимум заклинаний и настройки героя сохранены',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка сохранения героя',
        message: err instanceof Error ? err.message : 'Проверьте данные',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-medium text-2xl text-text">Панель Мастера</h1>
        <p className="text-sm text-secondary mt-1">
          Управление доступами игроков, контентом кампании и персональными акцентами
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 overflow-x-auto bg-surface border border-border p-1">
        {sections.map((sec) => {
          const active = section === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSection(sec.id)}
              className={`h-9 inline-flex items-center gap-2 px-3.5 text-xs whitespace-nowrap transition-colors ${
                active
                  ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-secondary hover:text-text'
              }`}
            >
              <span className={active ? 'text-primary' : 'text-muted'}>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {section === 'accounts' && <AccountsManager />}
      {section === 'quests' && <QuestEditor />}
      {section === 'bestiary' && <BestiaryEditor />}
      {section === 'spells' && <SpellEditor />}
      {section === 'talents' && <TalentEditor />}
      {section === 'themes' && <ThemeEditor />}

      {section === 'roster' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {([1, 2, 3] as PlayerId[]).map((pid) => {
            const prof = charactersById[pid];
            if (!prof) return null;
            return (
              <CharacterRosterCard
                key={pid}
                profile={prof}
                onSave={handleSaveCharacterSettings}
                onInspectSheet={() => {
                  setDmSelectedPlayerId(pid);
                  setActiveTab('character');
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const CharacterRosterCard: React.FC<{
  profile: CharacterProfile;
  onSave: (next: CharacterProfile) => Promise<void>;
  onInspectSheet: () => void;
}> = ({ profile, onSave, onInspectSheet }) => {
  const [draft, setDraft] = useState<CharacterProfile>({ ...profile });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateDraft = (patch: Partial<CharacterProfile>) => {
    setDirty(true);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (!dirty && !saving) {
      setDraft({ ...profile });
    }
  }, [profile, dirty, saving]);

  return (
    <div className="glass-panel hud-cut p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="font-medium text-base text-text">
          Игрок {profile.playerId}
        </div>
        <button
          type="button"
          onClick={onInspectSheet}
          className="h-8 px-2.5 bg-bg border border-border text-xs text-secondary hover:text-text inline-flex items-center gap-1.5 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-muted" strokeWidth={1.5} />
          <span>Открыть лист</span>
        </button>
      </div>

      <div>
        <label className="block text-xs text-secondary mb-1.5">Имя персонажа</label>
        <input
          value={draft.characterName}
          onChange={(e) => updateDraft({ characterName: e.target.value })}
          className="anime-input w-full h-9 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-secondary mb-1.5">Класс</label>
          <input
            list={`dm-class-list-${profile.playerId}`}
            value={draft.charClass}
            onChange={(e) => updateDraft({ charClass: e.target.value })}
            placeholder="Волшебник, Магус…"
            className="anime-input w-full h-9 text-sm"
          />
          <datalist id={`dm-class-list-${profile.playerId}`}>
            {Object.entries(DND_OFFICIAL_CLASS_LABELS_RU).map(([en, ru]) => (
              <option key={en} value={en}>
                {ru}
              </option>
            ))}
            {DND_HOMEBREW_CLASSES_META.map((hb) => (
              <option key={hb.key} value={hb.key}>
                {hb.labelRu} ({hb.source})
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-secondary mb-1.5">Уровень</label>
          <input
            type="number"
            min={0}
            max={20}
            value={draft.level}
            onChange={(e) => updateDraft({ level: Number(e.target.value) })}
            className="anime-input w-full h-9 text-sm font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-secondary mb-1.5">Раса / вид</label>
          <input
            value={draft.race}
            onChange={(e) => updateDraft({ race: e.target.value })}
            className="anime-input w-full h-9 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-secondary mb-1.5">Макс. заклинаний</label>
          <input
            type="number"
            min={0}
            value={draft.maxSpells}
            onChange={(e) => updateDraft({ maxSpells: Number(e.target.value) })}
            className="anime-input w-full h-9 text-sm font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-secondary mb-1.5">Подкласс</label>
        <input
          list={`dm-subclass-list-${profile.playerId}`}
          value={draft.subclass}
          onChange={(e) => updateDraft({ subclass: e.target.value })}
          placeholder="Школа прорицания…"
          className="anime-input w-full h-9 text-xs"
        />
        {(() => {
          const normCls = normalizeDndClass(draft.charClass);
          const hbMeta = normCls ? DND_HOMEBREW_CLASS_BY_KEY[normCls] : undefined;
          if (!hbMeta || hbMeta.archetypes.length === 0) return null;
          return (
            <datalist id={`dm-subclass-list-${profile.playerId}`}>
              {hbMeta.archetypes.map((arch) => (
                <option key={arch} value={arch} />
              ))}
            </datalist>
          );
        })()}
      </div>

      <label className="flex items-start gap-2.5 p-3 bg-bg border border-border cursor-pointer hover:border-text/20 transition-colors">
        <input
          type="checkbox"
          checked={Boolean(draft.allowOffClassSpells)}
          onChange={(e) => updateDraft({ allowOffClassSpells: e.target.checked })}
          className="mt-0.5"
        />
        <span className="text-xs leading-snug">
          <span className="font-medium text-text block">
            Разрешить заклинания вне класса
          </span>
          <span className="text-xs text-muted mt-0.5 block">
            Позволяет игроку изучать заклинания любых классов (Тайные знания, черты, мультикласс)
          </span>
        </span>
      </label>

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({ ...profile, ...draft });
            setDirty(false);
          } finally {
            setSaving(false);
          }
        }}
        className="anime-btn-primary w-full h-9 text-xs inline-flex items-center justify-center gap-1.5"
      >
        <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
        <span>{saving ? 'Сохранение…' : dirty ? 'Сохранить изменения' : 'Сохранить профиль'}</span>
      </button>
    </div>
  );
};
