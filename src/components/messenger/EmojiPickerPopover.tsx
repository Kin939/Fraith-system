import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Search, X } from 'lucide-react';

export const QUICK_REACTION_EMOJIS = ['👍', '🔥', '🎲', '⚔️', '❤️', '😂', '👀', '✅'];

interface EmojiEntry {
  char: string;
  keywords: string;
}

interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  items: EmojiEntry[];
}

const RECENT_STORAGE_KEY = 'fraith_recent_emojis_v1';

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Эмоции',
    icon: '😀',
    items: [
      { char: '😀', keywords: 'улыбка радость привет' },
      { char: '😄', keywords: 'смех радость веселье' },
      { char: '😁', keywords: 'ухмылка довольный' },
      { char: '😂', keywords: 'смех слезы ржач лол' },
      { char: '🤣', keywords: 'катаюсь смех хаха' },
      { char: '🙂', keywords: 'улыбка ок спокойно' },
      { char: '😉', keywords: 'подмигивание намек' },
      { char: '😎', keywords: 'крутой очки крит успех' },
      { char: '🥳', keywords: 'праздник уровень победа сбор' },
      { char: '🤩', keywords: 'звезды восторг эпик' },
      { char: '🤔', keywords: 'думаю план загадка вопрос' },
      { char: '🤨', keywords: 'подозрение проверка проницательность' },
      { char: '😐', keywords: 'нейтрально покерфейс' },
      { char: '😬', keywords: 'неловко провал единица' },
      { char: '🙄', keywords: 'закатил глаза опять' },
      { char: '😴', keywords: 'сон долгий отдых спать поздно' },
      { char: '🤯', keywords: 'взрыв мозга сюжет поворот' },
      { char: '😱', keywords: 'ужас страх крик босс' },
      { char: '😢', keywords: 'грусть слеза жаль не могу' },
      { char: '😭', keywords: 'плач рыдаю смерть персонажа' },
      { char: '😤', keywords: 'злость ярость варвар' },
      { char: '😡', keywords: 'гнев ярость бой' },
      { char: '😈', keywords: 'дьявол коварный мастер план' },
      { char: '🤡', keywords: 'клоун бард шутка' },
      { char: '👻', keywords: 'призрак нежить дух' },
      { char: '💀', keywords: 'череп смерть крит провал нежить' },
      { char: '👀', keywords: 'глаза смотрю внимание восприятие' },
      { char: '🫡', keywords: 'честь готов есть так точно' },
    ],
  },
  {
    id: 'dnd',
    label: 'D&D и поход',
    icon: '🎲',
    items: [
      { char: '🎲', keywords: 'кубик d20 бросок игра сессия' },
      { char: '⚔️', keywords: 'мечи бой битва атака инициатива' },
      { char: '🗡️', keywords: 'кинжал меч клинок плут' },
      { char: '🛡️', keywords: 'щит защита кд танк паладин' },
      { char: '🏹', keywords: 'лук стрела следопыт выстрел' },
      { char: '🪓', keywords: 'топор секира варвар' },
      { char: '🪄', keywords: 'палочка магия заклинание фокус' },
      { char: '🔮', keywords: 'шар магия прорицание колдун' },
      { char: '📜', keywords: 'свиток квест задание заклинание' },
      { char: '📖', keywords: 'книга гримуар правила история' },
      { char: '🧪', keywords: 'зелье лечение алхимия флакон' },
      { char: '💎', keywords: 'алмаз камень лут сокровище золото' },
      { char: '🪙', keywords: 'монета золото деньги награда' },
      { char: '👑', keywords: 'корона мастер король босс' },
      { char: '🏰', keywords: 'замок крепость город локация' },
      { char: '🗺️', keywords: 'карта поход маршрут мир' },
      { char: '🧭', keywords: 'компас путь направление поиск' },
      { char: '🕯️', keywords: 'свеча подземелье тьма ритуал' },
      { char: '🔥', keywords: 'огонь фаербол пламя костер' },
      { char: '⚡', keywords: 'молния урон гром энергия' },
      { char: '❄️', keywords: 'снег лед холод урон' },
      { char: '✨', keywords: 'искры вдохновение магия свет' },
      { char: '🐉', keywords: 'дракон босс чудовище монстр' },
      { char: '🧙', keywords: 'маг волшебник мастер' },
      { char: '🧝', keywords: 'эльф персонаж герой' },
      { char: '🧛', keywords: 'вампир страд нежить' },
      { char: '🧟', keywords: 'зомби нежить враг' },
      { char: '🕷️', keywords: 'паук подземелье дроу' },
    ],
  },
  {
    id: 'gestures',
    label: 'Жесты',
    icon: '👍',
    items: [
      { char: '👍', keywords: 'да класс согласен за плюс' },
      { char: '👎', keywords: 'нет против минус не могу' },
      { char: '👌', keywords: 'ок отлично договорились' },
      { char: '✌️', keywords: 'мир победа два' },
      { char: '🤞', keywords: 'удача спасбросок надеюсь' },
      { char: '🤝', keywords: 'рукопожатие сделка договор союз' },
      { char: '👏', keywords: 'аплодисменты браво красиво' },
      { char: '🙌', keywords: 'ура руки вверх победа' },
      { char: '🙏', keywords: 'пожалуйста спасибо молитва жрец' },
      { char: '💪', keywords: 'сила мощь атлетика готов' },
      { char: '👋', keywords: 'привет пока машу' },
      { char: '✋', keywords: 'стоп рука я могу пауза' },
      { char: '☝️', keywords: 'внимание идея вопрос' },
      { char: '👇', keywords: 'внизу смотри опрос ниже' },
      { char: '🤦', keywords: 'фейспалм рукалицо провал' },
      { char: '🤷', keywords: 'не знаю все равно как скажете' },
    ],
  },
  {
    id: 'schedule',
    label: 'Сборы и еда',
    icon: '📅',
    items: [
      { char: '📅', keywords: 'календарь дата сбор день неделя' },
      { char: '🗓️', keywords: 'расписание график план выходные' },
      { char: '⏰', keywords: 'будильник время вечер начало' },
      { char: '⏳', keywords: 'песочные часы ожидание скоро опоздаю' },
      { char: '📌', keywords: 'булавка важно закрепить место' },
      { char: '🏠', keywords: 'дом оффлайн собираемся вживую' },
      { char: '🎧', keywords: 'наушники дискорд онлайн связь микрофон' },
      { char: '🍕', keywords: 'пицца еда заказ перекус' },
      { char: '🍔', keywords: 'бургер еда ужин' },
      { char: '🍟', keywords: 'картошка снеки закуска' },
      { char: '🍣', keywords: 'роллы суши доставка' },
      { char: '☕', keywords: 'кофе чай перерыв утро' },
      { char: '🍵', keywords: 'чай кружка вечер' },
      { char: '🍺', keywords: 'пиво кружка таверна эль' },
      { char: '🍻', keywords: 'кружки тост таверна сбор' },
      { char: '🎂', keywords: 'торт праздник день рождения' },
    ],
  },
  {
    id: 'symbols',
    label: 'Символы',
    icon: '✅',
    items: [
      { char: '✅', keywords: 'галочка готов смогу да сделано' },
      { char: '❌', keywords: 'крестик нет отмена не смогу' },
      { char: '❓', keywords: 'вопрос под вопросом не точно' },
      { char: '❗', keywords: 'важно внимание срочно' },
      { char: '❤️', keywords: 'сердце здоровье хп любовь спасибо' },
      { char: '🖤', keywords: 'черное сердце тьма' },
      { char: '💔', keywords: 'разбитое сердце ноль хп боль' },
      { char: '💯', keywords: 'сто процентов точно полностью' },
      { char: '🎯', keywords: 'мишень точно в цель попадание' },
      { char: '🏆', keywords: 'кубок трофей награда победа' },
      { char: '🎉', keywords: 'хлопушка ура праздник свершилось' },
      { char: '💤', keywords: 'сон отдых афк' },
      { char: '🔔', keywords: 'колокольчик напоминание сбор пинг' },
      { char: '📎', keywords: 'скрепка файл документ лист' },
      { char: '➕', keywords: 'плюс добавить за' },
      { char: '➖', keywords: 'минус убрать пас' },
    ],
  },
];

function loadRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return QUICK_REACTION_EMOJIS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, 16);
    }
  } catch {
    // ignore storage errors
  }
  return QUICK_REACTION_EMOJIS;
}

export function recordRecentEmoji(emoji: string): void {
  try {
    const current = loadRecentEmojis().filter((e) => e !== emoji);
    const updated = [emoji, ...current].slice(0, 16);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  compact?: boolean;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  onSelect,
  onClose,
  align = 'right',
  compact = false,
}) => {
  const [activeCat, setActiveCat] = useState<string>('smileys');
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<string[]>(() => loadRecentEmojis());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const seen = new Set<string>();
      const matches: string[] = [];
      for (const cat of EMOJI_CATEGORIES) {
        for (const item of cat.items) {
          if (
            !seen.has(item.char) &&
            (item.keywords.includes(q) || item.char.includes(q))
          ) {
            seen.add(item.char);
            matches.push(item.char);
          }
        }
      }
      return matches;
    }
    if (activeCat === 'recent') {
      return recents;
    }
    const found = EMOJI_CATEGORIES.find((c) => c.id === activeCat);
    return found ? found.items.map((i) => i.char) : [];
  }, [activeCat, recents, search]);

  const handlePick = (emoji: string) => {
    recordRecentEmoji(emoji);
    setRecents(loadRecentEmojis());
    onSelect(emoji);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-full mb-2 ${
        align === 'right' ? 'right-0' : 'left-0'
      } z-40 w-[308px] sm:w-[332px] bg-surface border border-border hud-cut-sm shadow-glass flex flex-col overflow-hidden`}
    >
      {/* Header + Search */}
      <div className="p-2.5 border-b border-border space-y-2 bg-deep">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-secondary">Эмодзи</span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text p-0.5 transition-colors"
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск (кубик, огонь, дата…)"
            className="anime-input w-full pl-8 pr-2.5 py-1.5 text-xs"
          />
        </div>

        {/* Category Tabs */}
        {!search.trim() && (
          <div className="flex items-center gap-1 overflow-x-auto pt-0.5">
            <button
              type="button"
              onClick={() => setActiveCat('recent')}
              title="Недавние"
              className={`h-7 px-2 text-xs flex items-center gap-1 border transition-colors shrink-0 ${
                activeCat === 'recent'
                  ? 'bg-raised border-primary/50 text-text'
                  : 'bg-surface border-border text-muted hover:text-text'
              }`}
            >
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                title={cat.label}
                className={`h-7 px-2 text-xs flex items-center gap-1 border transition-colors shrink-0 ${
                  activeCat === cat.id
                    ? 'bg-raised border-primary/50 text-text font-medium'
                    : 'bg-surface border-border text-secondary hover:text-text'
                }`}
              >
                <span className="text-sm leading-none">{cat.icon}</span>
                {!compact && <span className="hidden sm:inline text-[11px]">{cat.label}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Label */}
      <div className="px-3 pt-2 pb-1 text-[11px] text-muted flex items-center justify-between">
        <span>
          {search.trim()
            ? `Найдено: ${filteredItems.length}`
            : activeCat === 'recent'
              ? 'Недавние'
              : EMOJI_CATEGORIES.find((c) => c.id === activeCat)?.label}
        </span>
        <span className="text-[11px] text-muted">Нажмите для вставки</span>
      </div>

      {/* Emoji Grid */}
      <div className="p-2 pt-1 max-h-56 overflow-y-auto grid grid-cols-8 gap-1">
        {filteredItems.length === 0 ? (
          <div className="col-span-8 py-6 text-center text-xs text-muted">
            Ничего не найдено
          </div>
        ) : (
          filteredItems.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handlePick(emoji)}
              className="h-9 w-full flex items-center justify-center text-lg hover:bg-raised border border-transparent hover:border-border transition-colors rounded-sm"
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
