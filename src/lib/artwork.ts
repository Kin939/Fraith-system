import { getHudAssetUrl, glyphToHudAssetKey, type HudAssetKey } from './hudIcons';

const PRESET_CONFIGS: Record<
  string,
  { asset: HudAssetKey; c1: string; subtitle: string }
> = {
  'preset:kobolds': { asset: 'blades', c1: '#f97316', subtitle: 'CRYSTAL MINES' },
  'preset:obelisks': { asset: 'orb', c1: '#7c4dff', subtitle: 'ARCANE SEAL' },
  'preset:harbor': { asset: 'shield', c1: '#00e5ff', subtitle: 'PORT FRAITH' },
  'preset:blade': { asset: 'blades', c1: '#ec4899', subtitle: 'SOLARIS SHARDS' },
  'preset:kobold': { asset: 'dragon', c1: '#fb923c', subtitle: 'CR 1/4' },
  'preset:hound': { asset: 'dragon', c1: '#00e5ff', subtitle: 'CR 1' },
  'preset:mimic': { asset: 'orb', c1: '#7c4dff', subtitle: 'CR 2' },
  'preset:knight': { asset: 'shield', c1: '#94a3b8', subtitle: 'CR 3' },
  'preset:nightmare': { asset: 'bolt', c1: '#e879f9', subtitle: 'CR 5' },
  'preset:beholder': { asset: 'orb', c1: '#00e5ff', subtitle: 'CR 8' },
  'preset:lich': { asset: 'skull', c1: '#10b981', subtitle: 'CR 13' },
  'preset:dragon': { asset: 'dragon', c1: '#f43f5e', subtitle: 'CR 17' },
  'preset:spark': { asset: 'spark', c1: '#00e5ff', subtitle: 'AWAKENING' },
  'preset:crystal': { asset: 'spark', c1: '#00e5ff', subtitle: 'RESOLVE' },
  'preset:resonance': { asset: 'orb', c1: '#7c4dff', subtitle: 'RESONANCE' },
  'preset:shadowstep': { asset: 'blades', c1: '#ec4899', subtitle: 'DUSK STEP' },
  'preset:aegis': { asset: 'shield', c1: '#f59e0b', subtitle: 'AEGIS' },
  'preset:coven': { asset: 'orb', c1: '#c084fc', subtitle: 'COVEN LINK' },
  'preset:eclipse': { asset: 'blades', c1: '#fb7185', subtitle: 'ECLIPSE' },
  'preset:crown': { asset: 'crown', c1: '#fde047', subtitle: 'ASTRAL CROWN' },
};

export function resolveImageUrl(imageKey?: string | null, fallbackGlyph = 'spark'): string {
  if (!imageKey) {
    return getHudAssetUrl(glyphToHudAssetKey(fallbackGlyph));
  }
  if (
    imageKey.startsWith('http://') ||
    imageKey.startsWith('https://') ||
    imageKey.startsWith('data:')
  ) {
    return imageKey;
  }
  if (PRESET_CONFIGS[imageKey]) {
    return getHudAssetUrl(PRESET_CONFIGS[imageKey].asset);
  }
  return `/api/r2/${encodeURIComponent(imageKey)}`;
}
