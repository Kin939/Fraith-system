import { useEffect, useState } from 'react';
import { fetchStaticJsonWithFallback } from './cdnAssets';
import type { CustomCampaignEmoji } from './types';

export type EmojiPackCategoryId =
  | 'dnd'
  | 'smileys'
  | 'gestures'
  | 'animals'
  | 'food'
  | 'activities'
  | 'objects'
  | 'symbols';

export interface EmojiPackItem {
  id: string;
  token: string;
  label: string;
  keywords: string;
  category: EmojiPackCategoryId;
  svg: string;
}

interface RawEmojiPackFile {
  version: number;
  items: EmojiPackItem[];
}

export interface ResolvedEmojiVisual {
  token: string;
  label: string;
  url: string;
  isCustomBadge: boolean;
}

let packItemsCache: EmojiPackItem[] | null = null;
let packByTokenCache: Map<string, EmojiPackItem> = new Map();
let packByCategoryCache: Map<EmojiPackCategoryId, EmojiPackItem[]> = new Map();
const svgBlobUrlCache = new Map<string, string>();
let inflightLoad: Promise<EmojiPackItem[]> | null = null;
const subscribers = new Set<() => void>();

function normalizeUnicodeKey(raw: string): string {
  // Strip variation selector-16 and skin tone modifiers for resilient lookup
  return raw.replace(/\uFE0F/g, '');
}

function stripSkinTones(raw: string): string {
  return raw.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/\uFE0F/g, '');
}

