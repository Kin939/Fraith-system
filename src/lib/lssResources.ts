export type ResourceColorKey = 'violet' | 'cyan' | 'amber' | 'crimson' | 'emerald';

export type ResourceRecoverMode = 'all' | 'half_up' | 'half_down' | 'one';

export interface LssResourcePreset {
  key: string;
  category: 'rogue_mystic' | 'classic' | 'homebrew';
  title: string;
  subtitle: string;
  glyph: string;
  color: ResourceColorKey;
  build: (ctx: { level: number; prof: number }) => {
    name: string;
    max: number;
    maxExpr: string;
    die: string;
    spendLimit: number;
    isShortRest: boolean;
    isLongRest: boolean;
    recoverMode: ResourceRecoverMode;
    notes: string;
  };
}

const MYSTIC_PSI_POINTS_BY_LEVEL: Record<number, number> = {
  1: 4,
  2: 6,
  3: 14,
  4: 17,
  5: 27,
  6: 32,
  7: 38,
  8: 44,
  9: 57,
  10: 64,
  11: 64,
  12: 64,
  13: 64,
  14: 64,
  15: 64,
  16: 64,
  17: 64,
  18: 71,
  19: 71,
  20: 71,
};

export function getMysticPsiMax(level: number): number {
  const lvl = Math.min(20, Math.max(1, Math.trunc(level)));
  return MYSTIC_PSI_POINTS_BY_LEVEL[lvl] ?? 4;
}

export function getMysticPsiLimit(level: number): number {
  if (level >= 9) return 7;
  if (level >= 7) return 6;
  if (level >= 5) return 5;
  if (level >= 3) return 3;
  return 2;
}

export const RESOURCE_COLOR_STYLES: Record<
  ResourceColorKey,
  {
    badge: string;
    pipFilled: string;
    pipEmpty: string;
    bar: string;
    rollBtn: string;
  }
> = {
  amber: {
    badge: 'bg-amber-500/15 border-amber-400/40 text-amber-200',
    pipFilled: 'bg-amber-400 border-amber-200 shadow-sm',
    pipEmpty: 'bg-bg border-border hover:border-amber-400/70',
    bar: 'bg-gradient-to-r from-amber-500 to-yellow-300',
    rollBtn: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50 text-amber-200',
  },
  cyan: {
    badge: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200',
    pipFilled: 'bg-cyan-400 border-cyan-100 shadow-sm',
    pipEmpty: 'bg-bg border-border hover:border-cyan-400/70',
    bar: 'bg-gradient-to-r from-cyan-500 to-sky-300',
    rollBtn: 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/50 text-cyan-200',
  },
  violet: {
    badge: 'bg-purple-500/15 border-purple-400/40 text-purple-200',
    pipFilled: 'bg-purple-400 border-purple-200 shadow-sm',
    pipEmpty: 'bg-bg border-border hover:border-purple-400/70',
    bar: 'bg-gradient-to-r from-purple-500 to-fuchsia-400',
    rollBtn: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/50 text-purple-200',
  },
  crimson: {
    badge: 'bg-rose-500/15 border-rose-400/40 text-rose-200',
    pipFilled: 'bg-rose-500 border-rose-200 shadow-sm',
    pipEmpty: 'bg-bg border-border hover:border-rose-400/70',
    bar: 'bg-gradient-to-r from-rose-600 to-orange-400',
    rollBtn: 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50 text-rose-200',
  },
  emerald: {
    badge: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200',
    pipFilled: 'bg-emerald-400 border-emerald-100 shadow-sm',
    pipEmpty: 'bg-bg border-border hover:border-emerald-400/70',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-300',
    rollBtn: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200',
  },
};

