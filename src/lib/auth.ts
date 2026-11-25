import bcrypt from 'bcryptjs';
import type { PlayerId, UserRole } from './types';

export const SESSION_COOKIE_NAME = 'fraith_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface JwtSessionPayload {
  sub: number;
  username: string;
  role: UserRole;
  playerId: PlayerId | null;
  iat: number;
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeText(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

function base64UrlDecodeToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionJwt(
  user: { id: number; username: string; role: UserRole; playerId: PlayerId | null },
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtSessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    playerId: user.playerId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const headerB64 = base64UrlEncodeText(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncodeText(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput)
  );
  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${signingInput}.${signatureB64}`;
}

export async function verifySessionJwt(
  token: string,
  secret: string
): Promise<JwtSessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    const key = await importHmacKey(secret);
    const sigBytes = base64UrlDecodeToBytes(signatureB64);
    const sigArrayBuffer = sigBytes.buffer.slice(
      sigBytes.byteOffset,
      sigBytes.byteOffset + sigBytes.byteLength
    ) as ArrayBuffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigArrayBuffer,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as JwtSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, 10);
}

export function verifyPassword(plainPassword: string, passwordHash: string): boolean {
  return bcrypt.compareSync(plainPassword, passwordHash);
}

export function parseCookieHeader(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function buildSessionSetCookie(token: string, isSecure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ];
  if (isSecure) attrs.push('Secure');
  return attrs.join('; ');
}

export function buildLogoutSetCookie(isSecure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecure) attrs.push('Secure');
  return attrs.join('; ');
}
