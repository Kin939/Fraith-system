import { createShapeId, toRichText, type Editor, type TLShapeId } from 'tldraw';

/**
 * Библиотека шаблонов «Доски».
 *
 * Встроенные шаблоны собираются из нативных фигур tldraw (sticky, geo, frame, arrow
 * с биндингами) — поэтому они полностью редактируемы, экспортируются и попадают
 * в общий документ доски. Пользовательские шаблоны Мастера (D1) применяются через
 * `editor.putContentOntoCurrentPage` в TemplatePicker.
 */

type Color = 'black' | 'grey' | 'light-violet' | 'violet' | 'blue' | 'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green' | 'red' | 'light-red' | 'white';
type Geo = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'hexagon' | 'cloud' | 'star' | 'x-box' | 'check-box' | 'oval';

interface BoxOptions {
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: Color;
  fill?: 'none' | 'semi' | 'solid' | 'pattern';
  dash?: 'draw' | 'dashed' | 'dotted' | 'solid';
  geo?: Geo;
  size?: 's' | 'm' | 'l' | 'xl';
  font?: 'draw' | 'sans' | 'serif' | 'mono';
  align?: 'start' | 'middle' | 'end';
}

export function createBox(editor: Editor, opts: BoxOptions): TLShapeId {
  const id = createShapeId();
  editor.createShape({
    id,
    type: 'geo',
    x: opts.x,
    y: opts.y,
    props: {
      geo: opts.geo ?? 'rectangle',
      w: opts.w ?? 220,
      h: opts.h ?? 120,
      color: opts.color ?? 'blue',
      fill: opts.fill ?? 'semi',
      dash: opts.dash ?? 'draw',
      size: opts.size ?? 'm',
      font: opts.font ?? 'sans',
      align: opts.align ?? 'middle',
      verticalAlign: 'middle',
      richText: toRichText(opts.text ?? ''),
    },
  });
  return id;
}

export function createSticky(
  editor: Editor,
  opts: { x: number; y: number; text?: string; color?: Color; size?: 's' | 'm' | 'l' }
): TLShapeId {
  const id = createShapeId();
  editor.createShape({
    id,
    type: 'note',
    x: opts.x,
    y: opts.y,
    props: {
      color: opts.color ?? 'yellow',
      size: opts.size ?? 'm',
      font: 'sans',
      align: 'start',
      richText: toRichText(opts.text ?? ''),
    },
  });
  return id;
}

export function createHeading(editor: Editor, opts: { x: number; y: number; text: string; size?: 's' | 'm' | 'l' | 'xl'; color?: Color }): TLShapeId {
  const id = createShapeId();
  editor.createShape({
    id,
    type: 'text',
    x: opts.x,
    y: opts.y,
    props: {
      richText: toRichText(opts.text),
      size: opts.size ?? 'l',
      font: 'sans',
      color: opts.color ?? 'white',
      textAlign: 'start',
    },
  });
  return id;
}

export function createFrame(
  editor: Editor,
  opts: { x: number; y: number; w: number; h: number; name: string }
): TLShapeId {
  const id = createShapeId();
  editor.createShape({
    id,
    type: 'frame',
    x: opts.x,
    y: opts.y,
    props: { w: opts.w, h: opts.h, name: opts.name },
  });
  return id;
}

export function createConnector(
  editor: Editor,
  opts: {
    from: TLShapeId;
    to: TLShapeId;
    label?: string;
    color?: Color;
    dash?: 'draw' | 'dashed' | 'dotted' | 'solid';
    arrowheadStart?: 'none' | 'arrow';
    arrowheadEnd?: 'none' | 'arrow';
    bend?: number;
  }
): TLShapeId {
  const fromBounds = editor.getShapePageBounds(opts.from);
  const toBounds = editor.getShapePageBounds(opts.to);
  const start = fromBounds
    ? { x: fromBounds.maxX, y: fromBounds.center.y }
    : { x: 0, y: 0 };
  const end = toBounds ? { x: toBounds.minX, y: toBounds.center.y } : { x: 100, y: 0 };

  const id = createShapeId();
  editor.createShape({
    id,
    type: 'arrow',
    x: start.x,
    y: start.y,
    props: {
      start: { x: 0, y: 0 },
      end: { x: end.x - start.x, y: end.y - start.y },
      color: opts.color ?? 'grey',
      dash: opts.dash ?? 'draw',
      arrowheadStart: opts.arrowheadStart ?? 'none',
      arrowheadEnd: opts.arrowheadEnd ?? 'arrow',
      text: opts.label ?? '',
      bend: opts.bend ?? 0,
      size: 'm',
    },
  });

  editor.createBindings([
    {
      type: 'arrow',
      fromId: id,
      toId: opts.from,
      props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isExact: false, isPrecise: false },
    },
    {
      type: 'arrow',
      fromId: id,
      toId: opts.to,
      props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isExact: false, isPrecise: false },
    },
  ]);

  return id;
}

