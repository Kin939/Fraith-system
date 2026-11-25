import React, { useCallback, useEffect, useState } from 'react';
import { Coins, FileText, Heart, Save, Shield } from 'lucide-react';
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
    async (lssJson: unknown) => {
      await syncLssData({ lssJson });
    },
    [syncLssData]
  );

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
      message: 'Кэш персонажа в D1 обновлён.',
      variant: 'success',
    });
  };

  if (!profile) {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted">
        Загрузка данных персонажа...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isDm && <PlayerSwitcher />}

      {/* Character Hero Banner */}
      <div className="glass-panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">
              Игрок #{profile.playerId}
            </span>
            <span className="text-xs text-accent font-semibold">
              {profile.race} • {DND_CLASS_LABELS_RU[profile.charClass] || profile.charClass}{' '}
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
              <div className="text-muted">Хиты (кэш LSS)</div>
              <div className="font-anime font-extrabold text-sm">
                {profile.hpCurrent} / {profile.hpMax}
                {profile.hpTemp > 0 ? ` (+${profile.hpTemp})` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Character Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Live LSS Embedded Sheet */}
        <div className="xl:col-span-7">
          <LssSheetEmbed
            playerId={activePlayerId}
            profile={profile}
            isReadOnlyViewer={Boolean(isDm)}
            onSyncJson={handleSyncJson}
            onSyncHealth={handleSyncHealth}
            onRefreshCache={refreshNow}
            syncing={syncing}
          />
        </div>

        {/* Right: Coins & Notes (LSS JSON Cache), Learned Spells, Personal Journal */}
        <div className="xl:col-span-5 space-y-5">
          {/* Money & Notes from LSS JSON Cache */}
          <div className="glass-panel rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="font-anime font-bold text-base">Деньги и заметки (LSS JSON кэш)</h3>
              </div>

              {!isDm && (
                <button
                  type="button"
                  onClick={() => setEditingCoinsAndNotes((v) => !v)}
                  className="text-xs text-accent hover:underline"
                >
                  {editingCoinsAndNotes ? 'Отмена' : 'Резервное ред.'}
                </button>
              )}
            </div>

            {/* 5e Coin Purse */}
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

            {/* LSS Notes */}
            <div className="space-y-1.5">
              <div className="text-xs text-muted flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Заметки из листа Long Story Short:</span>
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
                    Сохранить резервные поля
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-bg/50 border border-border/70 text-xs text-text/90 leading-relaxed whitespace-pre-line">
                  {profile.lssNotes ||
                    'Нет импортированных заметок. Нажмите «Импорт JSON LSS», чтобы подтянуть данные из схемы Long Story Short.'}
                </div>
              )}
            </div>
          </div>

          {/* Learned Spells Read-Only List from Tab 4 */}
          <LearnedSpells learnedSpells={learnedSpells} maxSpells={profile.maxSpells} />

          {/* Personal Editable Journal */}
          <JournalEditor
            playerId={activePlayerId}
            journal={journal}
            readOnly={Boolean(isDm)}
          />
        </div>
      </div>
    </div>
  );
};
