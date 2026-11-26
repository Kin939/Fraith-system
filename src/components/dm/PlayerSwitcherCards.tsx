import React, { useMemo } from 'react';
import { formatCharacterClassesRu } from '../../lib/lss';
import { getHudAssetUrl, type HudAssetKey } from '../../lib/hudIcons';
import { playerIdToThemeSlot } from '../../lib/theme';
import { useCampaignStore } from '../../lib/store';
import type { CharacterProfile, PlayerId } from '../../lib/types';

function extractLssAvatar(rawLssJson?: string | null): string | null {
  if (!rawLssJson) return null;
  try {
    const root = JSON.parse(rawLssJson) as Record<string, unknown>;
    const sheet =
      typeof root.data === 'string'
        ? (JSON.parse(root.data) as Record<string, unknown>)
        : root;
    const av = sheet.avatar as Record<string, unknown> | undefined;
    if (av && typeof av === 'object') {
      const url = av.webp || av.jpeg;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
  } catch {
    // Ignore malformed JSON preview
  }
  return null;
}

const SLOT_CRESTS: Record<PlayerId, { asset: HudAssetKey; codename: string }> = {
  1: { asset: 'blades', codename: 'UNIT // 01' },
  2: { asset: 'orb', codename: 'UNIT // 02' },
  3: { asset: 'dragon', codename: 'UNIT // 03' },
};

export interface PlayerSwitcherCardsProps {
  selectedPlayerId: PlayerId;
  onSelectPlayerId: (pid: PlayerId) => void;
  charactersById: Partial<Record<PlayerId, CharacterProfile>>;
}

export const PlayerSwitcherCards: React.FC<PlayerSwitcherCardsProps> = ({
  selectedPlayerId,
  onSelectPlayerId,
  charactersById,
}) => {
  const onlineUsers = useCampaignStore((s) => s.onlineUsers);
  const playerIds: PlayerId[] = [1, 2, 3];

  const avatarsByPid = useMemo(() => {
    return {
      1: extractLssAvatar(charactersById[1]?.rawLssJson),
      2: extractLssAvatar(charactersById[2]?.rawLssJson),
      3: extractLssAvatar(charactersById[3]?.rawLssJson),
    };
  }, [
    charactersById[1]?.rawLssJson,
    charactersById[2]?.rawLssJson,
    charactersById[3]?.rawLssJson,
  ]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-primary shadow-[0_0_8px_var(--primary)]" />
          <span>CHARACTER SELECT // DM TACTICAL OVERRIDE</span>
        </div>
        <span className="font-mono text-[10px] text-muted hidden sm:inline">
          RIM-SYNC: USER_THEMES [P1 · P2 · P3]
        </span>
      </div>

      {/* Horizontal scroll on mobile -> 3-column Character Select grid on md+ */}
      <div className="flex md:grid md:grid-cols-3 gap-3.5 overflow-x-auto pb-1 snap-x snap-mandatory">
        {playerIds.map((pid) => {
          const char = charactersById[pid];
          const active = selectedPlayerId === pid;
          const slotAttr = playerIdToThemeSlot(pid);
          const avatarUrl = avatarsByPid[pid];
          const crest = SLOT_CRESTS[pid];
          const isOnline = onlineUsers.some((u) => u.playerId === pid);

          const heroName = char?.characterName?.trim() || `ИГРОК 0${pid}`;
          const heroClass =
            (char?.charClass && formatCharacterClassesRu(char.charClass)) ||
            char?.charClass ||
            'КЛАСС НЕ НАЗНАЧЕН';
          const level = char?.level ?? 0;
          const hpCur = char?.hpCurrent ?? 0;
          const hpMax = Math.max(1, char?.hpMax ?? 0);
          const hpPct = char?.hpMax ? Math.min(100, Math.max(0, Math.round((hpCur / hpMax) * 100))) : 0;

          return (
            <button
              key={pid}
              type="button"
              data-theme-user={slotAttr}
              onClick={() => onSelectPlayerId(pid)}
              className={`snap-start min-w-[265px] md:min-w-0 w-full text-left relative overflow-hidden hud-cut hud-corners p-3.5 transition-all duration-200 border ${
                active
                  ? 'bg-[#0F172A]/92 opacity-100 border-primary shadow-[0_0_0_1px_var(--primary),0_0_24px_-6px_var(--primary)]'
                  : 'bg-[#0F172A]/75 opacity-60 hover:opacity-85 border-primary/35 shadow-none'
              }`}
            >
              {/* Subtle Rim Backlight Gradient when Active */}
              {active && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{
                    background:
                      'linear-gradient(125deg, var(--primary) 0%, transparent 55%)',
                  }}
                />
              )}

              <div className="relative z-10 flex items-stretch gap-3.5">
                {/* Anime Operator Silhouette / Avatar Frame */}
                <div
                  className={`w-16 h-20 shrink-0 relative overflow-hidden bg-[#070B14] border ${
                    active ? 'border-primary shadow-[0_0_16px_-4px_var(--primary)]' : 'border-primary/35'
                  }`}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={heroName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-center">
                      {/* Operator Rim-Lit Silhouette Vector + Generated Emblem */}
                      <svg
                        viewBox="0 0 80 100"
                        className="absolute inset-0 w-full h-full"
                        aria-hidden="true"
                      >
                        <path
                          d="M40 14 C49 14 54 21 53 31 C52 38 48 43 46 46 L66 56 L72 98 L8 98 L14 56 L34 46 C32 43 28 38 27 31 C26 21 31 14 40 14 Z"
                          fill="#0B1220"
                          stroke="var(--primary)"
                          strokeWidth="1.6"
                          strokeOpacity={active ? '0.95' : '0.5'}
                        />
                      </svg>
                      <img
                        src={getHudAssetUrl(crest.asset)}
                        alt=""
                        draggable={false}
                        className="relative z-10 w-9 h-9 object-cover mix-blend-lighten opacity-90 mt-5"
                      />
                    </div>
                  )}

                  <div className="absolute top-0 left-0 px-1 py-0.2 bg-[#070B14]/90 border-b border-r border-primary/40 font-mono text-[9px] font-bold text-primary">
                    P0{pid}
                  </div>
                </div>

                {/* Operator Identity & Telemetry */}
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">
                        {crest.codename}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#070B14]/90 border border-primary/45 text-text tabular-nums">
                        LVL {level}
                      </span>
                    </div>

                    <div className="font-anime font-extrabold text-base uppercase tracking-wide text-text truncate mt-0.5">
                      {heroName}
                    </div>

                    <div className="text-xs text-muted truncate">{heroClass}</div>
                  </div>

                  {/* Tactical HP / Status Strip */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
                      <span className="text-muted flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 ${
                            isOnline
                              ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                              : 'bg-slate-600'
                          }`}
                        />
                        {active ? 'SELECTED' : 'STANDBY'}
                      </span>
                      <span className="text-text">
                        {char?.hpMax ? `HP ${hpCur}/${ char.hpMax }` : 'NO SYNC'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-[#070B14] border border-primary/25 overflow-hidden">
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${hpPct}%`,
                          backgroundColor: 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
