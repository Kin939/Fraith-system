import React, { useCallback, useEffect, useState } from 'react';
import { Coins, FileJson, FileText, Heart, RotateCcw, Save, Shield, Upload } from 'lucide-react';
import { JournalEditor } from '../components/character/JournalEditor';
import { LearnedSpells } from '../components/character/LearnedSpells';
import { LssSheetEmbed } from '../components/character/LssSheetEmbed';
import { PlayerSwitcher } from '../components/dm/PlayerSwitcher';
import { useLssSync } from '../hooks/useLssSync';
import { DND_CLASS_LABELS_RU } from '../lib/lss';
import { useCampaignStore } from '../lib/store';
import type { CharacterCoins, PlayerId } from '../lib/types';

export const CharacterPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const dmSelectedPlayerId = useCampaignStore((s) => s.dmSelectedPlayerId);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const isDm = user?.role === 'dm';
  const activePlayerId: PlayerId = isDm ? dmSelectedPlayerId : (user?.playerId ?? 1);

  const { profile, journal, learnedSpells, syncing, refreshNow, syncLssData } =
    useLssSync(activePlayerId);

  const [editingCoinsAndNotes, setEditingCoinsAndNotes] = useState(false);
  const [openImportCounter, setOpenImportCounter] = useState(0);
  const [coinsDraft, setCoinsDraft] = useState<CharacterCoins>({
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
  });
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    if (profile) {
      setCoinsDraft({ ...profile.coins });
      setNotesDraft(profile.lssNotes);
      setEditingCoinsAndNotes(false);
    }
  }, [profile]);

  const handleSyncJson = useCallback(
    async (lssJson: unknown, lssEmbedUrl?: string) => {
      const payload: Record<string, unknown> = {};
      if (lssJson !== null && lssJson !== undefined) payload.lssJson = lssJson;
      if (lssEmbedUrl) payload.lssEmbedUrl = lssEmbedUrl;
      await syncLssData(payload);
    },
    [syncLssData]
  );

  const handleQuickFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      await syncLssData({ lssJson: parsed });
      pushToast({
        title: 'Чарник успешно загружен',
        message: `Файл «${file.name}» импортирован и сохранён за слотом Игрока #${activePlayerId}.`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Ошибка чтения .json файла',
        message: err instanceof Error ? err.message : 'Проверьте экспорт из Long Story Short',
        variant: 'error',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleResetSlot = async () => {
    if (!window.confirm('Очистить данные персонажа в этом слоте (включая изученные заклинания)?')) {
      return;
    }
    await syncLssData({ reset: true });
    pushToast({
      title: 'Слот персонажа очищен',
      message: 'Теперь можно загрузить новый чарник из Long Story Short.',
      variant: 'info',
    });
  };

  const handleSyncHealth = useCallback(
    async (hp: { hpCurrent: number; hpMax: number; hpTemp: number }) => {
      await syncLssData(hp);
    },
    [syncLssData]
  );

  const handleSaveFallbackCoinsNotes = async () => {
    await syncLssData({
      coins: coinsDraft,
      lssNotes: notesDraft,
    });
    setEditingCoinsAndNotes(false);
    pushToast({
      title: 'Монеты и заметки сохранены',
      message: 'Данные персонажа в D1 обновлены.',
      variant: 'success',
    });
  };

  if (!profile) {
    return (
      <div className="space-y-5">
        {isDm && <PlayerSwitcher />}
        <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted">
          Загрузка слота Игрока #{activePlayerId}...
        </div>
      </div>
    );
  }

  const hasCharacter = Boolean(profile.characterName.trim());

  return (
    <div className="space-y-5">
      {isDm && <PlayerSwitcher />}

      {/* Character Hero Banner OR Empty Slot Upload Prompt */}
      {!hasCharacter ? (
        <div className="glass-panel neon-border rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">
                Игрок #{profile.playerId} • Слот пуст
              </span>
            </div>
            <h1 className="font-anime font-extrabold text-xl sm:text-2xl">
              Персонаж ещё не загружен
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {isDm
                ? 'Игрок ещё не загрузил свой чарник из Long Story Short. Вы можете загрузить .json за него или заполнить профиль во вкладке Мастера.'
                : 'Загрузите экспортированный .json файл своего персонажа из Long Story Short, чтобы автоматически подтянуть имя, класс, уровень, хиты, монеты и открыть изучение заклинаний.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <label className="anime-btn-primary px-4 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Загрузить чарник (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleQuickFileSelect}
                className="hidden"
              />
            </label>

            {!isDm && (
              <button
                type="button"
                onClick={() => setOpenImportCounter((c) => c + 1)}
                className="px-3.5 py-2.5 rounded-xl border border-border bg-bg/70 hover:border-accent text-xs font-medium inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
              >
                <FileJson className="w-4 h-4 text-accent" />
                <span>Вставить JSON / ссылку LSS</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">
                Игрок #{profile.playerId}
              </span>
              <span className="text-xs text-accent font-semibold">
                {[
                  profile.race,
                  DND_CLASS_LABELS_RU[profile.charClass] || profile.charClass,
                ]
                  .filter(Boolean)
                  .join(' • ')}{' '}
                {profile.subclass ? `(${profile.subclass})` : ''}
              </span>
            </div>
            <h1 className="font-anime font-extrabold text-2xl">{profile.characterName}</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 rounded-2xl bg-bg/70 border border-border flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <div className="text-xs">
                <div className="text-muted">Уровень</div>
                <div className="font-anime font-extrabold text-sm">{profile.level}</div>
              </div>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-bg/70 border border-border flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <div className="text-xs">
                <div className="text-muted">Хиты (LSS)</div>
                <div className="font-anime font-extrabold text-sm">
                  {profile.hpCurrent} / {profile.hpMax}
                  {profile.hpTemp > 0 ? ` (+${profile.hpTemp})` : ''}
                </div>
              </div>
            </div>

            <label
              className="px-3 py-2 rounded-2xl bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Обновить данные персонажа из свежего .json файла Long Story Short"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Обновить .json</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleQuickFileSelect}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleResetSlot}
              className="p-2 rounded-xl border border-border text-muted hover:text-rose-300 hover:border-rose-500/40 transition-colors"
              title="Очистить слот персонажа"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Character Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <LssSheetEmbed
            key={`lss-embed-${activePlayerId}`}
            playerId={activePlayerId}
            profile={profile}
            isReadOnlyViewer={Boolean(isDm)}
            onSyncJson={handleSyncJson}
            onSyncHealth={handleSyncHealth}
            onRefreshCache={refreshNow}
            syncing={syncing}
            externalOpenImport={openImportCounter}
          />
        </div>

        <div className="xl:col-span-5 space-y-5">
          <div className="glass-panel rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="font-anime font-bold text-base">Деньги и заметки (LSS)</h3>
              </div>

              {!isDm && (
                <button
                  type="button"
                  onClick={() => setEditingCoinsAndNotes((v) => !v)}
                  className="text-xs text-accent hover:underline"
                >
                  {editingCoinsAndNotes ? 'Отмена' : 'Редактировать'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              {(
                [
                  { key: 'pp', label: 'ПМ', color: 'text-cyan-300' },
                  { key: 'gp', label: 'ЗМ', color: 'text-amber-300' },
                  { key: 'ep', label: 'ЭМ', color: 'text-indigo-300' },
                  { key: 'sp', label: 'СМ', color: 'text-slate-200' },
                  { key: 'cp', label: 'ММ', color: 'text-orange-300' },
                ] as const
              ).map(({ key, label, color }) => (
                <div key={key} className="p-2.5 rounded-2xl bg-bg/65 border border-border">
                  <div className={`text-[10px] font-bold ${color}`}>{label}</div>
                  {editingCoinsAndNotes && !isDm ? (
                    <input
                      type="number"
                      min={0}
                      value={coinsDraft[key]}
                      onChange={(e) =>
                        setCoinsDraft({ ...coinsDraft, [key]: Number(e.target.value) })
                      }
                      className="w-full bg-transparent text-center font-anime font-bold text-sm mt-1 focus:outline-none border-b border-primary"
                    />
                  ) : (
                    <div className="font-anime font-extrabold text-sm mt-0.5">
                      {profile.coins[key]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Заметки из чарника Long Story Short:</span>
              </div>

              {editingCoinsAndNotes && !isDm ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="anime-input w-full text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSaveFallbackCoinsNotes}
                    className="anime-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Сохранить
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-bg/50 border border-border/70 text-xs text-text/90 leading-relaxed whitespace-pre-line">
                  {profile.lssNotes || 'Нет импортированных заметок.'}
                </div>
              )}
            </div>
          </div>

          <LearnedSpells learnedSpells={learnedSpells} maxSpells={profile.maxSpells} />

          <JournalEditor
            key={`journal-${activePlayerId}`}
            playerId={activePlayerId}
            journal={journal}
            readOnly={Boolean(isDm)}
          />
        </div>
      </div>
    </div>
  );
};