export interface BuiltinTemplate {
  id: string;
  name: string;
  category: 'thinking' | 'planning' | 'dnd' | 'layout';
  hint: string;
  build: (editor: Editor, origin: { x: number; y: number }) => void;
}

const grid = (origin: { x: number; y: number }, col: number, row: number, dx: number, dy: number) => ({
  x: origin.x + col * dx,
  y: origin.y + row * dy,
});

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'mindmap',
    name: 'Интеллект-карта',
    category: 'thinking',
    hint: 'Центральная тема + ветви с авто-связями',
    build: (editor, origin) => {
      createHeading(editor, { x: origin.x, y: origin.y - 90, text: 'Интеллект-карта', size: 'l' });
      const center = createBox(editor, {
        ...grid(origin, 1, 1, 300, 170),
        text: 'Центральная идея',
        color: 'violet',
        fill: 'solid',
        w: 260,
        h: 120,
      });
      const branches: Array<[string, number, number, Color]> = [
        ['Ветвь 1', 0, 0, 'blue'],
        ['Ветвь 2', 2, 0, 'green'],
        ['Ветвь 3', 0, 2, 'yellow'],
        ['Ветвь 4', 2, 2, 'orange'],
      ];
      branches.forEach(([text, col, row, color]) => {
        const node = createBox(editor, {
          ...grid(origin, col, row, 300, 170),
          text,
          color,
          fill: 'semi',
          w: 240,
          h: 100,
          geo: 'rectangle',
        });
        createConnector(editor, {
          from: row === 2 ? node : center,
          to: row === 2 ? center : node,
          arrowheadEnd: 'arrow',
          color: 'grey',
        });
      });
    },
  },
  {
    id: 'flowchart',
    name: 'Блок-схема процесса',
    category: 'thinking',
    hint: 'Старт → решение → ветки',
    build: (editor, origin) => {
      createHeading(editor, { x: origin.x, y: origin.y - 90, text: 'Блок-схема', size: 'l' });
      const start = createBox(editor, {
        ...grid(origin, 0, 1, 320, 160),
        text: 'Старт',
        geo: 'oval',
        color: 'green',
        w: 200,
        h: 90,
      });
      const step = createBox(editor, {
        ...grid(origin, 1, 1, 320, 160),
        text: 'Действие',
        color: 'blue',
        w: 220,
        h: 90,
      });
      const decision = createBox(editor, {
        ...grid(origin, 2, 1, 320, 160),
        text: 'Условие?',
        geo: 'diamond',
        color: 'yellow',
        w: 200,
        h: 140,
      });
      const yes = createBox(editor, {
        ...grid(origin, 3, 0, 320, 160),
        text: 'Да — успех',
        color: 'green',
        w: 220,
        h: 90,
      });
      const no = createBox(editor, {
        ...grid(origin, 3, 2, 320, 160),
        text: 'Нет — повтор',
        color: 'red',
        w: 220,
        h: 90,
      });
      createConnector(editor, { from: start, to: step });
      createConnector(editor, { from: step, to: decision });
      createConnector(editor, { from: decision, to: yes, label: 'да' });
      createConnector(editor, { from: decision, to: no, label: 'нет' });
    },
  },
  {
    id: 'kanban',
    name: 'Kanban-доска',
    category: 'planning',
    hint: 'Бэклог / В работе / Готово',
    build: (editor, origin) => {
      const columns: Array<[string, Color]> = [
        ['Бэклог', 'grey'],
        ['В работе', 'blue'],
        ['Готово', 'green'],
      ];
      columns.forEach(([title, color], index) => {
        const x = origin.x + index * 320;
        createFrame(editor, { x, y: origin.y, w: 290, h: 520, name: title });
        createHeading(editor, { x: x + 20, y: origin.y + 46, text: title, size: 'm', color: 'white' });
        createSticky(editor, { x: x + 20, y: origin.y + 100, text: 'Карточка', color });
      });
    },
  },
  {
    id: 'wireframe',
    name: 'Вайрфрейм экрана',
    category: 'layout',
    hint: 'Хедер, контент, сайдбар',
    build: (editor, origin) => {
      createBox(editor, {
        x: origin.x,
        y: origin.y,
        w: 960,
        h: 600,
        color: 'grey',
        fill: 'none',
        dash: 'dashed',
        text: '',
      });
      createBox(editor, { x: origin.x + 24, y: origin.y + 24, w: 912, h: 70, text: 'HEADER', color: 'grey', fill: 'semi', dash: 'dashed' });
      createBox(editor, { x: origin.x + 24, y: origin.y + 114, w: 200, h: 430, text: 'SIDEBAR', color: 'grey', fill: 'semi', dash: 'dashed' });
      createBox(editor, { x: origin.x + 244, y: origin.y + 114, w: 692, h: 280, text: 'HERO', color: 'grey', fill: 'semi', dash: 'dashed' });
      createBox(editor, { x: origin.x + 244, y: origin.y + 414, w: 330, h: 130, text: 'CARD', color: 'grey', fill: 'semi', dash: 'dashed' });
      createBox(editor, { x: origin.x + 594, y: origin.y + 414, w: 342, h: 130, text: 'CARD', color: 'grey', fill: 'semi', dash: 'dashed' });
    },
  },
  {
    id: 'retro',
    name: 'Ретроспектива',
    category: 'thinking',
    hint: 'Что получилось / что мешало / идеи',
    build: (editor, origin) => {
      const cols: Array<[string, Color]> = [
        ['Что получилось', 'green'],
        ['Что мешало', 'red'],
        ['Идеи', 'blue'],
      ];
      cols.forEach(([title, color], index) => {
        const x = origin.x + index * 320;
        createFrame(editor, { x, y: origin.y, w: 300, h: 560, name: title });
        createHeading(editor, { x: x + 18, y: origin.y + 44, text: title, size: 'm' });
        createSticky(editor, { x: x + 18, y: origin.y + 96, text: '…', color });
      });
    },
  },
  {
    id: 'swot',
    name: 'SWOT-анализ',
    category: 'thinking',
    hint: '4 квадранта',
    build: (editor, origin) => {
      const cells: Array<[string, number, number, Color]> = [
        ['S — Сильные стороны', 0, 0, 'green'],
        ['W — Слабые стороны', 1, 0, 'red'],
        ['O — Возможности', 0, 1, 'blue'],
        ['T — Угрозы', 1, 1, 'orange'],
      ];
      cells.forEach(([title, col, row, color]) => {
        createBox(editor, {
          x: origin.x + col * 360,
          y: origin.y + row * 300,
          w: 340,
          h: 280,
          text: title,
          color,
          fill: 'semi',
          align: 'start',
          size: 'm',
        });
      });
    },
  },
  {
    id: 'dungeon',
    name: 'Карта подземелья',
    category: 'dnd',
    hint: 'Комнаты, коридоры, сетка 5 фт',
    build: (editor, origin) => {
      createHeading(editor, { x: origin.x, y: origin.y - 80, text: 'Подземелье', size: 'l' });
      const rooms: Array<[string, number, number, number, number, Color]> = [
        ['Вход', 0, 0, 240, 180, 'grey'],
        ['Караул', 1, 0, 260, 180, 'blue'],
        ['Каверна', 0, 1, 320, 240, 'green'],
        ['Алтарь', 1, 1, 260, 240, 'violet'],
        ['Выход', 2, 1, 200, 180, 'orange'],
      ];
      const ids = rooms.map(([text, col, row, w, h, color]) =>
        createBox(editor, {
          x: origin.x + col * 360,
          y: origin.y + row * 280,
          w,
          h,
          text,
          color,
          fill: 'solid',
          dash: 'solid',
          align: 'start',
        })
      );
      createConnector(editor, { from: ids[0], to: ids[1], color: 'grey' });
      createConnector(editor, { from: ids[0], to: ids[2], color: 'grey' });
      createConnector(editor, { from: ids[2], to: ids[3], color: 'grey' });
      createConnector(editor, { from: ids[3], to: ids[4], color: 'grey' });
    },
  },
  {
    id: 'initiative',
    name: 'Трекер инициативы',
    category: 'dnd',
    hint: 'Порядок ходов боя',
    build: (editor, origin) => {
      createHeading(editor, { x: origin.x, y: origin.y - 80, text: 'Инициатива', size: 'l' });
      createFrame(editor, { x: origin.x, y: origin.y, w: 340, h: 460, name: 'Порядок ходов' });
      for (let index = 0; index < 6; index += 1) {
        createBox(editor, {
          x: origin.x + 18,
          y: origin.y + 50 + index * 64,
          w: 304,
          h: 54,
          text: `${index + 1}. Имя — иниц. — HP`,
          color: index === 0 ? 'violet' : 'grey',
          fill: 'semi',
          size: 's',
          align: 'start',
        });
      }
      createBox(editor, {
        x: origin.x + 380,
        y: origin.y,
        w: 260,
        h: 200,
        text: 'Раунд: 1\nХод: —',
        color: 'blue',
        fill: 'semi',
        align: 'start',
      });
    },
  },
  {
    id: 'worldmap',
    name: 'Карта мира',
    category: 'dnd',
    hint: 'Регионы, города, маршруты',
    build: (editor, origin) => {
      createHeading(editor, { x: origin.x, y: origin.y - 80, text: 'Карта мира', size: 'l' });
      createBox(editor, {
        x: origin.x,
        y: origin.y,
        w: 1100,
        h: 700,
        color: 'green',
        fill: 'none',
        dash: 'draw',
        text: '',
        geo: 'rectangle',
      });
      const places: Array<[string, number, number, Color]> = [
        ['Столица', 120, 160, 'violet'],
        ['Порт', 760, 120, 'blue'],
        ['Лес', 380, 420, 'green'],
        ['Руины', 860, 480, 'orange'],
      ];
      const ids = places.map(([text, dx, dy, color]) =>
        createBox(editor, { x: origin.x + dx, y: origin.y + dy, w: 180, h: 80, text, color, geo: 'ellipse' })
      );
      createConnector(editor, { from: ids[0], to: ids[1], color: 'grey', dash: 'dashed' });
      createConnector(editor, { from: ids[0], to: ids[2], color: 'grey', dash: 'dashed' });
      createConnector(editor, { from: ids[2], to: ids[3], color: 'grey', dash: 'dashed' });
    },
  },
  {
    id: 'table',
    name: 'Таблица',
    category: 'layout',
    hint: '4×4 редактируемых ячеек',
    build: (editor, origin) => {
      const cols = 4;
      const rows = 4;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          createBox(editor, {
            x: origin.x + col * 200,
            y: origin.y + row * 70,
            w: 200,
            h: 70,
            text: row === 0 ? `Колонка ${col + 1}` : '',
            color: row === 0 ? 'blue' : 'grey',
            fill: row === 0 ? 'semi' : 'none',
            dash: 'solid',
            size: 's',
            align: 'start',
          });
        }
      }
    },
  },
  {
    id: 'card',
    name: 'Карточка объекта',
    category: 'layout',
    hint: 'Заголовок, описание, теги',
    build: (editor, origin) => {
      const frame = createFrame(editor, { x: origin.x, y: origin.y, w: 360, h: 320, name: 'Карточка' });
      createBox(editor, {
        x: origin.x + 16,
        y: origin.y + 44,
        w: 328,
        h: 60,
        text: 'Заголовок',
        color: 'violet',
        fill: 'semi',
        size: 'm',
        align: 'start',
      });
      createBox(editor, {
        x: origin.x + 16,
        y: origin.y + 114,
        w: 328,
        h: 130,
        text: 'Описание: что это, зачем, что делать дальше.',
        color: 'grey',
        fill: 'none',
        size: 's',
        align: 'start',
      });
      ['#тег', '#тег', '+ тег'].forEach((tag, index) => {
        createSticky(editor, {
          x: origin.x + 16 + index * 110,
          y: origin.y + 254,
          text: tag,
          color: 'light-blue',
          size: 's',
        });
      });
      editor.select(frame);
    },
  },
  {
    id: 'document',
    name: 'Документ',
    category: 'layout',
    hint: 'Заголовок + структурированный текст',
    build: (editor, origin) => {
      createHeading(editor, { x: origin.x, y: origin.y, text: 'Заголовок документа', size: 'xl' });
      createHeading(editor, {
        x: origin.x,
        y: origin.y + 70,
        text: 'Подзаголовок: опишите цель, участников и следующий шаг.',
        size: 'm',
        color: 'grey',
      });
      createSticky(editor, { x: origin.x, y: origin.y + 150, text: '• пункт списка\n• пункт списка\n• ссылка: https://', color: 'white', size: 'l' });
    },
  },
];

