import React, { useMemo } from 'react';
import {
  resolveEmojiVisual,
  tokenizeRichEmojiText,
  useEmojiPack,
} from '../../lib/emojiPack';
import { useCampaignStore } from '../../lib/store';

interface CustomEmojiGlyphProps {
  token: string;
  sizeClass?: string;
  title?: string;
}

export const CustomEmojiGlyph: React.FC<CustomEmojiGlyphProps> = ({
  token,
  sizeClass = 'w-5 h-5',
  title,
}) => {
  useEmojiPack();
  const customEmojis = useCampaignStore((s) => s.customEmojis);
  const visual = resolveEmojiVisual(token, customEmojis);

  if (!visual) {
    return (
      <span
        title={title || token}
        className={`inline-flex items-center justify-center leading-none select-none ${sizeClass}`}
      >
        {token.startsWith(':') ? '✨' : token}
      </span>
    );
  }

  return (
    <img
      src={visual.url}
      alt={token}
      title={title || visual.label}
      draggable={false}
      decoding="async"
      className={`inline-block object-contain select-none shrink-0 ${sizeClass}`}
    />
  );
};

interface RichEmojiTextProps {
  text: string;
  allowJumbo?: boolean;
  inlineOnly?: boolean;
}

export const RichEmojiText: React.FC<RichEmojiTextProps> = ({
  text,
  allowJumbo = false,
  inlineOnly = false,
}) => {
  const { ready } = useEmojiPack();
  const customEmojis = useCampaignStore((s) => s.customEmojis);

  const parsed = useMemo(
    () => tokenizeRichEmojiText(text, customEmojis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, customEmojis, ready]
  );

  if (allowJumbo && parsed.isJumboEmojiOnly) {
    const sizeCls =
      parsed.emojiCount <= 3 ? 'w-11 h-11 sm:w-12 sm:h-12' : 'w-9 h-9 sm:w-10 sm:h-10';
    return (
      <span className="inline-flex items-center flex-wrap gap-1.5 py-0.5 leading-none">
        {parsed.segments.map((seg, idx) =>
          seg.kind === 'emoji' ? (
            <img
              key={idx}
              src={seg.visual.url}
              alt={seg.token}
              title={`${seg.visual.label} (${seg.token})`}
              draggable={false}
              decoding="async"
              className={`${sizeCls} object-contain select-text transition-transform hover:scale-110`}
            />
          ) : null
        )}
      </span>
    );
  }

  const inlineSizeCls = inlineOnly
    ? 'w-4 h-4 align-[-0.2em]'
    : 'w-[1.38em] h-[1.38em] align-[-0.3em]';

  return (
    <>
      {parsed.segments.map((seg, idx) => {
        if (seg.kind === 'url') {
          return (
            <a
              key={idx}
              href={seg.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 break-all hover:opacity-90"
            >
              {seg.value}
            </a>
          );
        }
        if (seg.kind === 'emoji') {
          return (
            <img
              key={idx}
              src={seg.visual.url}
              alt={seg.token}
              title={seg.visual.label}
              draggable={false}
              decoding="async"
              className={`inline-block ${inlineSizeCls} mx-[1.5px] object-contain select-text`}
            />
          );
        }
        return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
      })}
    </>
  );
};
