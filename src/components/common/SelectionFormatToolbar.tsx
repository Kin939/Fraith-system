import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Dices,
  Eraser,
  Heading3,
  Italic,
  List,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';

interface SelectionBoxState {
  textarea: HTMLTextAreaElement;
  top: number;
  left: number;
  start: number;
  end: number;
}

function triggerReactTextareaChange(
  el: HTMLTextAreaElement,
  nextValue: string,
  selStart: number,
  selEnd: number
): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;
  if (setter) {
    setter.call(el, nextValue);
  } else {
    el.value = nextValue;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  window.requestAnimationFrame(() => {
    el.focus();
    try {
      el.setSelectionRange(selStart, selEnd);
    } catch {
      // ignore if unmounted
    }
  });
}

function isFormattableTextarea(el: Element | null): el is HTMLTextAreaElement {
  if (!el || el.tagName !== 'TEXTAREA') return false;
  const ta = el as HTMLTextAreaElement;
  if (ta.readOnly || ta.disabled) return false;
  if (ta.dataset.noFormat === 'true') return false;
  return true;
}

function wrapOrUnwrapSelection(
  ta: HTMLTextAreaElement,
  prefix: string,
  suffix: string
): void {
  const val = ta.value;
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  if (start === end) return;

  const selected = val.slice(start, end);
  const before = val.slice(0, start);
  const after = val.slice(end);

  // Case 1: surrounding text already has prefix + suffix -> unwrap
  if (before.endsWith(prefix) && after.startsWith(suffix)) {
    const next =
      before.slice(0, before.length - prefix.length) +
      selected +
      after.slice(suffix.length);
    const nextStart = start - prefix.length;
    triggerReactTextareaChange(ta, next, nextStart, nextStart + selected.length);
    return;
  }

  // Case 2: selection itself starts with prefix and ends with suffix -> unwrap
  if (
    selected.length > prefix.length + suffix.length &&
    selected.startsWith(prefix) &&
    selected.endsWith(suffix)
  ) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length);
    const next = before + inner + after;
    triggerReactTextareaChange(ta, next, start, start + inner.length);
    return;
  }

  const next = `${before}${prefix}${selected}${suffix}${after}`;
  triggerReactTextareaChange(
    ta,
    next,
    start + prefix.length,
    end + prefix.length
  );
}

function toggleLinePrefix(ta: HTMLTextAreaElement, linePrefix: string): void {
  const val = ta.value;
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  if (start === end) return;

  const lineStart = val.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIdx = val.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;

  const block = val.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allHave = lines.every((l) => !l.trim() || l.startsWith(linePrefix));

  const transformed = lines
    .map((l) => {
      if (!l.trim()) return l;
      return allHave ? l.slice(linePrefix.length) : `${linePrefix}${l}`;
    })
    .join('\n');

  const next = val.slice(0, lineStart) + transformed + val.slice(lineEnd);
  triggerReactTextareaChange(ta, next, lineStart, lineStart + transformed.length);
}

