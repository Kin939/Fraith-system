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
      className={`glass-panel hud-cut relative flex flex-col gap-3 p-4 transition-colors ${
        hidden ? 'border-dashed opacity-[0.92]' : ''
      }`}
      style={{
        boxShadow: hidden ? undefined : `inset 2px 0 0 0 ${attitude.color}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="relative w-12 h-12 shrink-0 overflow-hidden hud-cut-sm border"
          style={{ borderColor: `${attitude.color}66`, backgroundColor: `${attitude.color}14` }}
        >
          {portraitUrl ? (
            <img src={portraitUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-mono text-sm font-medium"
              style={{ color: attitude.color }}
            >
              {npcInitials(npc.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm text-text leading-snug truncate">{npc.name}</h3>
            {hidden && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted border border-border bg-bg">
                <Lock className="w-2.5 h-2.5" strokeWidth={1.8} />
                <span>СКРЫТ</span>
              </span>
            )}
          </div>

          {npc.role && <div className="text-xs text-secondary truncate mt-0.5">{npc.role}</div>}

          <span
            className="mt-1.5 inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] border"
            style={{
              color: attitude.color,
              borderColor: `${attitude.color}55`,
              backgroundColor: `${attitude.color}12`,
            }}
            title={attitude.hint}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: attitude.color }}
            />
            {attitude.label}
          </span>
        </div>
      </div>

      {/* Meta */}
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

      {/* Public description */}
      {npc.description ? (
        <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap line-clamp-5">
          {npc.description}
        </p>
      ) : (
        <p className="text-xs text-muted italic">Описание пока не заполнено</p>
      )}

      {/* Party notes, attributed to the character (or DM) who wrote them */}
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

      {/* DM-only intel */}
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

      {/* DM controls */}
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

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(npc)}
              className="h-7 w-7 inline-flex items-center justify-center text-muted hover:text-text transition-colors"
              title="Редактировать NPC"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(npc)}
              className="h-7 w-7 inline-flex items-center justify-center text-muted hover:text-negative transition-colors"
              title="Удалить NPC"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {!isDm && !npc.description && (
        <div className="text-[11px] text-muted inline-flex items-center gap-1">
          <UserRound className="w-3 h-3" strokeWidth={1.5} />
          <span>Мастер ещё не раскрыл детали</span>
        </div>
      )}
    </article>
  );
};
