import type { SpellCastMode } from './types';

export interface SpellCastModeOption {
  value: SpellCastMode;
  label: string;
  shortLabel: string;
  usesCounter: boolean;
}

export const SPELL_CAST_MODE_OPTIONS: SpellCastModeOption[] = [
  {
    value: 'slot',
    label: 'По ячейке заклинаний (стандартно)',
    shortLabel: 'По ячейке',
    usesCounter: false,
  },
  {
    value: 'at_will',
    label: '∞ Неограниченно (по желанию / без ячейки)',
    shortLabel: '∞ Неограниченно',
    usesCounter: false,
  },
  {
    value: 'long_rest',
    label: 'За продолжительный отдых (1/дл. отд. и т.д.)',
    shortLabel: 'Дл. отдых',
    usesCounter: true,
  },
  {
    value: 'short_rest',
    label: 'За короткий отдых (1/кор. отд. и т.д.)',
    shortLabel: 'Кор. отдых',
    usesCounter: true,
  },
  {
    value: 'resource',
    label: 'За уникальный ресурс (Пси-очки / Ци / Заряды)',
    shortLabel: 'За ресурс',
    usesCounter: true,
  },
  {
    value: 'ritual_only',
    label: 'Только ритуалом (+10 мин, без ячейки)',
    shortLabel: 'Ритуал ∞',
    usesCounter: false,
  },
  {
    value: 'custom',
    label: 'Особая опция / Предмет / Свиток',
    shortLabel: 'Особое',
    usesCounter: true,
  },
];

export function formatSpellCastBadge(
  mode: SpellCastMode | undefined,
  level: number,
  maxUses = 1,
  note = ''
): { text: string; className: string } {
  const m: SpellCastMode = mode || 'slot';

  if (m === 'at_will') {
    return {
      text: note ? `∞ ${note}` : '∞ Неограниченно',
      className: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
    };
  }
  if (m === 'long_rest') {
    return {
      text: `${maxUses}/дл. отд.${note ? ` • ${note}` : ''}`,
      className: 'bg-purple-500/20 border-purple-400/50 text-purple-200',
    };
  }
  if (m === 'short_rest') {
    return {
      text: `${maxUses}/кор. отд.${note ? ` • ${note}` : ''}`,
      className: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200',
    };
  }
  if (m === 'resource') {
    return {
      text: note ? `${maxUses} × ${note}` : `${maxUses} ед. ресурса`,
      className: 'bg-amber-500/20 border-amber-400/50 text-amber-200',
    };
  }
  if (m === 'ritual_only') {
    return {
      text: 'Ритуал (без ячейки)',
      className: 'bg-sky-500/20 border-sky-400/50 text-sky-200',
    };
  }
  if (m === 'custom') {
    return {
      text: note ? `${note} (${maxUses})` : `Особое (${maxUses})`,
      className: 'bg-pink-500/20 border-pink-400/50 text-pink-200',
    };
  }

  if (level === 0) {
    return {
      text: '∞ Заговор',
      className: 'bg-surface border-border text-muted',
    };
  }
  return {
    text: 'Ячейка',
    className: 'bg-surface border-border text-muted',
  };
}