export const LSS_RESOURCE_PRESETS: LssResourcePreset[] = [
  {
    key: 'rogue-sneak-dice',
    category: 'rogue_mystic',
    title: 'Кости Скрытой атаки (Плут)',
    subtitle: 'Авто-пул к6 по уровню плута (1 раз в ход)',
    glyph: 'blades',
    color: 'amber',
    build: ({ level }) => {
      const diceCount = Math.max(1, Math.ceil(level / 2));
      return {
        name: 'Кости Скрытой атаки',
        max: 1,
        maxExpr: '1',
        die: `${diceCount}к6`,
        spendLimit: 0,
        isShortRest: true,
        isLongRest: true,
        recoverMode: 'all',
        notes: 'Доп. урон 1 раз в ход при преимуществе или союзнике рядом с целью.',
      };
    },
  },
  {
    key: 'rogue-psi-knives',
    category: 'rogue_mystic',
    title: 'Псионические кости энергии (Душегуб / Пси-воин)',
    subtitle: '2 × БМ костей к6–к12 + быстрый бросок с тратой',
    glyph: 'orb',
    color: 'cyan',
    build: ({ level, prof }) => {
      const dieSides = level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6;
      return {
        name: 'Псионические кости энергии',
        max: prof * 2,
        maxExpr: '2*[PROF]',
        die: `1к${dieSides}`,
        spendLimit: 0,
        isShortRest: false,
        isLongRest: true,
        recoverMode: 'all',
        notes: 'Пул 2×БМ костей; 1 кость можно восстановить бонусным действием раз в кор. отдых.',
      };
    },
  },
  {
    key: 'mystic-psi-charges',
    category: 'rogue_mystic',
    title: 'Пси-заряды / Пси-очки (Мистик HB)',
    subtitle: 'Шкала пси-энергии + Пси-лимит траты за раз',
    glyph: 'orb',
    color: 'cyan',
    build: ({ level }) => ({
      name: 'Пси-заряды (Мистик)',
      max: getMysticPsiMax(level),
      maxExpr: '',
      die: '',
      spendLimit: getMysticPsiLimit(level),
      isShortRest: false,
      isLongRest: true,
      recoverMode: 'all',
      notes: `Псионический резерв Мистика. Пси-лимит на ${level} ур.: не более ${getMysticPsiLimit(level)} пси-зарядов на дисциплину.`,
    }),
  },
  {
    key: 'battlemaster-dice',
    category: 'classic',
    title: 'Кости превосходства (Воин)',
    subtitle: '4–6 костей к8/к10/к12 • Короткий отдых',
    glyph: 'blades',
    color: 'crimson',
    build: ({ level }) => ({
      name: 'Кости превосходства',
      max: level >= 15 ? 6 : level >= 7 ? 5 : 4,
      maxExpr: '',
      die: level >= 18 ? '1к12' : level >= 10 ? '1к10' : '1к8',
      spendLimit: 0,
      isShortRest: true,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Тратятся на боевые приёмы Мастера боевых искусств.',
    }),
  },
  {
    key: 'monk-ki',
    category: 'classic',
    title: 'Очки Ци / Фокуса (Монах)',
    subtitle: '[LVL] зарядов + кость боевых искусств',
    glyph: 'spark',
    color: 'cyan',
    build: ({ level }) => ({
      name: 'Очки Ци',
      max: level,
      maxExpr: '[LVL]',
      die: level >= 17 ? '1к10' : level >= 11 ? '1к8' : level >= 5 ? '1к6' : '1к4',
      spendLimit: 0,
      isShortRest: true,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Шквал ударов, Терпеливая оборона, Поступь ветра, Ошеломляющий удар.',
    }),
  },
  {
    key: 'sorcery-points',
    category: 'classic',
    title: 'Единицы чародейства (Чародей)',
    subtitle: '[LVL] единиц • Метамагия и гибкие ячейки',
    glyph: 'spark',
    color: 'violet',
    build: ({ level }) => ({
      name: 'Единицы чародейства',
      max: Math.max(2, level),
      maxExpr: '[LVL]',
      die: '',
      spendLimit: 0,
      isShortRest: false,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Тратятся на Метамагию и создание/конвертацию ячеек заклинаний.',
    }),
  },
  {
    key: 'bardic-inspiration',
    category: 'classic',
    title: 'Кости Вдохновения барда',
    subtitle: 'max(1,[CHA]) костей к6–к12',
    glyph: 'spark',
    color: 'amber',
    build: ({ level }) => ({
      name: 'Вдохновение барда',
      max: 3,
      maxExpr: 'max(1,[CHA])',
      die: level >= 15 ? '1к12' : level >= 10 ? '1к10' : level >= 5 ? '1к8' : '1к6',
      spendLimit: 0,
      isShortRest: level >= 5,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Бонусным действием дарует союзнику кость вдохновения (60 фт.).',
    }),
  },
  {
    key: 'barbarian-rage',
    category: 'classic',
    title: 'Ярость (Варвар)',
    subtitle: 'Заряды ярости за продолжительный отдых',
    glyph: 'flame',
    color: 'crimson',
    build: ({ level }) => ({
      name: 'Ярость',
      max: level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2,
      maxExpr: '',
      die: '',
      spendLimit: 0,
      isShortRest: false,
      isLongRest: true,
      recoverMode: 'all',
      notes: `Бонус урона ярости: +${level >= 16 ? 4 : level >= 9 ? 3 : 2}.`,
    }),
  },
  {
    key: 'blood-hunter-curses',
    category: 'homebrew',
    title: 'Проклятия крови и Гемокрафтия (Кровавый охотник HB)',
    subtitle: 'Заряды проклятий + кость гемокрафтии',
    glyph: 'flame',
    color: 'crimson',
    build: ({ level }) => ({
      name: 'Проклятия крови (Гемокрафтия)',
      max: level >= 17 ? 4 : level >= 13 ? 3 : level >= 6 ? 2 : 1,
      maxExpr: '',
      die: level >= 17 ? '1к10' : level >= 11 ? '1к8' : level >= 5 ? '1к6' : '1к4',
      spendLimit: 0,
      isShortRest: true,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Усиление проклятия наносит урон равный броску кости гемокрафтии.',
    }),
  },
  {
    key: 'magus-arcane-pool',
    category: 'homebrew',
    title: 'Мистический запас (Магус HB)',
    subtitle: 'Заряды Чародейского удара и усиления клинка',
    glyph: 'bolt',
    color: 'violet',
    build: ({ level }) => ({
      name: 'Мистический запас (Магус)',
      max: Math.max(2, Math.ceil(level / 2) + 2),
      maxExpr: 'max(1,ceil([LVL]/2)+[INT])',
      die: '',
      spendLimit: 0,
      isShortRest: false,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Усиление оружия и вливание заклинаний в рукопашный удар.',
    }),
  },
  {
    key: 'runekeeper-runes',
    category: 'homebrew',
    title: 'Рунические печати (Хранитель рун / Шаман HB)',
    subtitle: '[PROF] рунических зарядов • Короткий отдых',
    glyph: 'shield',
    color: 'emerald',
    build: ({ prof }) => ({
      name: 'Рунические заряды',
      max: prof,
      maxExpr: '[PROF]',
      die: '1к8',
      spendLimit: 0,
      isShortRest: true,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Активация начертанных рун и духовных тотемов.',
    }),
  },
  {
    key: 'alchemist-reagents',
    category: 'homebrew',
    title: 'Алхимические реагенты и Бомбы (Алхимик HB)',
    subtitle: '[LVL]+[INT] реагентов + урон бомбы',
    glyph: 'flame',
    color: 'emerald',
    build: ({ level }) => ({
      name: 'Алхимические реагенты',
      max: level + 3,
      maxExpr: '[LVL]+max(1,[INT])',
      die: `${Math.max(1, Math.ceil(level / 2))}к6+[INT]`,
      spendLimit: 0,
      isShortRest: false,
      isLongRest: true,
      recoverMode: 'all',
      notes: 'Создание эликсиров, настоев и метательных алхимических бомб.',
    }),
  },
];