export function getEmojiBlobUrl(item: EmojiPackItem): string {
  const cached = svgBlobUrlCache.get(item.id);
  if (cached) return cached;
  if (typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
    const url = URL.createObjectURL(new Blob([item.svg], { type: 'image/svg+xml' }));
    svgBlobUrlCache.set(item.id, url);
    return url;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`;
}

function indexEmojiPack(items: EmojiPackItem[]): void {
  const byToken = new Map<string, EmojiPackItem>();
  const byCat = new Map<EmojiPackCategoryId, EmojiPackItem[]>();

  for (const item of items) {
    byToken.set(item.token, item);
    const norm = normalizeUnicodeKey(item.token);
    if (norm && !byToken.has(norm)) {
      byToken.set(norm, item);
    }
    const list = byCat.get(item.category) ?? [];
    list.push(item);
    byCat.set(item.category, list);
  }

  packItemsCache = items;
  packByTokenCache = byToken;
  packByCategoryCache = byCat;
}

export function ensureEmojiPackLoaded(): Promise<EmojiPackItem[]> {
  if (packItemsCache) return Promise.resolve(packItemsCache);
  if (inflightLoad) return inflightLoad;

  inflightLoad = fetchStaticJsonWithFallback<RawEmojiPackFile>(
    '/data/custom-emoji-pack.json',
    'Не удалось загрузить каталог стилизованных эмодзи'
  )
    .then((data) => {
      const items = Array.isArray(data?.items) ? data.items : [];
      indexEmojiPack(items);
      for (const fn of subscribers) fn();
      return items;
    })
    .catch(() => {
      inflightLoad = null;
      return [];
    });

  return inflightLoad;
}

export function useEmojiPack(): {
  ready: boolean;
  items: EmojiPackItem[];
  byCategory: Map<EmojiPackCategoryId, EmojiPackItem[]>;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (packItemsCache) return;
    const notify = () => setTick((n) => n + 1);
    subscribers.add(notify);
    void ensureEmojiPackLoaded();
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return {
    ready: packItemsCache !== null,
    items: packItemsCache ?? [],
    byCategory: packByCategoryCache,
  };
}

export function resolveEmojiVisual(
  token: string,
  customEmojis?: CustomCampaignEmoji[]
): ResolvedEmojiVisual | null {
  if (!token) return null;

  // 1. Check user-uploaded campaign custom emojis (:c_name:)
  if (token.startsWith(':') && token.endsWith(':') && customEmojis && customEmojis.length > 0) {
    const foundCustom = customEmojis.find((ce) => ce.token === token || `:${ce.code}:` === token);
    if (foundCustom) {
      return {
        token: foundCustom.token,
        label: foundCustom.name,
        url: foundCustom.imageUrl,
        isCustomBadge: true,
      };
    }
  }

  // 2. Check built-in D&D Guild pack & Fluent stylized pack
  const direct =
    packByTokenCache.get(token) ||
    packByTokenCache.get(normalizeUnicodeKey(token)) ||
    packByTokenCache.get(stripSkinTones(token));

  if (direct) {
    return {
      token: direct.token,
      label: direct.label,
      url: getEmojiBlobUrl(direct),
      isCustomBadge: direct.category === 'dnd',
    };
  }

  return null;
}

export type RichTextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'url'; value: string }
  | { kind: 'emoji'; token: string; visual: ResolvedEmojiVisual };

const SHORTCODE_OR_URL_REGEX = /(https?:\/\/[^\s<]+|:[a-zA-Z0-9_]{2,32}:)/g;
const UNICODE_EMOJI_CHECK = /\p{Extended_Pictographic}/u;

type GraphemeSegmenterLike = {
  segment(input: string): Iterable<{ segment: string }>;
};

const graphemeSegmenter: GraphemeSegmenterLike | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (
        Intl as unknown as {
          Segmenter: new (
            locale: string,
            opts: { granularity: 'grapheme' }
          ) => GraphemeSegmenterLike;
        }
      ).Segmenter('ru', { granularity: 'grapheme' })
    : null;

function splitPlainChunkByUnicodeEmojis(
  chunk: string,
  customEmojis?: CustomCampaignEmoji[]
): RichTextSegment[] {
  if (!chunk || !UNICODE_EMOJI_CHECK.test(chunk)) {
    return chunk ? [{ kind: 'text', value: chunk }] : [];
  }

  const graphemes = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(chunk), (s) => s.segment)
    : Array.from(chunk);

  const out: RichTextSegment[] = [];
  let textBuf = '';

  for (const g of graphemes) {
    if (UNICODE_EMOJI_CHECK.test(g)) {
      const visual = resolveEmojiVisual(g, customEmojis);
      if (visual) {
        if (textBuf) {
          out.push({ kind: 'text', value: textBuf });
          textBuf = '';
        }
        out.push({ kind: 'emoji', token: g, visual });
        continue;
      }
    }
    textBuf += g;
  }

  if (textBuf) {
    out.push({ kind: 'text', value: textBuf });
  }
  return out;
}

export function tokenizeRichEmojiText(
  content: string,
  customEmojis?: CustomCampaignEmoji[]
): { segments: RichTextSegment[]; isJumboEmojiOnly: boolean; emojiCount: number } {
  if (!content) {
    return { segments: [], isJumboEmojiOnly: false, emojiCount: 0 };
  }

  const rawParts = content.split(SHORTCODE_OR_URL_REGEX);
  const segments: RichTextSegment[] = [];

  for (const part of rawParts) {
    if (!part) continue;
    if (/^https?:\/\//.test(part)) {
      segments.push({ kind: 'url', value: part });
      continue;
    }
    if (part.startsWith(':') && part.endsWith(':') && part.length >= 4) {
      const visual = resolveEmojiVisual(part, customEmojis);
      if (visual) {
        segments.push({ kind: 'emoji', token: part, visual });
        continue;
      }
    }
    segments.push(...splitPlainChunkByUnicodeEmojis(part, customEmojis));
  }

  let emojiCount = 0;
  let hasNonWhitespaceText = false;
  for (const seg of segments) {
    if (seg.kind === 'emoji') {
      emojiCount++;
    } else if (seg.kind === 'url') {
      hasNonWhitespaceText = true;
    } else if (seg.value.trim().length > 0) {
      hasNonWhitespaceText = true;
    }
  }

  return {
    segments,
    isJumboEmojiOnly: !hasNonWhitespaceText && emojiCount >= 1 && emojiCount <= 6,
    emojiCount,
  };
}
