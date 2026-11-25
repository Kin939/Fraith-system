import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { DndsuFilterGroup } from '../../lib/types';

interface DndsuMultiSelectProps<T extends number | string> {
  placeholder: string;
  groups: DndsuFilterGroup[];
  selected: T[];
  onChange: (next: T[]) => void;
  single?: boolean;
  allowSelectAll?: boolean;
}

export function DndsuMultiSelect<T extends number | string>({
  placeholder,
  groups,
  selected,
  onChange,
  single = false,
  allowSelectAll = false,
}: DndsuMultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updateMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 256);
    const maxLeft = Math.max(8, window.innerWidth - minWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const openUpwards = spaceBelow < 220 && rect.top > spaceBelow;

    if (openUpwards) {
      setMenuStyle({
        position: 'fixed',
        left: `${left}px`,
        bottom: `${window.innerHeight - rect.top + 6}px`,
        width: `${minWidth}px`,
        maxWidth: 'calc(100vw - 16px)',
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${rect.bottom + 6}px`,
        width: `${minWidth}px`,
        maxWidth: 'calc(100vw - 16px)',
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    const onWindowReposition = () => updateMenuPosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('scroll', onWindowReposition, true);
    window.addEventListener('resize', onWindowReposition);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('scroll', onWindowReposition, true);
      window.removeEventListener('resize', onWindowReposition);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, updateMenuPosition]);

  const totalItems = useMemo(
    () => groups.reduce((acc, g) => acc + g.list.length, 0),
    [groups]
  );

  const labelByVal = useMemo(() => {
    const map = new Map<T, string>();
    for (const g of groups) {
      for (const item of g.list) {
        map.set(item.value as T, item.title);
      }
    }
    return map;
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        list: g.list.filter(
          (it) =>
            it.title.toLowerCase().includes(q) ||
            (g.title && g.title.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.list.length > 0);
  }, [groups, filterText]);

  const toggleItem = (val: T) => {
    if (single) {
      if (selected.includes(val)) {
        onChange([]);
      } else {
        onChange([val]);
      }
      setOpen(false);
      return;
    }
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleSelectAll = () => {
    const all: T[] = [];
    for (const g of groups) {
      for (const it of g.list) {
        all.push(it.value as T);
      }
    }
    onChange(all);
  };

  const summaryText = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return `${placeholder}: ${labelByVal.get(selected[0]) ?? selected[0]}`;
    }
    return `${placeholder} (${selected.length})`;
  }, [selected, placeholder, labelByVal]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border transition-all text-left ${
          selected.length > 0
            ? 'bg-primary/15 border-primary/60 text-text font-semibold'
            : 'bg-bg/75 border-border text-muted hover:text-text hover:border-primary/40'
        }`}
      >
        <span className="truncate">{summaryText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              className="p-0.5 rounded hover:bg-primary/25 text-primary"
              title="Очистить"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180 text-primary' : ''}`}
          />
        </div>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="z-[120] rounded-2xl border border-primary/55 bg-surface shadow-[0_18px_48px_rgba(0,0,0,0.75)] overflow-hidden backdrop-blur-xl"
          >
            {(allowSelectAll || selected.length > 0) && (
              <div className="px-3 py-2 border-b border-border bg-bg/80 flex items-center justify-between gap-2 text-[11px]">
                {allowSelectAll && !single ? (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-accent hover:underline font-medium"
                  >
                    Выбрать все
                  </button>
                ) : (
                  <span className="text-muted">{placeholder}</span>
                )}
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-rose-300 hover:underline font-medium"
                >
                  Очистить
                </button>
              </div>
            )}

            {totalItems > 10 && (
              <div className="p-2 border-b border-border bg-bg/60">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Быстрый фильтр..."
                    className="w-full bg-bg/90 border border-border rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 bg-surface">
              {filteredGroups.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted text-center">Ничего не найдено</div>
              ) : (
                filteredGroups.map((group, gIdx) => (
                  <div key={`${group.title}-${gIdx}`}>
                    {group.title && (
                      <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-accent/90">
                        {group.title}
                      </div>
                    )}
                    {group.list.map((item) => {
                      const val = item.value as T;
                      const active = selected.includes(val);
                      return (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => toggleItem(val)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                            active
                              ? 'bg-primary/20 text-text font-semibold'
                              : 'text-text/85 hover:bg-bg/70'
                          }`}
                        >
                          <span className="truncate">{item.title}</span>
                          {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
