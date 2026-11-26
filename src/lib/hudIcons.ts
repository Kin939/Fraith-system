import { resolvePublicAssetUrl } from './cdnAssets';

export type HudAssetKey =
  | 'dice'
  | 'bolt'
  | 'spark'
  | 'blades'
  | 'crown'
  | 'dragon'
  | 'skull'
  | 'orb'
  | 'flame'
  | 'shield';

const HUD_ASSET_PATHS: Record<HudAssetKey, string> = {
  dice: '/assets/hud/dice-d20.png',
  bolt: '/assets/hud/energy-bolt.png',
  spark: '/assets/hud/astral-spark.png',
  blades: '/assets/hud/crossed-blades.png',
  crown: '/assets/hud/dm-crown.png',
  dragon: '/assets/hud/dragon-crest.png',
  skull: '/assets/hud/skull-glitch.png',
  orb: '/assets/hud/psi-orb.png',
  flame: '/assets/hud/flame-rage.png',
  shield: '/assets/hud/aegis-shield.png',
};

const VALID_HUD_KEYS = new Set<string>(Object.keys(HUD_ASSET_PATHS));

export function isHudAssetKey(val?: string | null): val is HudAssetKey {
  return Boolean(val && VALID_HUD_KEYS.has(val));
}

export function getHudAssetUrl(key: HudAssetKey): string {
  return resolvePublicAssetUrl(HUD_ASSET_PATHS[key]);
}

/**
 * Maps any resource/school/preset glyph string (including legacy stored emoji characters
 * from existing LSS JSON or D1 rows) to our generated Sci-Fi Anime HUD PNG emblems.
 */
export function glyphToHudAssetKey(glyph?: string | null): HudAssetKey {
  if (!glyph) return 'spark';
  const trimmed = glyph.trim();
  if (isHudAssetKey(trimmed)) return trimmed;

  const cp = trimmed.codePointAt(0) ?? 0;
  switch (cp) {
    case 0x1f3b2: // dice
      return 'dice';
    case 0x26a1: // bolt
    case 0x2699: // gear
      return 'bolt';
    case 0x2694: // crossed swords
    case 0x1f5e1: // dagger
    case 0x2692: // hammers
      return 'blades';
    case 0x1f451: // crown
    case 0x265b: // queen crown
      return 'crown';
    case 0x1f409: // dragon
    case 0x1f98e: // lizard
    case 0x1f43a: // wolf
      return 'dragon';
    case 0x1f480: // skull
    case 0x2620: // skull & bones
      return 'skull';
    case 0x1f52e: // crystal ball
    case 0x1f9e0: // brain
    case 0x1f441: // eye
    case 0x25c9: // fisheye
    case 0x25d0: // half circle
    case 0x263e: // moon
      return 'orb';
    case 0x1f525: // fire
    case 0x1f4a5: // explosion
    case 0x1f56f: // candle
    case 0x1fa78: // blood drop
    case 0x2697: // alembic
      return 'flame';
    case 0x1f6e1: // shield
    case 0x26e8: // black cross shield
    case 0x2693: // anchor
      return 'shield';
    default:
      return 'spark';
  }
}
