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

const SLOT_CRESTS: Record<PlayerId, HudAssetKey> = {
  1: 'blades',
  2: 'orb',
  3: 'dragon',
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">Герои отряда</span>
        <span className="text-xs text-muted hidden sm:inline">
          Выберите слот для просмотра и редактирования
        </span>
      </div>

      {/* Horizontal scroll on mobile -> 3-column Character Select grid on md+ */}
      <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto pb-1 snap-x snap-mandatory">
        {playerIds.map((pid) => {
          const char = charactersById[pid];
          const active = selectedPlayerId === pid;
          const slotAttr = playerIdToThemeSlot(pid);
          const avatarUrl = avatarsByPid[pid];
          const crest = SLOT_CRESTS[pid];
          const isOnline = onlineUsers.some((u) => u.playerId === pid);

          const heroName = char?.characterName?.trim() || `Игрок ${pid}`;
          const heroClass =
            (char?.charClass && formatCharacterClassesRu(char.charClass)) ||
            char?.charClass ||
            'Класс не выбран';
          const level = char?.level ?? 0;
          const hpCur = char?.hpCurrent ?? 0;
          const hpMax = Math.max(1, char?.hpMax ?? 0);
          const hpPct = char?.hpMax
            ? Math.min(100, Math.max(0, Math.round((hpCur / hpMax) * 100)))
            : 0;

          return (
            <button
              key={pid}
              type="button"
              data-theme-user={slotAttr}
              onClick={() => onSelectPlayerId(pid)}
              className={`snap-start min-w-[264px] md:min-w-0 w-full text-left relative overflow-hidden hud-cut p-4 transition-colors border ${
                active
                  ? 'rim-card--active'
                  : 'bg-surface border-border hover:bg-raised/60'
              }`}
            >
              <div className="flex items-stretch gap-4">
                {/* Operator Portrait / Silhouette */}
                <div
                  className={`w-16 h-20 shrink-0 relative overflow-hidden bg-deep border ${
                    active ? 'border-primary/60' : 'border-border'
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
                      <svg
                        viewBox="0 0 80 100"
                        className="absolute inset-0 w-full h-full"
                        aria-hidden="true"
                      >
                        <path
                          d="M40 14 C49 14 54 21 53 31 C52 38 48 43 46 46 L66 56 L72 98 L8 98 L14 56 L34 46 C32 43 28 38 27 31 C26 21 31 14 40 14 Z"
                          fill="#11141c"
                          stroke={active ? 'var(--primary)' : 'rgba(238,240,245,0.18)'}
                          strokeWidth="1.5"
                        />
                      </svg>
                      <img
                        src={getHudAssetUrl(crest)}
                        alt=""
                        draggable={false}
                        className="relative z-10 w-8 h-8 object-cover mix-blend-lighten opacity-75 mt-5"
                      />
                    </div>
                  )}
                </div>

                {/* Operator Identity & Stats */}
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-positive' : 'bg-muted/40'
                          }`}
                        />
                        <span>Игрок {pid}</span>
                      </span>
                      <span className="hud-keycap">
                        Ур. {level}
                      </span>
                    </div>

                    <div className="font-medium text-base text-text truncate mt-1">
                      {heroName}
                    </div>

                    <div className="text-xs text-secondary truncate">{heroClass}</div>
                  </div>

                  {/* HP Bar */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                      <span className="text-muted">Хиты</span>
                      <span className="text-secondary">
                        {char?.hpMax ? `${hpCur} / ${char.hpMax}` : '—'}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-deep overflow-hidden">
                      <div
                        className="h-full transition-colors"
                        style={{
                          width: `${hpPct}%`,
                          backgroundColor: active ? 'var(--primary)' : '#4cc38a',
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
