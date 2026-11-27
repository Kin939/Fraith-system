import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Landmark,
  Lock,
  MapPin,
  MessageSquare,
  Pencil,
  Trash2,
  UserRound,
} from 'lucide-react';
import { resolveImageUrl } from '../../lib/artwork';
import { EntityNotes } from '../common/EntityNotes';
import { npcInitials, resolveNpcAttitude } from '../../lib/npc';
import type { CampaignNpc } from '../../lib/types';

interface NpcCardProps {
  npc: CampaignNpc;
  isDm: boolean;
  onEdit?: (npc: CampaignNpc) => void;
  onToggleReveal?: (npc: CampaignNpc) => void;
  onDelete?: (npc: CampaignNpc) => void;
}

/**
 * Карточка «Связей». Портрет занимает почти всю плитку (широкая «обложка»),
 * а имя, отношение и кнопки мастера наложены поверх нижнего и верхнего края —
 * так изображение большое, но вся информация остаётся на месте.
 */
export const NpcCard: React.FC<NpcCardProps> = ({
  npc,
  isDm,
  onEdit,
  onToggleReveal,
  onDelete,
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const attitude = resolveNpcAttitude(npc.attitude);
  const portraitUrl = npc.imageKey ? resolveImageUrl(npc.imageKey, 'crown') : null;
  const hidden = !npc.isRevealed;

  return (
    <article
      className={`glass-panel hud-cut relative flex flex-col overflow-hidden transition-colors hover:border-primary/40 ${
        hidden ? 'border-dashed opacity-[0.94]' : ''
      }`}
    >
      {/* ---------------- Портрет: почти вся плитка ---------------- */}
      <div
        className="relative w-full aspect-[16/11] overflow-hidden"
        style={{
          backgroundColor: `${attitude.color}16`,
          boxShadow: hidden ? undefined : `inset 0 0 0 1px ${attitude.color}44`,
        }}
      >
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt={npc.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span
              className="font-mono text-4xl font-medium tracking-wide"
              style={{ color: attitude.color }}
            >
              {npcInitials(npc.name)}
            </span>
            <UserRound className="w-4 h-4 opacity-40" strokeWidth={1.25} style={{ color: attitude.color }} />
          </div>
        )}

        {/* Акцентная кромка отношения */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ backgroundColor: attitude.color, opacity: hidden ? 0.35 : 0.9 }}
        />

        {/* Затемнение снизу, чтобы имя читалось на любой картинке */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/55 to-transparent" />

        {/* Быстрые действия мастера поверх портрета */}
        {isDm && (
          <div className="absolute right-2 top-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(npc)}
              className="h-7 w-7 inline-flex items-center justify-center border border-white/15 bg-black/50 text-white/70 hover:text-white hover:border-white/40 transition-colors backdrop-blur-sm"
              title="Редактировать NPC"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(npc)}
              className="h-7 w-7 inline-flex items-center justify-center border border-white/15 bg-black/50 text-white/70 hover:text-negative hover:border-negative/50 transition-colors backdrop-blur-sm"
              title="Удалить NPC"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Имя, роль и отношение — на нижней кромке портрета */}
        <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-[15px] leading-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] truncate">
              {npc.name}
            </h3>
            {hidden && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-white/80 border border-white/25 bg-black/50 backdrop-blur-sm">
                <Lock className="w-2.5 h-2.5" strokeWidth={1.8} />
                <span>СКРЫТ</span>
              </span>
            )}
          </div>

          {npc.role && (
            <div className="text-[11px] text-white/70 truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {npc.role}
            </div>
          )}

          <span
            className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] border backdrop-blur-sm"
            style={{
              color: attitude.color,
              borderColor: `${attitude.color}66`,
              backgroundColor: `${attitude.color}1f`,
            }}
            title={attitude.hint}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: attitude.color }} />
            {attitude.label}
          </span>
        </div>
      </div>

      {/* ---------------- Информация под портретом ---------------- */}
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        {(npc.faction || npc.location) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            {npc.faction && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <Landmark className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{npc.faction}</span>
              </span>
            )}
            {npc.location && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{npc.location}</span>
              </span>
            )}
          </div>
        )}

        {npc.description ? (
          <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap line-clamp-4">
            {npc.description}
          </p>
        ) : (
          <p className="text-xs text-muted italic">
            {isDm ? 'Описание пока не заполнено' : 'Мастер ещё не раскрыл детали'}
          </p>
        )}

        {/* Заметки отряда */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowNotes((prev) => !prev)}
            className={`h-7 px-2 text-[11px] inline-flex items-center gap-1.5 border transition-colors ${
              showNotes
                ? 'border-primary/50 text-primary bg-primary/10'
                : 'border-border text-secondary hover:text-text hover:bg-raised'
            }`}
            title="Заметки отряда об этом NPC"
          >
            <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.6} />
            <span>Заметки</span>
            {npc.notesCount > 0 && (
              <span className="font-mono tabular-nums text-muted">· {npc.notesCount}</span>
            )}
          </button>

          {showNotes && (
            <div className="p-2.5 bg-bg border border-border">
              <EntityNotes kind="npc" entityId={npc.id} />
            </div>
          )}
        </div>

        {/* Секреты мастера */}
        {isDm && npc.secretNotes && (
          <div
            className="p-2.5 bg-bg border border-border border-l-2 space-y-1"
            style={{ borderLeftColor: '#f59e0b' }}
          >
            <div className="text-[10px] text-[#f59e0b] inline-flex items-center gap-1 uppercase tracking-wide">
              <Lock className="w-2.5 h-2.5" strokeWidth={1.8} />
              <span>Только для мастера</span>
            </div>
            <p className="text-[11px] text-secondary leading-relaxed whitespace-pre-wrap line-clamp-3">
              {npc.secretNotes}
            </p>
          </div>
        )}

        {/* Управление видимостью */}
        {isDm && (
          <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-border">
            <button
              type="button"
              onClick={() => onToggleReveal?.(npc)}
              className={`h-7 px-2 text-[11px] inline-flex items-center gap-1.5 border transition-colors ${
                npc.isRevealed
                  ? 'border-positive/40 text-positive hover:bg-positive/10'
                  : 'border-border text-secondary hover:text-text hover:bg-raised'
              }`}
              title={
                npc.isRevealed
                  ? 'Скрыть NPC от игроков'
                  : 'Открыть NPC игрокам — он появится во вкладке «Связи»'
              }
            >
              {npc.isRevealed ? (
                <Eye className="w-3.5 h-3.5" strokeWidth={1.6} />
              ) : (
                <EyeOff className="w-3.5 h-3.5" strokeWidth={1.6} />
              )}
              <span>{npc.isRevealed ? 'Открыт игрокам' : 'Открыть игрокам'}</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
};
