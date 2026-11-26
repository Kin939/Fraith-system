import React, { useState } from 'react';
import { InspirationCounter } from '../components/talents/InspirationCounter';
import { TalentNodeModal } from '../components/talents/TalentEditor';
import { TalentTree } from '../components/talents/TalentTree';
import { useCampaignStore } from '../lib/store';
import type { TalentNode } from '../lib/types';

export const TalentsPage: React.FC = () => {
  const user = useCampaignStore((s) => s.user);
  const inspirationPoints = useCampaignStore((s) => s.inspirationPoints);
  const nodes = useCampaignStore((s) => s.talentNodes);

  const isDm = user?.role === 'dm';
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TalentNode | null>(null);
  const [spawnPos, setSpawnPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-medium text-2xl text-text">Дерево талантов</h1>
        <p className="text-sm text-secondary mt-1">
          Общие навыки и усиления отряда, открываемые за вдохновение
        </p>
      </div>

      <InspirationCounter points={inspirationPoints} isDm={Boolean(isDm)} />

      <TalentTree
        nodes={nodes}
        inspirationPoints={inspirationPoints}
        selectedEditorId={editingNode?.id ?? null}
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
      />

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