function stripFormatting(raw: string): string {
  return raw
    .replace(/\{(?:violet|cyan|gold|crimson):([\s\S]*?)\}/g, '$1')
    .replace(/\[(?:roll:|\u{1F3B2})\s*([^\]]+)\]/gu, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/__([\s\S]*?)__/g, '$1')
    .replace(/~~([\s\S]*?)~~/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^(?:###\s+|##\s+|#\s+|>\s+|•\s+|-\s+)/gm, '');
}

/**
 * Floating Notion/Telegram-style rich text formatting popup that automatically appears
 * whenever the user highlights text inside any editable <textarea> across the app.
 */
export const SelectionFormatToolbar: React.FC = () => {
  const [box, setBox] = useState<SelectionBoxState | null>(null);
  const hasOpenBoxRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const closeBoxIfOpen = useCallback(() => {
    if (!hasOpenBoxRef.current) return;
    hasOpenBoxRef.current = false;
    setBox(null);
  }, []);

  const syncSelection = useCallback(() => {
    const active = document.activeElement;
    if (!isFormattableTextarea(active)) {
      closeBoxIfOpen();
      return;
    }

    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (end <= start) {
      closeBoxIfOpen();
      return;
    }

    const rect = active.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      closeBoxIfOpen();
      return;
    }

    const ptr = lastPointerRef.current;
    const rawLeft =
      ptr && ptr.x >= rect.left - 24 && ptr.x <= rect.right + 24
        ? ptr.x
        : rect.left + Math.min(220, rect.width / 2);
    const rawTop =
      ptr && ptr.y >= rect.top - 12 && ptr.y <= rect.bottom + 12
        ? ptr.y - 50
        : rect.top - 46;

    const toolbarHalfWidth = 175;
    const clampedLeft = Math.round(
      Math.max(
        toolbarHalfWidth + 8,
        Math.min(window.innerWidth - toolbarHalfWidth - 8, rawLeft)
      )
    );
    const clampedTop = Math.round(Math.max(8, Math.min(window.innerHeight - 56, rawTop)));

    hasOpenBoxRef.current = true;
    setBox((prev) => {
      if (
        prev &&
        prev.textarea === active &&
        prev.top === clampedTop &&
        prev.left === clampedLeft &&
        prev.start === start &&
        prev.end === end
      ) {
        return prev;
      }
      return {
        textarea: active,
        top: clampedTop,
        left: clampedLeft,
        start,
        end,
      };
    });
  }, [closeBoxIfOpen]);

  const scheduleSync = useCallback(() => {
    // Fast-path during ordinary typing: if cursor is collapsed and toolbar is already closed, do ZERO work!
    const active = document.activeElement;
    if (!hasOpenBoxRef.current) {
      if (!isFormattableTextarea(active)) return;
      if ((active.selectionEnd ?? 0) <= (active.selectionStart ?? 0)) return;
    }
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      syncSelection();
    });
  }, [syncSelection]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      scheduleSync();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches?.[0];
      if (t) {
        lastPointerRef.current = { x: t.clientX, y: t.clientY };
      }
      window.setTimeout(scheduleSync, 25);
    };
    const onSelectionChange = () => {
      scheduleSync();
    };
    const onScrollOrResize = () => {
      if (hasOpenBoxRef.current) {
        scheduleSync();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (!isFormattableTextarea(active)) return;
      if (!(e.ctrlKey || e.metaKey)) return;

      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        wrapOrUnwrapSelection(active, '**', '**');
        scheduleSync();
      } else if (k === 'i') {
        e.preventDefault();
        wrapOrUnwrapSelection(active, '*', '*');
        scheduleSync();
      } else if (k === 'u') {
        e.preventDefault();
        wrapOrUnwrapSelection(active, '__', '__');
        scheduleSync();
      } else if (e.shiftKey && k === 'x') {
        e.preventDefault();
        wrapOrUnwrapSelection(active, '~~', '~~');
        scheduleSync();
      }
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('touchend', onTouchEnd, true);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [scheduleSync]);

  if (!box) return null;

  const runWrap = (prefix: string, suffix: string) => {
    wrapOrUnwrapSelection(box.textarea, prefix, suffix);
    window.setTimeout(syncSelection, 15);
  };

  const runLine = (prefix: string) => {
    toggleLinePrefix(box.textarea, prefix);
    window.setTimeout(syncSelection, 15);
  };

  const runClear = () => {
    const ta = box.textarea;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end <= start) return;
    const cleaned = stripFormatting(ta.value.slice(start, end));
    const next = ta.value.slice(0, start) + cleaned + ta.value.slice(end);
    triggerReactTextareaChange(ta, next, start, start + cleaned.length);
    window.setTimeout(syncSelection, 15);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: `${box.top}px`,
        left: `${box.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 120,
      }}
      onMouseDown={(e) => {
        // Prevent blurring the active textarea when clicking toolbar buttons
        e.preventDefault();
        e.stopPropagation();
      }}
      className="bg-raised hud-cut-sm px-2 py-1.5 flex items-center gap-0.5 shadow-glass border border-border"
    >
      <button
        type="button"
        onClick={() => runWrap('**', '**')}
        title="Жирный (Ctrl+B)"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <Bold className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => runWrap('*', '*')}
        title="Курсив (Ctrl+I)"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <Italic className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => runWrap('__', '__')}
        title="Подчёркнутый (Ctrl+U)"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <Underline className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => runWrap('~~', '~~')}
        title="Зачёркнутый (Ctrl+Shift+X)"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <Strikethrough className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <span className="w-px h-4 bg-border mx-1" />

      <button
        type="button"
        onClick={() => runLine('### ')}
        title="Заголовок раздела"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <Heading3 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => runLine('• ')}
        title="Маркированный список"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <List className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={() => runLine('> ')}
        title="Цитата / важная врезка"
        className="p-1.5 hover:bg-surface text-text transition-colors"
      >
        <Quote className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <span className="w-px h-4 bg-border mx-1" />

      {/* Color Highlights */}
      <button
        type="button"
        onClick={() => runWrap('{violet:', '}')}
        title="Выделить фиолетовым"
        className="w-6 h-6 flex items-center justify-center hover:bg-surface"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
      </button>
      <button
        type="button"
        onClick={() => runWrap('{cyan:', '}')}
        title="Выделить голубым"
        className="w-6 h-6 flex items-center justify-center hover:bg-surface"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
      </button>
      <button
        type="button"
        onClick={() => runWrap('{gold:', '}')}
        title="Выделить янтарным"
        className="w-6 h-6 flex items-center justify-center hover:bg-surface"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#e5a93b]" />
      </button>
      <button
        type="button"
        onClick={() => runWrap('{crimson:', '}')}
        title="Выделить коралловым"
        className="w-6 h-6 flex items-center justify-center hover:bg-surface"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#e5484d]" />
      </button>

      <span className="w-px h-4 bg-border mx-1" />

      <button
        type="button"
        onClick={() => runWrap('[roll: ', ']')}
        title="Сделать кликабельной формулой броска кубиков (напр. 2к6+3)"
        className="p-1.5 hover:bg-surface text-primary transition-colors"
      >
        <Dices className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>

      <button
        type="button"
        onClick={runClear}
        title="Очистить форматирование"
        className="p-1.5 hover:bg-surface text-muted hover:text-negative transition-colors"
      >
        <Eraser className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
};
