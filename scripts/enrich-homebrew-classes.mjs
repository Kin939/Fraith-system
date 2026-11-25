#!/usr/bin/env node
/**
 * Enriches public/data/dndsu-spells-official.json, public/data/dndsu-spells-homebrew.json,
 * and public/data/dndsu-filters.json with all 15 Homebrew classes from https://dnd.su/homebrew/class/
 * and their spellcasting subclasses, plus writes public/data/dndsu-homebrew-classes.json.
 *
 * Idempotent: strips any prior HB class/archetype tags before applying deterministic rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OFF_PATH = path.join(ROOT, 'public/data/dndsu-spells-official.json');
const HB_PATH = path.join(ROOT, 'public/data/dndsu-spells-homebrew.json');
const FILTERS_PATH = path.join(ROOT, 'public/data/dndsu-filters.json');
const META_PATH = path.join(ROOT, 'public/data/dndsu-homebrew-classes.json');

export const HOMEBREW_CLASSES = [
  {
    id: 395,
    key: 'Alchemist',
    nameRu: 'Алхимик',
    nameLower: 'алхимик',
    nameEn: 'Alchemist',
    source: "Valda's Spire of Secrets",
    url: 'https://dnd.su/homebrew/class/395-alchemist/',
    casterType: 'subclass',
  },
  {
    id: 853,
    key: 'AlternateBarbarian',
    nameRu: 'Альтернативный Варвар',
    nameLower: 'альтернативный варвар',
    nameEn: 'Alternate Barbarian',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/853-alternate-barbarian/',
    casterType: 'subclass',
  },
  {
    id: 382,
    key: 'AlternateFighter',
    nameRu: 'Альтернативный Воин',
    nameLower: 'альтернативный воин',
    nameEn: 'Alternate Fighter',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/382-alternate-fighter/',
    casterType: 'subclass',
  },
  {
    id: 391,
    key: 'AlternateMonk',
    nameRu: 'Альтернативный монах',
    nameLower: 'альтернативный монах',
    nameEn: 'Alternate Monk',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/391-alternate-monk/',
    casterType: 'subclass',
  },
  {
    id: 857,
    key: 'AlternateRogue',
    nameRu: 'Альтернативный Плут',
    nameLower: 'альтернативный плут',
    nameEn: 'Alternate Rogue',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/857-alternate-rogue/',
    casterType: 'subclass',
  },
  {
    id: 403,
    key: 'Warlord',
    nameRu: 'Воевода',
    nameLower: 'воевода',
    nameEn: 'Warlord',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/403-warlord/',
    casterType: 'subclass',
  },
  {
    id: 472,
    key: 'Jaeger',
    nameRu: 'Егерь',
    nameLower: 'егерь',
    nameEn: 'Jaeger',
    source: "Steinhardt's Guide to the Eldritch Hunt",
    url: 'https://dnd.su/homebrew/class/472-jaeger/',
    casterType: 'subclass',
  },
  {
    id: 565,
    key: 'Stargazer',
    nameRu: 'Звездочёт',
    nameLower: 'звездочёт',
    nameEn: 'Stargazer',
    source: 'morethanwordscansay',
    url: 'https://dnd.su/homebrew/class/565-stargazer/',
    casterType: 'full',
  },
  {
    id: 195,
    key: 'BloodHunter',
    nameRu: 'Кровавый охотник',
    nameLower: 'кровавый охотник',
    nameEn: 'Blood Hunter',
    source: 'Matt Mercer / Critical Role',
    url: 'https://dnd.su/homebrew/class/195-blood-hunter/',
    casterType: 'subclass',
  },
  {
    id: 277,
    key: 'Magus',
    nameRu: 'Магус',
    nameLower: 'магус',
    nameEn: 'Magus',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/277-magus/',
    casterType: 'half',
  },
  {
    id: 208,
    key: 'Mystic',
    nameRu: 'Мистик',
    nameLower: 'мистик',
    nameEn: 'Mystic',
    source: 'Unearthed Arcana',
    url: 'https://dnd.su/homebrew/class/208-mystic/',
    casterType: 'subclass',
  },
  {
    id: 202,
    key: 'LingeringSoul',
    nameRu: 'Неупокоенная душа',
    nameLower: 'неупокоенная душа',
    nameEn: 'The Lingering Soul',
    source: 'Matt Mercer / Critical Role',
    url: 'https://dnd.su/homebrew/class/202-the-lingering-soul/',
    casterType: 'feature',
  },
  {
    id: 401,
    key: 'Savant',
    nameRu: 'Савант',
    nameLower: 'савант',
    nameEn: 'Savant',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/401-savant/',
    casterType: 'subclass',
  },
  {
    id: 419,
    key: 'Runekeeper',
    nameRu: 'Хранитель рун',
    nameLower: 'хранитель рун',
    nameEn: 'Runekeeper',
    source: 'Dungeon Masters Guild',
    url: 'https://dnd.su/homebrew/class/419-runekeeper/',
    casterType: 'runic',
  },
  {
    id: 389,
    key: 'Shaman',
    nameRu: 'Шаман',
    nameLower: 'шаман',
    nameEn: 'Shaman',
    source: 'laserllama',
    url: 'https://dnd.su/homebrew/class/389-shaman/',
    casterType: 'pact',
  },
];

const HB_CLASS_ID_SET = new Set(HOMEBREW_CLASSES.map((c) => c.id));
const HB_CLASS_LOWER_SET = new Set(HOMEBREW_CLASSES.map((c) => c.nameLower));
const HB_CLASS_BY_ID = new Map(HOMEBREW_CLASSES.map((c) => [c.id, c]));

// Base class explicit spell lists
const BASE_CLASS_SPELLS = {
  // 277: Магус (Список заклинаний магуса 1–5 + Иссушение магии)
  277: [
    // 1st
    59, 15, 25, 27, 60, 379, 3047, 99, 388, 147, 5038, 195, 203, 207, 210, 223, 401, 257, 5039,
    286, 306, 315, 351, 466, 98, 86, 70,
    // 2nd
    5040, 20, 45, 62, 108, 383, 139, 148, 153, 159, 183, 190, 217, 218, 225, 226, 397, 295, 409,
    368, 352, 353, 355, 356, 5041,
    // 3rd
    376, 471, 83, 106, 5043, 384, 132, 474, 152, 162, 175, 205, 399, 249, 403, 5042, 301, 337,
    339, 100,
    // 4th
    477, 377, 38, 49, 380, 104, 116, 129, 202, 206, 216, 228, 260, 5304, 404, 308,
    // 5th
    5044, 484, 92, 385, 130, 133, 137, 176, 364, 300, 314, 493, 110,
  ],

  // 389: Шаман (Список заклинаний шамана 0–5 + Великие духи тотема 6–9 + Тотемы)
  389: [
    // 0th
    378, 374, 73, 101, 414, 140, 389, 396, 407, 4862, 336, 410, 454, 457, 4861, 105, 94, 80, 415, 63,
    // 1st
    9, 15, 462, 42, 59, 56, 3047, 72, 99, 382, 145, 177, 194, 211, 401, 248, 257, 276, 287, 254,
    312, 316, 351, 354, 4863, 98, 465, 69,
    // 2nd
    8, 18, 40, 48, 74, 108, 381, 146, 186, 255, 236, 242, 406, 298, 295, 323, 352, 4864, 353,
    413, 103, 77,
    // 3rd
    376, 41, 471, 58, 75, 83, 113, 4865, 106, 143, 162, 185, 475, 399, 238, 403, 280, 293, 301,
    304, 318, 326, 4866, 337, 339, 100,
    // 4th
    477, 17, 21, 377, 43, 49, 116, 151, 129, 206, 266, 404, 308, 482, 85,
    // 5th
    19, 375, 483, 484, 5574, 176, 191, 199, 231, 262, 282, 489, 300, 365, 494,
    // Великий дух тотема (6–9) + Тотемы
    209, 229, 412, 322, 250, 302, 6, 320, 398, 120, 263, 284, 329, 33, 330, 125,
    292, 294, 78, 355, 35, 196, 3063, 104, 3070, 212, 3068,
  ],

  // 565: Звездочёт (Список заклинаний звездочёта 0–5 + Астеризмы + высшие умения)
  565: [
    // 0th
    71, 26, 741, 154, 165, 234, 3050, 331, 332, 105, 91, 80, 7282,
    // 1st
    99, 144, 178, 182, 195, 210, 401, 252, 2444, 306, 313, 346, 98, 465, 70,
    // 2nd
    8, 2445, 20, 31, 40, 468, 139, 146, 155, 188, 391, 183, 192, 196, 218, 236, 349, 352, 102,
    // 3rd
    41, 44, 47, 58, 472, 106, 132, 152, 161, 185, 219, 249, 256, 285, 293, 301, 2448, 326, 339, 61,
    // 4th
    477, 116, 128, 142, 151, 478, 308, 325, 2449, 67,
    // 5th
    19, 484, 115, 119, 135, 137, 176, 189, 231, 3066, 489, 300, 309, 492, 494,
    // Астеризмы & Высшие звёздные дары (6–9)
    59, 248, 207, 223, 353, 153, 45, 473, 475, 228, 501, 330, 2453, 124,
  ],

  // 419: Хранитель рун (Магические руны и пробуждения всех рунических языков)
  419: [
    210, 29, 474, 3065, 364, 247,
    462, 467, 109, 142, 3819, 351,
    401, 152, 135, 325,
    386, 355, 197, 129, 57, 254,
    79, 3816, 113, 93,
    144, 155, 170, 104, 39, 311,
    145, 173, 24, 4, 208, 105,
    226, 100, 228,
    157, 295, 38, 281, 45,
    147, 148, 277, 43, 180,
    31, 221, 353, 301, 240, 13,
    35, 60,
  ],

  // 202: Неупокоенная душа (Сверхъестественное тело: Невидимость)
  202: [183],
};

// Subclass definitions (fArchetype >= 2001)
const HOMEBREW_ARCHETYPES = [
  // Кровавый охотник (195)
  {
    id: 2001,
    classId: 195,
    title: 'Орден осквернённых душ',
    predicate: (sp) =>
      hasOfficialClass(sp, 20) && sp.level <= 4,
    spellIds: [295, 349, 196, 225, 155, 139, 31, 255, 45, 83, 100, 205, 285, 24, 161, 106, 175, 293],
  },

  // Егерь (472)
  {
    id: 2002,
    classId: 472,
    title: 'Орден Еретиков',
    predicate: (sp) =>
      hasOfficialClass(sp, 20) && sp.level <= 4,
    spellIds: [3126, 3175],
  },
  {
    id: 2003,
    classId: 472,
    title: 'Орден Спасения',
    spellIds: [9],
  },

  // Алхимик (395)
  {
    id: 2004,
    classId: 395,
    title: 'Динамо-инженер',
    predicate: (sp) =>
      hasOfficialClass(sp, 21) &&
      (sp.level === 0 ||
        (sp.level >= 1 && sp.level <= 4 && hasAnySchool(sp, [2, 7]))),
    spellIds: [195, 248],
  },
  {
    id: 2005,
    classId: 395,
    title: 'Апотекарий',
    spellIds: [208, 155],
  },
  {
    id: 2006,
    classId: 395,
    title: 'Аморист',
    spellIds: [221, 326],
  },

  // Мистик (208)
  {
    id: 2007,
    classId: 208,
    title: 'Орден Ву Дзень',
    predicate: (sp) =>
      hasOfficialClass(sp, 21) && sp.level >= 1 && sp.level <= 3,
    spellIds: [],
  },

  // Магус (277) — 7 Эзотерических орденов
  {
    id: 2010,
    classId: 277,
    title: 'Орден Демиургов',
    predicate: (sp) => !sp.isHomebrew && hasOfficialClass(sp, 21) && sp.level === 0,
    spellIds: [5038, 248, 188, 350, 238, 474, 151, 128, 327, 176],
  },
  {
    id: 2011,
    classId: 277,
    title: 'Орден Мистических лучников',
    spellIds: [212, 50, 159, 81, 405, 174, 404, 308, 269, 14],
  },
  {
    id: 2012,
    classId: 277,
    title: 'Орден Танцоров Клинка',
    spellIds: [37, 466, 295, 352, 339, 100, 206, 308, 494, 493],
  },
  {
    id: 2013,
    classId: 277,
    title: 'Орден Затмения',
    spellIds: [157, 98, 8, 470, 44, 185, 266, 38, 93, 119, 183, 353],
  },
  {
    id: 2014,
    classId: 277,
    title: 'Орден Чешуи',
    spellIds: [401, 276, 467, 220, 339, 109, 239, 404, 282, 240, 80],
  },
  {
    id: 2015,
    classId: 277,
    title: 'Орден Стражей',
    spellIds: [37, 354, 236, 220, 158, 106, 17, 104, 262, 135],
  },
  {
    id: 2016,
    classId: 277,
    title: 'Орден Чароборцев',
    spellIds: [254, 194, 45, 349, 285, 152, 116, 325, 300, 231],
  },

  // Шаман (389) — 4 Спиритизма
  {
    id: 2017,
    classId: 389,
    title: 'Связующий проклятия',
    spellIds: [45, 148, 285, 277, 96, 32, 92, 486, 334],
  },
  {
    id: 2018,
    classId: 389,
    title: 'Воин духа',
    spellIds: [153, 11, 238, 3051, 340, 200, 309, 493],
  },
  {
    id: 2019,
    classId: 389,
    title: 'Знахарь',
    spellIds: [155, 220, 158, 24, 4, 104, 366, 39],
  },
  {
    id: 2020,
    classId: 389,
    title: 'Дикое сердце',
    spellIds: [259, 76, 267, 109, 239, 247, 110, 65],
  },

  // Звездочёт (565) — 4 Звёздных трина
  {
    id: 2021,
    classId: 565,
    title: 'Трин воды',
    spellIds: [145, 414, 155, 24, 377, 39],
  },
  {
    id: 2022,
    classId: 565,
    title: 'Трин воздуха',
    spellIds: [184, 415, 40, 238, 266, 160, 196, 218],
  },
  {
    id: 2023,
    classId: 565,
    title: 'Трин земли',
    spellIds: [389, 69, 74, 143, 129, 130],
  },
  {
    id: 2024,
    classId: 565,
    title: 'Трин огня',
    spellIds: [1, 374, 298, 205, 202, 181, 178],
  },

  // Хранитель рун (419)
  {
    id: 2025,
    classId: 419,
    title: 'Инфернальный язык',
    spellIds: [147, 148, 277, 43, 180, 3067, 124],
  },
  {
    id: 2026,
    classId: 419,
    title: 'Гоблинский язык',
    spellIds: [79, 3816, 113, 325, 93, 112, 154],
  },

  // Воевода (403)
  {
    id: 2027,
    classId: 403,
    title: 'Академия отваги',
    spellIds: [
      9, 25, 37, 462, 42, 56, 79, 157, 207, 221, 254, 276, 316, 98, 52,
      23, 28, 62, 218, 220, 400, 236, 349, 103, 102, 246, 153, 155,
      83, 156, 158, 185, 256, 301, 109, 100, 4865, 44, 187, 5043,
      4, 5, 479, 278, 308, 325, 104,
    ],
  },
  {
    id: 2028,
    classId: 403,
    title: 'Академия поклонения',
    spellIds: [
      457, 307, 311, 331, 94, 80, 101, 458, 459, 332, 461, 165,
      9, 37, 42, 99, 145, 178, 177, 276, 354, 69, 10, 286, 224, 52, 46,
      11, 45, 192, 220, 236, 353, 131, 246, 153, 155,
      3, 24, 75, 106, 156, 158, 326, 213, 269, 405,
      4, 5, 116, 340, 104, 200,
    ],
  },

  // Альтернативный Воин (382)
  {
    id: 2029,
    classId: 382,
    title: 'Колдовской клинок',
    spellIds: [
      154, 456, 457, 3050, 91, 101, 458, 459, 460, 63, 461, 165,
      1, 462, 59, 99, 177, 184, 194, 401, 254, 257, 287, 305, 312, 224, 70, 52, 15,
      62, 134, 148, 183, 190, 218, 226, 469, 470, 352, 353, 356,
      473, 197, 277, 301, 109, 213, 132, 47,
      477, 32, 116, 167, 478, 228, 96, 200,
    ],
  },
  {
    id: 2030,
    classId: 382,
    title: 'Мистик',
    spellIds: [
      27, 462, 56, 79, 386, 221, 276, 98, 286, 70,
      23, 31, 45, 134, 139, 196, 218, 469, 3053, 295, 102,
      83, 473, 3049, 161, 185, 197, 238, 256, 280, 109, 88, 61, 44, 4866,
      32, 151, 216, 479, 228, 278, 308, 325,
      344,
    ],
  },
  {
    id: 2031,
    classId: 382,
    title: 'Мистический рыцарь',
    spellIds: [
      461, 458, 101, 459, 460, 165, 307, 332, 26, 66, 91,
      1, 27, 37, 52, 59, 60, 99, 207, 223, 224, 401, 286, 315, 351, 466, 86, 70,
      381, 131, 153, 183, 226, 295, 352, 353, 355, 5040,
      471, 106, 132, 390, 205, 213, 249, 405, 301, 174,
      38, 104, 116, 206, 216, 200, 228,
    ],
  },
  {
    id: 2032,
    classId: 382,
    title: 'Лучник леса',
    spellIds: [123],
  },

  // Альтернативный монах (391)
  {
    id: 2033,
    classId: 391,
    title: 'Путь Ву Чжень',
    spellIds: [
      374, 378, 101, 123, 389, 149, 396, 407, 307, 410, 336, 348, 414, 415,
      1, 15, 25, 59, 379, 50, 388, 3022, 203, 212, 211, 401, 333, 351, 354,
      18, 48, 62, 74, 381, 383, 139, 225, 289, 406, 255, 409, 352, 356, 413, 77,
      376, 41, 471, 390, 162, 175, 384, 205, 399, 249, 404, 403, 272, 294, 304, 318, 337,
      21, 377, 49, 121, 129, 206, 216, 202, 411, 308, 482, 85,
    ],
  },
  {
    id: 2034,
    classId: 391,
    title: 'Путь тени',
    spellIds: [154, 353, 368, 8, 349, 38, 478],
  },
  {
    id: 2035,
    classId: 391,
    title: 'Путь света',
    spellIds: [307],
  },

  // Альтернативный Варвар (853)
  {
    id: 2036,
    classId: 853,
    title: 'Путь природы',
    spellIds: [
      378, 73, 123, 396, 407, 410, 348, 415, 374, 105, 389, 454, 414,
      1, 25, 37, 59, 379, 145, 177, 211, 401, 351, 212, 224, 52,
      62, 381, 255, 406, 413, 77, 153,
      376, 471, 162, 399, 403, 304, 337, 339, 85,
      21, 49, 206, 482, 411, 200,
    ],
  },
  {
    id: 2037,
    classId: 853,
    title: 'Путь чародейства',
    spellIds: [195, 355],
  },
  {
    id: 2038,
    classId: 853,
    title: 'Путь звериного сердца',
    spellIds: [76, 292, 199],
  },

  // Альтернативный Плут (857)
  {
    id: 2039,
    classId: 857,
    title: 'Каратель',
    spellIds: [
      9, 462, 42, 177, 178, 221, 252, 254, 257, 276, 354, 69, 37, 10, 224, 52, 46,
      23, 40, 45, 183, 192, 236, 469, 470, 349, 352, 353, 131, 247, 8,
      58, 238, 3051, 277, 285, 293, 301, 340, 109, 213, 4866,
      116, 96, 266, 5304, 104, 200,
    ],
  },
  {
    id: 2040,
    classId: 857,
    title: 'Мистический ловкач',
    spellIds: [
      26, 378, 149, 154, 396, 204, 234, 307, 331, 91, 66, 13, 458, 71, 459, 63,
      7, 462, 56, 79, 2018, 3946, 386, 157, 182, 184, 193, 195, 207, 210, 221, 223, 252, 254,
      306, 313, 463, 315, 316, 346, 351, 98, 12370, 248, 286,
      20, 3947, 23, 4760, 28, 31, 45, 134, 139, 3816, 183, 188, 218, 226, 3053, 4664, 295, 470,
      368, 349, 350, 352, 353, 355, 3939, 3948, 356, 102, 6579, 217, 29,
      3813, 4660, 473, 474, 161, 185, 197, 256, 301, 1923, 109, 132, 44,
      32, 38, 4663, 6578, 167, 479, 228, 3817, 308, 325,
    ],
  },
  {
    id: 2041,
    classId: 857,
    title: 'Искатель',
    predicate: (sp) => !sp.isHomebrew && Boolean(sp.ritual) && sp.level >= 1 && sp.level <= 5,
    spellIds: [],
  },
  {
    id: 2042,
    classId: 857,
    title: 'Кровавый клинок',
    spellIds: [185, 38],
  },
  {
    id: 2043,
    classId: 857,
    title: 'Фантом',
    spellIds: [293],
  },

  // Савант (401)
  {
    id: 2044,
    classId: 401,
    title: 'Рунописец',
    spellIds: [195, 210, 221, 276, 102, 132, 301],
  },
  {
    id: 2045,
    classId: 401,
    title: 'Философ',
    spellIds: [99],
  },

  // Неупокоенная душа (202)
  {
    id: 2046,
    classId: 202,
    title: 'Зов полтергейста',
    spellIds: [26],
  },
];

function hasOfficialClass(sp, cid) {
  return (
    (Array.isArray(sp.fClass) && sp.fClass.includes(cid)) ||
    (Array.isArray(sp.fClassTce) && sp.fClassTce.includes(cid))
  );
}

function hasAnySchool(sp, schoolIds) {
  return Array.isArray(sp.fSchool) && sp.fSchool.some((s) => schoolIds.includes(s));
}

function stripPriorHomebrewEnrichment(sp) {
  sp.classes = (sp.classes || []).filter((c) => !HB_CLASS_LOWER_SET.has(c.toLowerCase()));
  sp.fClass = (sp.fClass || []).filter((id) => !HB_CLASS_ID_SET.has(id));
  sp.fArchetype = (sp.fArchetype || []).filter((id) => id < 2000);

  if (sp.subclasses) {
    const parts = sp.subclasses
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((entry) => {
        const m = entry.match(/\(([^)]+)\)\s*$/);
        if (!m) return true;
        return !HB_CLASS_LOWER_SET.has(m[1].trim().toLowerCase());
      });
    sp.subclasses = parts.join(', ');
  }
}

function main() {
  const official = JSON.parse(fs.readFileSync(OFF_PATH, 'utf8'));
  const homebrew = JSON.parse(fs.readFileSync(HB_PATH, 'utf8'));
  const filters = JSON.parse(fs.readFileSync(FILTERS_PATH, 'utf8'));

  if (!official.some((s) => s.id === 478)) {
    official.push({
      id: 478,
      slug: '478-shadow-of-moil',
      url: 'https://dnd.su/spells/478-shadow-of-moil/',
      name: 'Облачение тени',
      nameSort: 'ОБЛАЧЕНИЕ ТЕНИ',
      nameEn: 'Shadow of Moil',
      level: 4,
      school: 'Некромантия',
      schoolIcon: 'spell_school_necromancy',
      typeLine: '4 уровень, некромантия',
      ritual: false,
      concentration: true,
      componentsBadge: 'ВСМ',
      castingTime: '1 действие',
      spellRange: 'На себя',
      components:
        'В, С, М (глазное яблоко Нежити, заключенное в драгоценный камень стоимостью не менее 150 зм)',
      duration: 'Концентрация, вплоть до 1 минуты',
      classes: ['колдун'],
      classesTce: [],
      subclasses: '',
      source: 'XGE',
      sourceTitle: "Xanathar's Guide to Everything",
      sourceBadges: [{ code: 'XGE', title: "Xanathar's Guide to Everything" }],
      isHomebrew: false,
      descriptionHtml:
        '<p>Пламевидные тени окутывают ваше тело на всё время действия заклинания, в результате чего вы становитесь сильно заслонённым для других. Тени превращают тусклый свет в пределах 10 футов от вас в темноту, а яркий свет в той же области — в тусклый свет.</p><p>Вы получаете сопротивление урону излучением до окончания действия заклинания. Кроме того, всякий раз, когда существо, находящееся в пределах 10 футов от вас, попадает по вам атакой, тени атакуют его, причиняя 2к8 урона некротической энергией.</p>',
      fClass: [20],
      fClassTce: [],
      fArchetype: [],
      fSource: [109],
      fSchool: [4],
      fConc: [2],
      fRitual: [1],
      fComp: '1|1|1|',
      fCast: ['action'],
      fDam: [21],
    });
    official.sort((a, b) => (a.nameSort || a.name).localeCompare(b.nameSort || b.name, 'ru'));
  }

  const allSpells = [...official, ...homebrew];
  const byId = new Map(allSpells.map((s) => [s.id, s]));

  // 1. Clean any prior enrichment so running this script is 100% idempotent
  for (const sp of allSpells) {
    stripPriorHomebrewEnrichment(sp);
  }

  // 2. Verify every referenced explicit spell ID exists in official or homebrew catalog
  const missingIds = [];
  for (const [cid, ids] of Object.entries(BASE_CLASS_SPELLS)) {
    for (const id of ids) {
      if (!byId.has(id)) missingIds.push(`class ${cid} -> spell ${id}`);
    }
  }
  for (const arch of HOMEBREW_ARCHETYPES) {
    for (const id of arch.spellIds || []) {
      if (!byId.has(id)) missingIds.push(`arch ${arch.id} (${arch.title}) -> spell ${id}`);
    }
  }
  if (missingIds.length > 0) {
    console.error('Missing spell IDs:', missingIds);
    process.exit(1);
  }

  // 3. Apply base class spell lists
  for (const [cidStr, ids] of Object.entries(BASE_CLASS_SPELLS)) {
    const cid = Number(cidStr);
    const cls = HB_CLASS_BY_ID.get(cid);
    for (const sid of new Set(ids)) {
      const sp = byId.get(sid);
      if (!sp.classes.includes(cls.nameLower)) sp.classes.push(cls.nameLower);
      if (!sp.fClass.includes(cid)) sp.fClass.push(cid);
    }
  }

  // 4. Apply subclass spell lists & predicates
  for (const arch of HOMEBREW_ARCHETYPES) {
    const cls = HB_CLASS_BY_ID.get(arch.classId);
    const matched = new Set(arch.spellIds || []);
    if (arch.predicate) {
      for (const sp of allSpells) {
        if (arch.predicate(sp)) matched.add(sp.id);
      }
    }

    const subTag = `${arch.title.toLowerCase()} (${cls.nameLower})`;
    for (const sid of matched) {
      const sp = byId.get(sid);
      if (!sp.fClass.includes(cls.id)) sp.fClass.push(cls.id);
      if (!sp.fArchetype.includes(arch.id)) sp.fArchetype.push(arch.id);

      const existingParts = sp.subclasses
        ? sp.subclasses.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      if (!existingParts.some((p) => p.toLowerCase() === subTag)) {
        existingParts.push(subTag);
      }
      sp.subclasses = existingParts.join(', ');
    }
  }

  // 5. Update dndsu-filters.json (both official & homebrew get grouped Official + Homebrew classes & archetypes)
  const officialClasses9 = [
    { title: 'Бард', value: 12 },
    { title: 'Волшебник', value: 21 },
    { title: 'Друид', value: 22 },
    { title: 'Жрец', value: 13 },
    { title: 'Изобретатель', value: 23 },
    { title: 'Колдун', value: 20 },
    { title: 'Паладин', value: 16 },
    { title: 'Следопыт', value: 17 },
    { title: 'Чародей', value: 19 },
  ];

  const officialClasses13 = [
    { title: 'Бард', value: 12 },
    { title: 'Варвар', value: 11 },
    { title: 'Воин', value: 14 },
    { title: 'Волшебник', value: 21 },
    { title: 'Друид', value: 22 },
    { title: 'Жрец', value: 13 },
    { title: 'Изобретатель', value: 23 },
    { title: 'Колдун', value: 20 },
    { title: 'Монах', value: 15 },
    { title: 'Паладин', value: 16 },
    { title: 'Плут', value: 18 },
    { title: 'Следопыт', value: 17 },
    { title: 'Чародей', value: 19 },
  ];

  const hbClassOptions = HOMEBREW_CLASSES.map((c) => ({
    title: `${c.nameRu} (HB)`,
    value: c.id,
  }));

  filters.official.class = [
    { title: 'Официальные классы', list: officialClasses9 },
    { title: 'Homebrew классы (dnd.su)', list: hbClassOptions },
  ];

  filters.homebrew.class = [
    { title: 'Официальные классы', list: officialClasses13 },
    { title: 'Homebrew классы (dnd.su)', list: hbClassOptions },
  ];

  // Build grouped HB archetype options by HB class
  const hbArchetypeGroups = [];
  for (const cls of HOMEBREW_CLASSES) {
    const list = HOMEBREW_ARCHETYPES.filter((a) => a.classId === cls.id).map((a) => ({
      title: a.title,
      value: a.id,
    }));
    if (list.length > 0) {
      hbArchetypeGroups.push({
        title: `${cls.nameRu} (HB)`,
        list,
      });
    }
  }

  const stripHbArchGroups = (groups = []) =>
    groups.filter((g) => !g.list.some((it) => Number(it.value) >= 2000));

  filters.official.archetype = [
    ...stripHbArchGroups(filters.official.archetype),
    ...hbArchetypeGroups,
  ];
  filters.homebrew.archetype = [
    ...stripHbArchGroups(filters.homebrew.archetype),
    ...hbArchetypeGroups,
  ];

  // 6. Write outputs
  fs.writeFileSync(OFF_PATH, JSON.stringify(official));
  fs.writeFileSync(HB_PATH, JSON.stringify(homebrew));
  fs.writeFileSync(FILTERS_PATH, JSON.stringify(filters, null, 2));

  const metadata = HOMEBREW_CLASSES.map((cls) => ({
    ...cls,
    subclasses: HOMEBREW_ARCHETYPES.filter((a) => a.classId === cls.id).map((a) => ({
      id: a.id,
      title: a.title,
    })),
  }));
  fs.writeFileSync(META_PATH, JSON.stringify(metadata, null, 2));

  // 7. Print summary table
  console.log('=== ENRICHMENT COMPLETE ===');
  for (const cls of HOMEBREW_CLASSES) {
    const offCnt = official.filter((s) => s.fClass.includes(cls.id)).length;
    const hbCnt = homebrew.filter((s) => s.fClass.includes(cls.id)).length;
    console.log(
      `${String(cls.id).padStart(3)} | ${cls.nameRu.padEnd(23)} | official=${String(offCnt).padStart(3)} | homebrew=${String(hbCnt).padStart(3)} | total=${offCnt + hbCnt}`
    );
  }
}

main();
