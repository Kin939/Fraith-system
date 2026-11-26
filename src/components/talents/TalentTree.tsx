import React, { useMemo, useRef, useState } from 'react';
import { Move, Plus, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useCampaignStore } from '../../lib/store';
import type { PurchasedTalent, TalentNode as TalentNodeModel } from '../../lib/types';
import { TalentDetail } from './TalentDetail';
import { TalentNode } from './TalentNode';

interface TalentTreeProps {
  nodes: TalentNodeModel[];
  inspirationPoints: number;
  selectedEditorId?: number | null;
  onRequestCreateAt?: (x: number, y: number) => void;
  onRequestEditNode?: (node: TalentNodeModel) => void;
}

const NODE_SIZE = 176; // w-44 = 176px
const SNAP_PX = 8;

export const TalentTree: React.FC<TalentTreeProps> = ({
  nodes,
  inspirationPoints,
  selectedEditorId,
  onRequestCreateAt,
  onRequestEditNode,
}) => {
  const user = useCampaignStore((s) => s.user);
  const setTalentsBundle = useCampaignStore((s) => s.setTalentsBundle);
  const pushToast = useCampaignStore((s) => s.pushToast);

  const isDm = user?.role === 'dm';
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const [detailNode, setDetailNode] = useState<TalentNodeModel | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const dragMetaRef = useRef<{
    nodeId: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  } | null>(null);

  const suppressClickRef = useRef(false);

  const nodeMap = useMemo(() => {
    const m = new Map<number, TalentNodeModel>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const getEffectivePos = (n: TalentNodeModel) => {
    if (draggingId === n.id && dragPos) {
      return dragPos;
    }
    return { x: n.positionX, y: n.positionY };
  };

  const { canvasWidth, canvasHeight } = useMemo(() => {
    let maxX = 820;
    let maxY = 520;
    for (const n of nodes) {
      const pos = draggingId === n.id && dragPos ? dragPos : { x: n.positionX, y: n.positionY };
      if (pos.x + NODE_SIZE + 80 > maxX) maxX = pos.x + NODE_SIZE + 80;
      if (pos.y + NODE_SIZE + 80 > maxY) maxY = pos.y + NODE_SIZE + 80;
    }
    return { canvasWidth: maxX, canvasHeight: maxY };
  }, [nodes, draggingId, dragPos]);

  const handlePointerDownNode = (
    e: React.PointerEvent<HTMLDivElement>,
    node: TalentNodeModel
  ) => {
    if (!isDm || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMetaRef.current = {
      nodeId: node.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: node.positionX,
      origY: node.positionY,
      hasMoved: false,
    };
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    const meta = dragMetaRef.current;
    if (!meta) return;
    const dx = e.clientX - meta.startClientX;
    const dy = e.clientY - meta.startClientY;

    if (!meta.hasMoved && Math.hypot(dx, dy) < 6) {
      return;
    }
    meta.hasMoved = true;
    suppressClickRef.current = true;

    const nextX = Math.max(16, Math.round((meta.origX + dx) / SNAP_PX) * SNAP_PX);
    const nextY = Math.max(16, Math.round((meta.origY + dy) / SNAP_PX) * SNAP_PX);
    setDraggingId(meta.nodeId);
    setDragPos({ x: nextX, y: nextY });
  };

  const handlePointerUpCanvas = async () => {
    const meta = dragMetaRef.current;
    if (!meta) return;
    dragMetaRef.current = null;

    if (!meta.hasMoved || !dragPos) {
      setDraggingId(null);
      setDragPos(null);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      return;
    }

    const finalX = dragPos.x;
    const finalY = dragPos.y;
    const movedNodeId = meta.nodeId;

    // Optimistic local update so tile stays right where dropped without jump
    const optimisticNodes = nodes.map((n) =>
      n.id === movedNodeId ? { ...n, positionX: finalX, positionY: finalY } : n
    );
    setTalentsBundle({
      inspirationPoints,
      nodes: optimisticNodes,
      purchases: [],
    });
    setDraggingId(null);
    setDragPos(null);

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 60);

    try {
      const res = await apiFetch<{
        inspirationPoints: number;
        nodes: TalentNodeModel[];
        purchases: PurchasedTalent[];
      }>(`/api/dm/talents/${movedNodeId}/position`, {
        method: 'PATCH',
        body: JSON.stringify({ positionX: finalX, positionY: finalY }),
      });
      setTalentsBundle(res);
    } catch (err) {
      pushToast({
        title: 'Не удалось сохранить позицию плитки',
        message: err instanceof Error ? err.message : 'Попробуйте снова',
        variant: 'error',
      });
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDm || !onRequestCreateAt || !canvasRef.current) return;
    if (e.target !== canvasRef.current && (e.target as HTMLElement).tagName !== 'svg') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(
      16,
      Math.round((e.clientX - rect.left - NODE_SIZE / 2) / SNAP_PX) * SNAP_PX
    );
    const y = Math.max(
      16,
      Math.round((e.clientY - rect.top - NODE_SIZE / 2) / SNAP_PX) * SNAP_PX
    );
    onRequestCreateAt(x, y);
  };

  return (
    <div className="glass-panel hud-corners hud-cut overflow-hidden">
      {/* Top Hint / DM Action Strip */}
      <div className="px-5 py-3 border-b border-primary/30 bg-[#070B14]/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          {isDm ? (
            <>
              <Move className="w-4 h-4 text-accent shrink-0" />
              <span>
                Перетаскивайте плитки талантов мышью в любое место холста (позиция сохраняется автоматически). Двойной клик по пустому месту — создать плитку.
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <span>
                Таланты открываются сразу для всей группы за общий пул Вдохновений.
              </span>
            </>
          )}
        </div>

        {isDm && onRequestCreateAt && (
          <button
            type="button"
            onClick={() => {
              const offset = (nodes.length % 5) * 48;
              onRequestCreateAt(80 + offset, 80 + offset);
            }}
            className="anime-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить талант</span>
          </button>
        )}
      </div>

      {/* Scrollable Interactive Canvas */}
      <div className="overflow-auto p-4">
        <div
          ref={canvasRef}
          onPointerMove={handlePointerMoveCanvas}
          onPointerUp={() => void handlePointerUpCanvas()}
          onDoubleClick={handleCanvasDoubleClick}
          className="relative border border-primary/25 bg-[#070B14]/85 mx-auto"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            backgroundImage:
              'radial-gradient(color-mix(in srgb, var(--primary) 26%, transparent) 1.25px, transparent 1.25px)',
            backgroundSize: '24px 24px',
          }}
        >
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
              <Sparkles className="w-8 h-8 text-primary/50 mb-2" />
              <div className="font-anime font-bold text-sm text-text/90">
                Дерево талантов пока пусто
              </div>
              <div className="text-xs text-muted max-w-sm mt-1">
                {isDm
                  ? 'Нажмите «Добавить талант» или дважды кликните в нужном месте холста, чтобы разместить первую плитку.'
                  : 'Мастер ещё не разместил узлы талантов кампании.'}
              </div>
            </div>
          )}

          {/* Smooth Curved SVG Connection Paths */}
          <svg
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0 pointer-events-none"
          >
            {nodes.map((child) => {
              if (!child.parentId) return null;
              const parent = nodeMap.get(child.parentId);
              if (!parent) return null;

              const pPos = getEffectivePos(parent);
              const cPos = getEffectivePos(child);

              const x1 = pPos.x + NODE_SIZE / 2;
              const y1 = pPos.y + NODE_SIZE / 2;
              const x2 = cPos.x + NODE_SIZE / 2;
              const y2 = cPos.y + NODE_SIZE / 2;

              const dx = x2 - x1;
              const dy = y2 - y1;
              const curveVertical = Math.abs(dy) >= Math.abs(dx);
              const d = curveVertical
                ? `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1 + dx * 0.5} ${y1}, ${x2 - dx * 0.5} ${y2}, ${x2} ${y2}`;

              const bothUnlocked = Boolean(parent.isUnlocked && child.isUnlocked);
              const parentUnlocked = Boolean(parent.isUnlocked);

              return (
                <path
                  key={`${parent.id}->${child.id}`}
                  d={d}
                  fill="none"
                  stroke={
                    bothUnlocked
                      ? 'var(--primary)'
                      : parentUnlocked
                        ? 'var(--accent)'
                        : 'rgba(143, 163, 191, 0.35)'
                  }
                  strokeOpacity={bothUnlocked ? 0.92 : parentUnlocked ? 0.65 : 0.4}
                  strokeWidth={bothUnlocked ? 3.5 : 2.5}
                  strokeDasharray={bothUnlocked ? undefined : '7 5'}
                />
              );
            })}
          </svg>

          {/* Draggable Talent Tiles */}
          {nodes.map((node) => {
            const pos = getEffectivePos(node);
            const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
            const prereqUnlocked = !parent || Boolean(parent.isUnlocked);

            return (
              <div
                key={node.id}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                className="absolute"
              >
                <TalentNode
                  node={node}
                  unlockedPrerequisite={prereqUnlocked}
                  canAfford={inspirationPoints >= node.cost}
                  isDm={Boolean(isDm)}
                  isDragging={draggingId === node.id}
                  isSelectedInEditor={selectedEditorId === node.id}
                  onPointerDown={handlePointerDownNode}
                  onSelect={(clicked) => {
                    if (suppressClickRef.current) return;
                    setDetailNode(clicked);
                  }}
                  onEditNode={isDm ? onRequestEditNode : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <TalentDetail
        node={
          detailNode ? (nodeMap.get(detailNode.id) ?? detailNode) : null
        }
        parentNode={
          detailNode?.parentId ? (nodeMap.get(detailNode.parentId) ?? null) : null
        }
        inspirationPoints={inspirationPoints}
        onClose={() => setDetailNode(null)}
        onEditNode={isDm ? onRequestEditNode : undefined}
      />
    </div>
  );
};
