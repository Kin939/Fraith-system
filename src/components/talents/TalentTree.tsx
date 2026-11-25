import React, { useMemo, useState } from 'react';
import { useCampaignStore } from '../../lib/store';
import type { PlayerId, PurchasedTalent, TalentNode as TalentNodeModel } from '../../lib/types';
import { TalentDetail } from './TalentDetail';
import { TalentNode } from './TalentNode';

interface TalentTreeProps {
  nodes: TalentNodeModel[];
  purchases: PurchasedTalent[];
  inspirationPoints: number;
}

const CELL_W = 216;
const CELL_H = 216;
const NODE_SIZE = 176; // 44 * 4px (w-44)

export const TalentTree: React.FC<TalentTreeProps> = ({
  nodes,
  purchases,
  inspirationPoints,
}) => {
  const user = useCampaignStore((s) => s.user);
  const [selectedNode, setSelectedNode] = useState<TalentNodeModel | null>(null);

  const currentPlayerId: PlayerId | null =
    user?.role === 'player' ? user.playerId : null;

  const { maxCol, maxRow, nodeMap } = useMemo(() => {
    let mc = 2;
    let mr = 2;
    const map = new Map<number, TalentNodeModel>();
    for (const n of nodes) {
      if (n.positionX > mc) mc = n.positionX;
      if (n.positionY > mr) mr = n.positionY;
      map.set(n.id, n);
    }
    return { maxCol: mc, maxRow: mr, nodeMap: map };
  }, [nodes]);

  const canvasWidth = (maxCol + 1) * CELL_W + 40;
  const canvasHeight = (maxRow + 1) * CELL_H + 40;

  const isOwnedByPlayer = (pid: PlayerId | null, talentId: number) =>
    pid ? purchases.some((p) => p.playerId === pid && p.talentId === talentId) : false;

  return (
    <div className="glass-panel rounded-3xl p-6 overflow-x-auto">
      <div
        className="relative mx-auto"
        style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
      >
        {/* SVG Connection Lines between parent_id -> child */}
        <svg
          width={canvasWidth}
          height={canvasHeight}
          className="absolute inset-0 pointer-events-none"
        >
          {nodes.map((child) => {
            if (!child.parentId) return null;
            const parent = nodeMap.get(child.parentId);
            if (!parent) return null;

            const x1 = 20 + parent.positionX * CELL_W + NODE_SIZE / 2;
            const y1 = 20 + parent.positionY * CELL_H + NODE_SIZE / 2;
            const x2 = 20 + child.positionX * CELL_W + NODE_SIZE / 2;
            const y2 = 20 + child.positionY * CELL_H + NODE_SIZE / 2;

            const activeLink =
              currentPlayerId &&
              isOwnedByPlayer(currentPlayerId, parent.id) &&
              isOwnedByPlayer(currentPlayerId, child.id);

            return (
              <line
                key={`${parent.id}->${child.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={activeLink ? '#34d399' : 'var(--primary)'}
                strokeOpacity={activeLink ? 0.9 : 0.45}
                strokeWidth={activeLink ? 3.5 : 2}
                strokeDasharray={activeLink ? undefined : '6 5'}
              />
            );
          })}
        </svg>

        {/* Square Talent Nodes */}
        {nodes.map((node) => {
          const left = 20 + node.positionX * CELL_W;
          const top = 20 + node.positionY * CELL_H;
          const ownedByCurrent = isOwnedByPlayer(currentPlayerId, node.id);
          const prereqUnlocked =
            !node.parentId ||
            !currentPlayerId ||
            isOwnedByPlayer(currentPlayerId, node.parentId);

          const owners = purchases
            .filter((p) => p.talentId === node.id)
            .map((p) => p.playerId);

          return (
            <div
              key={node.id}
              style={{ left: `${left}px`, top: `${top}px` }}
              className="absolute"
            >
              <TalentNode
                node={node}
                ownedByCurrentPlayer={ownedByCurrent}
                unlockedPrerequisite={prereqUnlocked}
                canAfford={inspirationPoints >= node.cost}
                owners={owners}
                onSelect={setSelectedNode}
              />
            </div>
          );
        })}
      </div>

      <TalentDetail
        node={selectedNode}
        parentNode={selectedNode?.parentId ? (nodeMap.get(selectedNode.parentId) ?? null) : null}
        inspirationPoints={inspirationPoints}
        purchases={purchases}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
};
