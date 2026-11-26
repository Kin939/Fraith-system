import React from 'react';
import { HudIcon } from './HudIcon';
import { apiFetch } from '../../lib/api';
import { rollDamageExpression } from '../../lib/lssSheetParser';
import { useCampaignStore } from '../../lib/store';
import type { RollLogEntry } from '../../lib/types';

interface FormattedTextProps {
  text: string;
  className?: string;
  characterName?: string;
}

const INLINE_TOKEN_RE =
  /(\[(?:roll:|\u{1F3B2})\s*[^\]]+\]|\[(?:res:|\u26A1)\s*[^\]]+\]|\{(?:violet|cyan|gold|crimson):[\s\S]*?\}|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|`[^`\n]+`|\*[^*\n]+\*)/gu;

const COLOR_CLASS_MAP: Record<string, string> = {
  violet: 'text-purple-300 bg-purple-500/15 px-1 border border-purple-500/30 font-medium',
  cyan: 'text-cyan-300 bg-cyan-500/15 px-1 border border-cyan-500/30 font-medium',
  gold: 'text-amber-300 bg-amber-500/15 px-1 border border-amber-500/30 font-medium',
  crimson: 'text-rose-300 bg-rose-500/15 px-1 border border-rose-500/30 font-medium',
};

async function triggerInlineDiceRoll(
  formulaRaw: string,
  overrideCharName?: string
): Promise<void> {
  const store = useCampaignStore.getState();
  const user = store.user;
  if (!user) return;

  const cleanFormula = formulaRaw.trim();
  const roll = rollDamageExpression(cleanFormula);
  const pid = user.role === 'dm' ? store.dmSelectedPlayerId : user.playerId;
  const charName =
    overrideCharName?.trim() ||
    (pid && store.charactersById[pid]?.characterName?.trim()) ||
    user.displayName;

  try {
    const res = await apiFetch<{ roll: RollLogEntry }>('/api/rolls', {
      method: 'POST',
      body: JSON.stringify({
        playerId: pid,
        characterName: charName,
        title: `Бросок (${cleanFormula})`,
        formula: roll.formula,
        breakdown: roll.breakdown,
        total: roll.total,
        isCrit: false,
      }),
    });
    store.prependRoll(res.roll);
    store.pushToast({
      title: `[DICE] ${cleanFormula}: ${roll.total}`,
      message: roll.breakdown,
      variant: 'info',
    });
  } catch {
    store.pushToast({
      title: `[DICE] ${cleanFormula}: ${roll.total}`,
      message: roll.breakdown,
      variant: 'info',
    });
  }
}

export function renderInlineFormatted(
  text: string,
  depth = 0,
  characterName?: string
): React.ReactNode {
  if (!text || depth > 5) return text;
  const parts = text.split(INLINE_TOKEN_RE);
  if (parts.length === 1) return text;

  return parts.map((part, idx) => {
    if (!part) return null;

    const rollMatch = part.match(/^\[(?:roll:|\u{1F3B2})\s*([^\]]+)\]$/u);
    if (rollMatch) {
      const inner = rollMatch[1].trim();
      return (
        <button
          key={idx}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void triggerInlineDiceRoll(inner, characterName);
          }}
          title="Нажмите, чтобы бросить кубики в общий лог стола"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-primary/15 hover:bg-primary/25 border border-primary/50 text-primary font-mono text-[0.9em] font-bold transition-colors cursor-pointer"
        >
          <HudIcon asset="dice" size="xs" />
          <span>{inner}</span>
        </button>
      );
    }

    const resMatch = part.match(/^\[(?:res:|\u26A1)\s*([^\]]+)\]$/u);
    if (resMatch) {
      const inner = resMatch[1].trim();
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[0.9em] font-semibold"
        >
          <HudIcon asset="bolt" size="xs" />
          <span>{inner}</span>
        </span>
      );
    }

    const colorMatch = part.match(/^\{(violet|cyan|gold|crimson):([\s\S]*)\}$/);
    if (colorMatch) {
      const [, colorKey, inner] = colorMatch;
      return (
        <span key={idx} className={COLOR_CLASS_MAP[colorKey] || ''}>
          {renderInlineFormatted(inner, depth + 1, characterName)}
        </span>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-text">
          {renderInlineFormatted(part.slice(2, -2), depth + 1, characterName)}
        </strong>
      );
    }

    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
      return (
        <u key={idx} className="underline decoration-primary/80 underline-offset-2">
          {renderInlineFormatted(part.slice(2, -2), depth + 1, characterName)}
        </u>
      );
    }

    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <s key={idx} className="line-through opacity-70">
          {renderInlineFormatted(part.slice(2, -2), depth + 1, characterName)}
        </s>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.2 bg-bg/80 border border-border font-mono text-[0.9em] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-text/95">
          {renderInlineFormatted(part.slice(1, -1), depth + 1, characterName)}
        </em>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Renders rich formatted text supporting bold (**), italic (*), underline (__),
 * strikethrough (~~), code (`), headings (###), bullet/ordered lists, quotes (>),
 * dividers (---), colored highlights ({gold:...}), and clickable dice rolls ([roll: 2к6+3]).
 */
export const FormattedText: React.FC<FormattedTextProps> = React.memo(({
  text,
  className = '',
  characterName,
}) => {
  if (!text || !text.trim()) return null;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      blocks.push(<hr key={`hr-${i}`} className="border-border/75 my-2" />);
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const sizeCls =
        level === 1
          ? 'text-base font-extrabold text-primary'
          : level === 2
            ? 'text-sm font-extrabold text-primary/90'
            : 'text-xs font-extrabold uppercase tracking-wider text-primary';
      blocks.push(
        <div key={`h-${i}`} className={`font-anime mt-1.5 ${sizeCls}`}>
          {renderInlineFormatted(headingText, 0, characterName)}
        </div>
      );
      i++;
      continue;
    }

    // Quote block
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`q-${i}`}
          className="border-l-2 border-primary bg-primary/10 px-3 py-1.5 italic text-text/90 space-y-1"
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>{renderInlineFormatted(ql, 0, characterName)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Bullet list
    if (/^(?:•|-|\*)\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^(?:•|-|\*)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(?:•|-|\*)\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInlineFormatted(it, 0, characterName)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInlineFormatted(it, 0, characterName)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph (combine consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      lines[i].trim() !== '---' &&
      lines[i].trim() !== '***' &&
      !/^(?:#{1,3}\s+|>\s+|(?:•|-|\*)\s+|\d+\.\s+)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} className="whitespace-pre-line">
        {paraLines.map((pl, pi) => (
          <React.Fragment key={pi}>
            {pi > 0 && '\n'}
            {renderInlineFormatted(pl, 0, characterName)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className={`space-y-2 leading-relaxed ${className}`}>{blocks}</div>;
});
