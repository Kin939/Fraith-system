import React, { useMemo, useState } from 'react';
import { Crown, EyeOff, Network, Plus, Search, Share2 } from 'lucide-react';
import { NpcCard } from '../components/connections/NpcCard';
import { NpcEditor } from '../components/connections/NpcEditor';
import { apiFetch } from '../lib/api';
import { NPC_ATTITUDE_META, NPC_ATTITUDE_OPTIONS } from '../lib/npc';
import { useCampaignStore } from '../lib/store';
import type { CampaignNpc, NpcAttitude } from '../lib/types';

type AttitudeFilter = 'all' | NpcAttitude;
type RevealFilter = 'all' | 'revealed' | 'hidden';

export const ConnectionsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const npcs = useCampaignStore((s) => s.npcs);
  const setNpcs = useCampaignStore((s) => s.setNpcs);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const isDm = user?.role === 'dm';

  const [query, setQuery] = useState('');
  const [attitudeFilter, setAttitudeFilter] = useState<AttitudeFilter>('all');
  const [revealFilter, setRevealFilter] = useState<RevealFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorNpc, setEditorNpc] = useState<CampaignNpc | null>(null);

  const revealedCount = useMemo(() => npcs.filter((n) => n.isRevealed).length, [npcs]);
  const hiddenCount = npcs.length - revealedCount;

  const visibleNpcs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return npcs.filter((npc) => {
      if (isDm) {
        if (revealFilter === 'revealed' && !npc.isRevealed) return false;
        if (revealFilter === 'hidden' && npc.isRevealed) return false;
      }
      if (attitudeFilter !== 'all' && npc.attitude !== attitudeFilter) return false;
      if (!q) return true;
      return [npc.name, npc.role, npc.faction, npc.location, npc.description]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [npcs, query, attitudeFilter, revealFilter, isDm]);

  const openCreate = () => {
    setEditorNpc(null);
    setEditorOpen(true);
  };

  const handleToggleReveal = async (npc: CampaignNpc) => {
    try {
      const res = await apiFetch<{ npcs: CampaignNpc[] }>(`/api/dm/npcs/${npc.id}/reveal`, {
        method: 'PATCH',
        body: JSON.stringify({ isRevealed: !npc.isRevealed }),
      });
      setNpcs(res.npcs);
      pushToast({
        title: npc.isRevealed ? 'NPC скрыт от игроков' : 'NPC открыт игрокам',
        message: npc.isRevealed
          ? `«${npc.name}» снова виден только мастеру`
          : `«${npc.name}» появился во вкладке «Связи» у всех участников`,
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось изменить видимость',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    }
  };

  const handleDelete = async (npc: CampaignNpc) => {
    if (!window.confirm(`Удалить связь «${npc.name}»? Это действие нельзя отменить.`)) return;
    try {
      const res = await apiFetch<{ npcs: CampaignNpc[] }>(`/api/dm/npcs/${npc.id}`, {
        method: 'DELETE',
      });
      setNpcs(res.npcs);
      pushToast({
        title: 'Связь удалена',
        message: npc.name,
        variant: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось удалить NPC',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-medium text-2xl text-text">Связи</h1>
            <span className="font-mono text-xs text-muted tabular-nums">
              {isDm ? `Открыто ${revealedCount} из ${npcs.length}` : `${npcs.length} контактов`}
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            NPC, союзники и противники, с которыми отряд связан по ходу кампании
          </p>
        </div>

        {isDm && (
          <button
            type="button"
            onClick={openCreate}
            className="anime-btn-primary h-10 px-4 text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={1.6} />
            <span>Добавить NPC</span>
          </button>
        )}
      </div>

      {/* DM hint about the reveal workflow */}
      {isDm && (
        <div className="glass-panel hud-cut p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-secondary">
          <span className="inline-flex items-center gap-2 text-text">
            <Crown className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span>Только вы видите скрытых NPC и их тайные заметки</span>
          </span>
          <span className="inline-flex items-center gap-2 text-muted">
            <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Скрыто сейчас: {hiddenCount}</span>
          </span>
          <span className="inline-flex items-center gap-2 text-muted">
            <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Игроки не увидят контакт, пока вы не откроете его</span>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, фракции, месту…"
            className="anime-input w-full h-9 pl-8 text-xs"
          />
        </div>

        <div className="inline-flex items-center flex-wrap bg-surface border border-border p-1 gap-1">
          <button
            type="button"
            onClick={() => setAttitudeFilter('all')}
            className={`h-7 px-2.5 text-[11px] transition-colors ${
              attitudeFilter === 'all'
                ? 'bg-raised text-text font-medium'
                : 'text-secondary hover:text-text'
            }`}
          >
            Все
          </button>
          {NPC_ATTITUDE_OPTIONS.map((option) => {
            const meta = NPC_ATTITUDE_META[option];
            const active = attitudeFilter === option;
            const count = npcs.filter((n) => n.attitude === option).length;
            if (count === 0 && !active) return null;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setAttitudeFilter(option)}
                className={`h-7 px-2 text-[11px] inline-flex items-center gap-1.5 transition-colors ${
                  active ? 'bg-raised font-medium' : 'hover:text-text'
                }`}
                style={{ color: active ? meta.color : undefined }}
                title={meta.hint}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className={active ? '' : 'text-secondary'}>{meta.label}</span>
                <span className="font-mono tabular-nums text-muted">{count}</span>
              </button>
            );
          })}
        </div>

        {isDm && (
          <div className="inline-flex items-center bg-surface border border-border p-1 gap-1">
            {(
              [
                { id: 'all', label: 'Все' },
                { id: 'revealed', label: 'Открытые' },
                { id: 'hidden', label: 'Скрытые' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRevealFilter(f.id)}
                className={`h-7 px-2.5 text-[11px] transition-colors ${
                  revealFilter === f.id
                    ? 'bg-raised text-text font-medium'
                    : 'text-secondary hover:text-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {visibleNpcs.length === 0 ? (
        <div className="glass-panel hud-cut p-8 text-center space-y-3">
          <Network className="w-5 h-5 text-muted mx-auto" strokeWidth={1.5} />
          <div className="text-sm text-text">
            {npcs.length === 0
              ? isDm
                ? 'Связей пока нет — создайте первого NPC'
                : 'Мастер ещё не открыл ни одной связи'
              : 'По этому фильтру никто не найден'}
          </div>
          <p className="text-xs text-muted">
            {isDm
              ? 'Новый контакт появляется скрытым: заполните описание и откройте его игрокам, когда придёт время.'
              : 'Как только мастер раскроет NPC, он появится здесь.'}
          </p>
          {isDm && npcs.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="anime-btn-primary h-9 px-4 text-xs inline-flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span>Создать NPC</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {visibleNpcs.map((npc) => (
            <NpcCard
              key={npc.id}
              npc={npc}
              isDm={Boolean(isDm)}
              onEdit={(target) => {
                setEditorNpc(target);
                setEditorOpen(true);
              }}
              onToggleReveal={(target) => void handleToggleReveal(target)}
              onDelete={(target) => void handleDelete(target)}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <NpcEditor
          npc={editorNpc}
          onClose={() => {
            setEditorOpen(false);
            setEditorNpc(null);
          }}
        />
      )}
    </div>
  );
};
