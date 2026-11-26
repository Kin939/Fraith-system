import React, { useMemo, useState } from 'react';
import { LayoutGrid, Network, Star } from 'lucide-react';
import { TileSizeControl } from '../components/common/TileSizeControl';
import { InspirationCounter } from '../components/talents/InspirationCounter';
import { TalentNodeModal } from '../components/talents/TalentEditor';
import { TalentDetail } from '../components/talents/TalentDetail';
import { TalentGrid } from '../components/talents/TalentGrid';
import { TalentTree } from '../components/talents/TalentTree';
import { patchTalentTile } from '../lib/api';
import { useCampaignStore } from '../lib/store';
import { tileNodePx, useTileSize } from '../lib/tileSize';
import type { TalentNode } from '../lib/types';

type TalentsView = 'tree' | 'grid';

export const TalentsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const inspirationPoints = useCampaignStore((s) => s.inspirationPoints);
  const nodes = useCampaignStore((s) => s.talentNodes);
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const isDm = user?.role === 'dm';
  const [view, setView] = useState<TalentsView>('tree');
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [tileSize] = useTileSize('talents');

  const [detailNode, setDetailNode] = useState<TalentNode | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TalentNode | null>(null);
  const [spawnPos, setSpawnPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });

  const nodeMap = useMemo(() => {
    const map = new Map<number, TalentNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const featuredCount = useMemo(
    () => nodes.filter((n) => n.tileStyle?.isImportant).length,
    [nodes]
  );

  const handleToggleFeatured = async (node: TalentNode) => {
    try {
      const res = await patchTalentTile(node.id, {
        isFeatured: !node.tileStyle?.isImportant,
      });
      setTalentsBundle(res);
      pushToast({
        title: node.tileStyle?.isImportant ? 'Метка снята' : 'Ключевой талант отмечен',
        message: node.title,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Не удалось обновить плитку таланта',
        message: err instanceof Error ? err.message : 'Попробуйте ещё раз',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-medium text-2xl text-text">Дерево талантов</h1>
          <p className="text-sm text-secondary mt-1">
            Общие навыки и усиления отряда, открываемые за вдохновение
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TileSizeControl scope="talents" />

          <button
            type="button"
            onClick={() => setOnlyFeatured((v) => !v)}
            className={`h-9 px-3 text-xs inline-flex items-center gap-1.5 border transition-colors ${
              onlyFeatured
                ? 'border-[#f59e0b]/70 text-[#f59e0b] bg-[#f59e0b]/10'
                : 'border-border text-secondary hover:text-text'
            }`}
            title="Подсветить только ключевые таланты"
          >
            <Star className="w-3.5 h-3.5" strokeWidth={1.7} fill={onlyFeatured ? 'currentColor' : 'none'} />
            <span>Ключевые{featuredCount > 0 ? ` · ${featuredCount}` : ''}</span>
          </button>

          <div className="inline-flex items-center bg-surface border border-border p-1 gap-1">
            {(
              [
                { id: 'tree', label: 'Дерево', icon: <Network className="w-3.5 h-3.5" strokeWidth={1.5} /> },
                { id: 'grid', label: 'Плитки', icon: <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} /> },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={view === option.id}
                className={`h-8 px-3 text-xs inline-flex items-center gap-1.5 transition-colors ${
                  view === option.id
                    ? 'bg-raised text-text font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-secondary hover:text-text'
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <InspirationCounter points={inspirationPoints} isDm={Boolean(isDm)} />

      {view === 'tree' ? (
        <TalentTree
          nodes={nodes}
          inspirationPoints={inspirationPoints}
          selectedEditorId={editingNode?.id ?? null}
          nodeSizePx={tileNodePx(tileSize)}
          onlyFeatured={onlyFeatured}
          onRequestCreateAt={
            isDm
              ? (x, y) => {
                  setEditingNode(null);
                  setSpawnPos({ x, y });
                  setModalOpen(true);
                }
              : undefined
          }
          onRequestEditNode={
            isDm
              ? (node) => {
                  setEditingNode(node);
                  setModalOpen(true);
                }
              : undefined
          }
          onToggleFeatured={isDm ? (node) => void handleToggleFeatured(node) : undefined}
        />
      ) : (
        <TalentGrid
          nodes={nodes}
          nodeMap={nodeMap}
          size={tileSize}
          onlyFeatured={onlyFeatured}
          isDm={Boolean(isDm)}
          onSelect={(node) => setDetailNode(node)}
          onEditNode={
            isDm
              ? (node) => {
                  setEditingNode(node);
                  setModalOpen(true);
                }
              : undefined
          }
          onToggleFeatured={isDm ? (node) => void handleToggleFeatured(node) : undefined}
        />
      )}

      {view === 'grid' && (
        <TalentDetail
          node={detailNode ? (nodeMap.get(detailNode.id) ?? detailNode) : null}
          parentNode={
            detailNode?.parentId ? (nodeMap.get(detailNode.parentId) ?? null) : null
          }
          inspirationPoints={inspirationPoints}
          onClose={() => setDetailNode(null)}
          onEditNode={
            isDm
              ? (node) => {
                  setDetailNode(null);
                  setEditingNode(node);
                  setModalOpen(true);
                }
              : undefined
          }
        />
      )}

      {isDm && (
        <TalentNodeModal
          open={modalOpen}
          editingNode={editingNode}
          initialPos={spawnPos}
          allNodes={nodes}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};
