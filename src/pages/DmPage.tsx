import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Crown,
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
      <div className="glass-panel rounded-3xl p-8 text-center text-rose-300 text-sm">
        Доступ к этой вкладке открыт исключительно для Мастера (роль dm).
      </div>
    );
  }

  const sections: Array<{ id: DmSection; label: string; icon: React.ReactNode }> = [
    { id: 'accounts', label: 'Пароли и доступы', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'quests', label: 'Квесты + R2', icon: <ScrollText className="w-4 h-4" /> },
    { id: 'bestiary', label: 'Бестиарий + CR', icon: <Skull className="w-4 h-4" /> },
    { id: 'spells', label: 'Заклинания / Homebrew', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'talents', label: 'Таланты и Вдохновения', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'roster', label: 'Герои и лимиты', icon: <Users className="w-4 h-4" /> },
    { id: 'themes', label: 'Темы аккаунтов', icon: <Palette className="w-4 h-4" /> },
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
        title: `Игрок #${profile.playerId} обновлён`,
        message: 'Класс, максимум заклинаний и ссылка LSS сохранены.',
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
    <div className="space-y-5">
      {/* DM Header */}
      <div className="glass-panel neon-border rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl anime-btn-primary flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-anime font-extrabold text-xl">Пульт Архитектора Кампании (DM)</h1>
            <p className="text-xs text-muted">
              Управление паролями игроков, квестами, бестиарием, заклинаниями, деревом талантов и темами аккаунтов
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {sections.map((sec) => {
          const active = section === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSection(sec.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? 'anime-btn-primary'
                  : 'glass-panel text-muted hover:text-text hover:border-primary/40'
              }`}
            >
              {sec.icon}
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Section */}
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({ ...profile });
  }, [profile]);

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-anime font-bold text-base text-primary">
          Игрок #{profile.playerId}
        </div>
        <button
          type="button"
          onClick={onInspectSheet}
          className="px-2.5 py-1 rounded-xl bg-bg/70 border border-border hover:border-primary/50 text-xs text-muted hover:text-text inline-flex items-center gap-1 transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>Открыть лист</span>
        </button>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Имя персонажа</label>
        <input
          value={draft.characterName}
          onChange={(e) => setDraft({ ...draft, characterName: e.target.value })}
          className="anime-input w-full text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">Класс (офиц. / HB dnd.su)</label>
          <input
            list={`dm-class-list-${profile.playerId}`}
            value={draft.charClass}
            onChange={(e) => setDraft({ ...draft, charClass: e.target.value })}
            placeholder="Волшебник / Магус / Шаман..."
            className="anime-input w-full text-sm"
          />
          <datalist id={`dm-class-list-${profile.playerId}`}>
            {Object.entries(DND_OFFICIAL_CLASS_LABELS_RU).map(([en, ru]) => (
              <option key={en} value={en}>
                {ru}
              </option>
            ))}
            {DND_HOMEBREW_CLASSES_META.map((hb) => (
              <option key={hb.key} value={hb.key}>
                {hb.labelRu} (HB • {hb.source})
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Уровень</label>
          <input
            type="number"
            min={0}
            max={20}
            value={draft.level}
            onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })}
            className="anime-input w-full text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">Раса</label>
          <input
            value={draft.race}
            onChange={(e) => setDraft({ ...draft, race: e.target.value })}
            className="anime-input w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Макс. заклинаний</label>
          <input
            type="number"
            min={0}
            value={draft.maxSpells}
            onChange={(e) => setDraft({ ...draft, maxSpells: Number(e.target.value) })}
            className="anime-input w-full text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Архетип / Подкласс</label>
        <input
          list={`dm-subclass-list-${profile.playerId}`}
          value={draft.subclass}
          onChange={(e) => setDraft({ ...draft, subclass: e.target.value })}
          placeholder="Орден Демиургов / Школа Прорицания..."
          className="anime-input w-full text-xs"
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

      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await onSave(draft);
          setSaving(false);
        }}
        className="anime-btn-primary w-full py-2 text-xs inline-flex items-center justify-center gap-1.5"
      >
        <Save className="w-3.5 h-3.5" />
        <span>{saving ? 'Сохранение...' : 'Сохранить профиль'}</span>
      </button>
    </div>
  );
};