/**
 * Мелкий «mind map»-помощник: добавляет дочерний узел справа от выбранного
 * и связывает его стрелкой с автоматическим размещением (без наложений).
 */
export function addMindMapChild(editor: Editor): TLShapeId | null {
  const selected = editor.getSelectedShapes()[0] ?? editor.getCurrentPageShapes().at(-1);
  if (!selected) return null;
  const bounds = editor.getShapePageBounds(selected);
  if (!bounds) return null;

  const siblings = editor
    .getCurrentPageShapes()
    .filter((shape) => shape.id !== selected.id)
    .map((shape) => editor.getShapePageBounds(shape))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .filter((b) => b.minX > bounds.maxX - 40);

  let y = bounds.minY;
  for (const sibling of siblings.sort((a, b) => a.minY - b.minY)) {
    if (Math.abs(sibling.minY - y) < 80 && sibling.minX < bounds.maxX + 420) {
      y = Math.max(y, sibling.maxY + 30);
    }
  }

  const child = createBox(editor, {
    x: bounds.maxX + 140,
    y,
    w: 220,
    h: 90,
    text: 'Новый узел',
    color: 'blue',
    fill: 'semi',
  });
  createConnector(editor, { from: selected.id, to: child, color: 'grey' });
  editor.select(child);
  return child;
}
