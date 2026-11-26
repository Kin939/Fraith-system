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
    label: 'Неограниченно (без ячейки)',
    shortLabel: 'Неограниченно',
    usesCounter: false,
  },
  {
    value: 'long_rest',
    label: 'За продолжительный отдых',
    shortLabel: 'Дл. отдых',
    usesCounter: true,
  },
  {
    value: 'short_rest',
    label: 'За короткий отдых',
    shortLabel: 'Кор. отдых',
    usesCounter: true,
  },
  {
    value: 'resource',
    label: 'За ресурс класса (Пси-очки / Ци / Заряды)',
    shortLabel: 'За ресурс',
    usesCounter: true,
  },
  {
    value: 'ritual_only',
    label: 'Только ритуалом (+10 мин, без ячейки)',
    shortLabel: 'Ритуал',
    usesCounter: false,
  },
  {
    value: 'custom',
    label: 'Особый источник / предмет / свиток',
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
  const neutralTag = 'bg-raised border-border text-secondary';

  if (m === 'at_will') {
    return {
      text: note ? `∞ · ${note}` : 'Неограниченно',
      className: neutralTag,
    };
  }
  if (m === 'long_rest') {
    return {
      text: `${maxUses}/дл. отд.${note ? ` · ${note}` : ''}`,
      className: neutralTag,
    };
  }
  if (m === 'short_rest') {
    return {
      text: `${maxUses}/кор. отд.${note ? ` · ${note}` : ''}`,
      className: neutralTag,
    };
  }
  if (m === 'resource') {
    return {
      text: note ? `${maxUses} × ${note}` : `${maxUses} ед. ресурса`,
      className: neutralTag,
    };
  }
  if (m === 'ritual_only') {
    return {
      text: 'Ритуал',
      className: neutralTag,
    };
  }
  if (m === 'custom') {
    return {
      text: note ? `${note} (${maxUses})` : `Особое (${maxUses})`,
      className: neutralTag,
    };
  }

  if (level === 0) {
    return {
      text: 'Заговор',
      className: 'bg-bg border-border text-muted',
    };
  }
  return {
    text: 'Ячейка',
    className: 'bg-bg border-border text-muted',
  };
}
