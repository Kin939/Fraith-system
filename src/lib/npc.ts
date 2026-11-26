import type { NpcAttitude } from './types';

export interface NpcAttitudeMeta {
  label: string;
  short: string;
  color: string;
  hint: string;
}

/** Attitude vocabulary for the "Связи" tab — drives chips, rims and filters. */
export const NPC_ATTITUDE_META: Record<NpcAttitude, NpcAttitudeMeta> = {
  friendly: {
    label: 'Дружелюбен',
    short: 'Друг',
    color: '#34d399',
    hint: 'Союзник отряда',
  },
  neutral: {
    label: 'Нейтрален',
    short: 'Нейтр.',
    color: '#94a3b8',
    hint: 'Держит дистанцию',
  },
  wary: {
    label: 'Насторожен',
    short: 'Настор.',
    color: '#fbbf24',
    hint: 'Недоверчив и следит',
  },
  hostile: {
    label: 'Враждебен',
    short: 'Враг',
    color: '#f87171',
    hint: 'Противник отряда',
  },
  unknown: {
    label: 'Неизвестно',
    short: '?',
    color: '#a78bfa',
    hint: 'Мотивы неясны',
  },
};

export const NPC_ATTITUDE_OPTIONS: NpcAttitude[] = [
  'friendly',
  'neutral',
  'wary',
  'hostile',
  'unknown',
];

export function resolveNpcAttitude(value: unknown): NpcAttitudeMeta {
  const key = typeof value === 'string' ? value : '';
  return NPC_ATTITUDE_META[key as NpcAttitude] ?? NPC_ATTITUDE_META.neutral;
}

export function npcInitials(name: string): string {
  const parts = (name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p.slice(0, 1).toUpperCase()).join('');
}
