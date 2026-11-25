import fs from 'node:fs';
import path from 'node:path';

const MIRROR_ROOT = '/tmp/dndsu-mirror';
const OUT_DIR = path.resolve('public/data');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 4 homebrew spells whose card HTML was empty in the May 2026 mirror, fetched verbatim from live https://dnd.su/homebrew/spells/
const LIVE_FETCHED_HOMEBREW = {
  701: {
    typeLine: '3 уровень, ограждение',
    castingTime: '1 действие',
    spellRange: '10 футов',
    components: 'В, С',
    duration: 'концентрация до 1 минуты',
    classesText: 'волшебник',
    subclassesText: '',
    sourceBadges: [{ code: 'HB', title: 'Homebrew' }],
    descriptionHtml:
      '<p>Вы соединяете двух существ рунами. При получение урона одним существом, вместо него его получает связанный с ним. Эффект заклинаний так же перенаправляются.</p>',
  },
  2389: {
    typeLine: '6 уровень, вызов',
    castingTime: '1 действие или 1 бонусное действие',
    spellRange: 'Касание',
    components: 'В, С, М (2 одинаковых сапфира, стоимостью 50 зм каждый)',
    duration: '24 часа',
    classesText: 'бард, волшебник, друид',
    subclassesText: '',
    sourceBadges: [{ code: 'HB', title: 'Homebrew' }],
    descriptionHtml:
      '<blockquote><p>Не советую ронять портальный камень в узкие щели или запирать его в прочных, но маленьких коробках.</p></blockquote><p>Вы наделяете камни, используемые в качестве материального компонента, связью, тянущейся через Астральный план. После этого в течение 24 часов вы или любое другое существо можете бонусным действием сжать один из камней в руке, чтобы телепортироваться вместе с ним на место второго камня, даже если они находятся на разных планах. Второй камень телепортируется в то пространство, которое занимало активировавшее существо.</p><p><strong>Источник:</strong> Записи Терна о расколотом мире</p>',
  },
  7302: {
    typeLine: 'Заговор, иллюзия',
    castingTime: '1 действие',
    spellRange: '30 футов',
    components: 'С, М (кусок льда)',
    duration: '1 минута',
    classesText: 'бард, волшебник, колдун',
    subclassesText: '',
    sourceBadges: [{ code: 'HB', title: 'Homebrew' }],
    descriptionHtml:
      '<p>Вы создаете иллюзию холодных трещин, которые покрывают конечности видимой цели в радиусе 30 футов. При движении цели, иллюзорные трещины начинают трескаться и разрушаться, создавая ощущение внутреннего холода и дискомфорта. Существо, находящееся в пределах действия заклинания, должно совершить спасбросок Интеллекта, иначе его скорость ходьбы уменьшится на 20 футов на время действия заклинания.</p><p>Количество целей этого заклинания увеличивается на 1, когда вы достигаете следующих уровней: 5-го уровня (2), 11-го уровня (3) и 17-го уровня (4).</p>',
  },
  11066: {
    typeLine: '3 уровень, вызов',
    castingTime: '1 действие',
    spellRange: 'На себя',
    components: 'В, С, М (кусочек щупальца осьминога или кальмара)',
    duration: 'Концентрация, вплоть до 1 минуты',
    classesText: 'колдун',
    subclassesText: 'аберрантный разум (чародей)',
    sourceBadges: [{ code: 'HB', title: 'Homebrew' }],
    descriptionHtml:
      '<p>Вы призываете чёрные извивающиеся щупальца. Пока заклинание активно, они заполняют пространство в пределах 15 футов от вас и делают местность труднопроходимой для всех существ, кроме вас.</p><p>Когда существо, кроме вас, впервые попадает в область заклинания или начинает там ход, оно должно преуспеть в спасброске Ловкости, иначе получит дробящий урон 2к8 и станет опутанным щупальцами до окончания заклинания. При успехе оно получает лишь половину урона и не становится опутанным. Существо, начинающее ход в этой области, уже опутанное щупальцами, получает дробящий урон 2к8.</p><p>Опутанное щупальцами существо может действием совершить проверку Силы или Ловкости (на свой выбор) против Сл ваших заклинаний. В случае успеха оно высвобождается.</p><p><strong>На больших уровнях.</strong> Если вы накладываете это заклинание, используя ячейку 4-го уровня или выше, урон увеличивается на 1к8 за каждый уровень ячейки выше третьего.</p>',
  },
  11261: {
    typeLine: '2 уровень, иллюзия',
    castingTime: '1 действие',
    spellRange: 'Касание',
    components: 'В, С, М (перо совы)',
    duration: 'Концентрация, до 1 часа',
    classesText: 'бард, волшебник, изобретатель, колдун, чародей',
    subclassesText: 'круг снов (друид), домен обмана (жрец)',
    sourceBadges: [{ code: 'HB', title: 'Homebrew' }],
    descriptionHtml:
      '<p>Существо, которого вы касаетесь, окутывается магической аурой, рассеивающей внимание. Пока заклинание активно, другие существа с помехой совершают проверки Мудрости (Восприятие) для его обнаружения, а оно с преимуществом совершает проверки Ловкости (Скрытность) для того, чтобы спрятаться среди большого количества объектов (например, в толпе или в лесу). Если существо пытается сохранить непрерывный визуальный контакт с целью заклинания, то оно должно совершить спасбросок Мудрости против вашей Сл заклинаний, при успехе это заклинание перестаёт оказывать на него действие, но продолжает создавать помехи другим существам. Если существо отвлекается на что-то другое (по усмотрению Мастера), то оно вновь теряет цель из вида. Заклинание подвержено всем эффектам, которые влияют на магически невидимых существ (например, <a href="https://dnd.su/spells/207-faerie-fire/">огонь фей [faerie fire]</a>). Заклинание оканчивается на цели, если она совершает атаку или накладывает заклинание.</p><p><strong><em>На больших уровнях.</em></strong> Если вы накладываете это заклинание, используя ячейку 3-го уровня или выше, вы можете сделать целью одно дополнительное существо за каждый уровень ячейки выше второго.</p>',
  },
  12634: {
    typeLine: '2 уровень, некромантия',
    castingTime: '1 действие',
    spellRange: '30 футов',
    components: 'В, С, М (Капля крови заклинателя, оружие)',
    duration: 'мгновенная',
    classesText: 'жрец, колдун',
    subclassesText:
      'коллегия шёпотов (бард), школа воплощения (волшебник), школа некромантии (волшебник), круг спор (друид), мистический ловкач (плут), сумрачный охотник (следопыт), божественная душа (чародей), теневая магия (чародей), мастер знаний (волшебник), коллегия древних (бард), школа древностей (волшебник), инакомыслящий (изобретатель), зелёная кровь (чародей), круг сумерек (друид)',
    sourceBadges: [{ code: 'HB', title: 'Homebrew' }],
    descriptionHtml:
      '<p>Вы вонзаете острый предмет в свою руку, нанося себе 1 единицу урона, которую нельзя снизить никаким образом, после чего произносите секретное слово, которое заставляет вашу кровь вскипеть, после чего вы можете применить 2 варианта Искупляющей длани, приведённых ниже, мгновенно их используя.</p><p><strong>Варианты Искупляющей длани.</strong></p><ul><li><strong>Кровавый дротик.</strong> Вы бросаете острый кровавый клинок, совершая дальнобойную атаку заклинанием, в цель, стоящую в пределах 30 футов от вас. При попадании, вы наносите <strong>4к6</strong> урона некротической энергией.</li><li><strong>Теневое скольжение.</strong> Вы мгновенно перемещаетесь на расстояние до 20 футов, не провоцируя атак.</li><li><strong>Наложение длани.</strong> Вы создаёте над существом, стоящим в пределах 10 футов от вас, массивную длань, которая вызывает у него приступ паники. Существо должно преуспеть в спасброске мудрости, получая <strong>3к4</strong> урона психической энергией и будет вычитать из всех своих проверок характеристик <strong>1к4</strong> при провале.</li><li><strong>Луч прекращения.</strong> Вы отправляете в цель, стоящую в пределах 60 футов от вас луч, совершая дальнобойную атаку заклинанием. При попадании, луч мгновенно запрещает ей использовать реакцию до начала вашего следующего хода.</li><li><strong>Ужасающий клинок.</strong> Ваша кровь мгновенно превращается в длинный острый меч. Совершите рукопашную атаку заклинанием, по цели, в пределах 10 футов от вас, нанося <strong>2к6</strong> урона некротической энергией, а так же <strong>2к10</strong> урона психической энергией, при попадании, или только половину этого урона при промахе.</li></ul><p><strong>На больших уровнях.</strong> Если вы накладываете это заклинание, используя ячейку 3-го уровня или выше, вы можете выбрать ещё 1 вариант Искупляющей длани, за каждый уровень ячейки, выше второго.</p><p><strong>Дополнительное описание.</strong> Это древнее заклинание, созданное в самых тёмных уголках нашего мира, существует только для одной цели... Уничтожение живых существ.</p>',
  },
};

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&times;/g, '×')
    .replace(/&minus;/g, '−')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTagsToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|tr|h2|h3|h4|blockquote|div)>/gi, '\n')
      .replace(/<td[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeDescriptionHtml(rawHtml) {
  let h = rawHtml.trim();
  // Normalize relative links to canonical https://dnd.su/... URLs while preserving data-spell-link if internal spell
  h = h.replace(
    /<a\s+([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi,
    (_full, pre, _q, href, post) => {
      let cleanHref = href.trim();
      if (cleanHref.startsWith('../../')) {
        cleanHref = 'https://dnd.su/' + cleanHref.replace(/^(\.\.\/)+/, '');
      } else if (cleanHref.startsWith('/')) {
        cleanHref = 'https://dnd.su' + cleanHref;
      } else if (!cleanHref.startsWith('http://') && !cleanHref.startsWith('https://')) {
        cleanHref = 'https://dnd.su/' + cleanHref.replace(/^\.?\//, '');
      }
      // Remove inline event handlers
      const safeAttrs = `${pre} ${post}`.replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      const titleMatch = safeAttrs.match(/title=(["'])([^"']+)\1/i);
      const titleAttr = titleMatch ? ` title="${titleMatch[2].replace(/"/g, '&quot;')}"` : '';
      return `<a href="${cleanHref}" target="_blank" rel="noreferrer"${titleAttr}>`;
    }
  );

  // Convert tooltip spans `<span tooltip-for="condition.frightened" ...>испуганным</span>` into styled term spans
  h = h.replace(
    /<span\s+[^>]*tooltip-for=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/span>/gi,
    '<span class="dnd-term" data-term="$2">$3</span>'
  );

  // Strip remaining unsafe attributes except class / colspan / rowspan / style text-align
  h = h.replace(/<([a-zA-Z0-9]+)\s+([^>]+)>/g, (full, tag, attrs) => {
    const t = tag.toLowerCase();
    if (t === 'a' || t === 'span') {
      if (full.includes('class="dnd-term"') || full.includes('target="_blank"')) return full;
    }
    const kept = [];
    const cls = attrs.match(/class=(["'])([^"']+)\1/i);
    if (cls && cls[2] === 'table_header') kept.push('class="table_header"');
    const colspan = attrs.match(/colspan=(["']?)(\d+)\1/i);
    if (colspan) kept.push(`colspan="${colspan[2]}"`);
    const rowspan = attrs.match(/rowspan=(["']?)(\d+)\1/i);
    if (rowspan) kept.push(`rowspan="${rowspan[2]}"`);
    const align = attrs.match(/text-align:\s*(left|center|right)/i);
    if (align) kept.push(`style="text-align:${align[1]}"`);
    return kept.length ? `<${t} ${kept.join(' ')}>` : `<${t}>`;
  });

  // Remove script/style/iframe if any
  h = h.replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '');
  return h.trim();
}

function normalizeFilterGroups(rawData) {
  // rawData can be an array of { title, list } OR an object keyed by groupId -> { title, list: Array | Object }
  const groups = Array.isArray(rawData) ? rawData : Object.values(rawData || {});
  return groups.map((g) => {
    const itemsRaw = Array.isArray(g.list) ? g.list : Object.values(g.list || {});
    return {
      title: g.title || '',
      list: itemsRaw.map((item) => ({
        title: decodeEntities(String(item.title)),
        value: item.value,
      })),
    };
  });
}

function extractFiltersFromHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const re = /<input[^>]*class="[^"]*filter[^"]*"[^>]*>/g;
  const out = {};
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const name = tag.match(/name="([^"]+)"/)?.[1];
    const dl = tag.match(/data-list="([^"]+)"/)?.[1];
    if (name && dl) {
      out[name] = normalizeFilterGroups(JSON.parse(decodeEntities(dl)));
    }
  }
  return out;
}

function loadListJson(piecePath) {
  const html = fs.readFileSync(piecePath, 'utf8');
  const m = html.match(/window\.LIST\s*=\s*(\{[\s\S]*\});/);
  if (!m) throw new Error(`Missing window.LIST in ${piecePath}`);
  return JSON.parse(m[1]);
}

function parseSpellCardHtml(html) {
  // Locate the main spell card wrapper containing `<ul class="params card__article-body">`
  const paramsIdx = html.indexOf('<ul class="params card__article-body">');
  if (paramsIdx < 0) return null;

  const headerSlice = html.slice(Math.max(0, paramsIdx - 1200), paramsIdx);
  const sourceBadges = [];
  const plaqueRe = /<(?:span|a)\b([^>]*)class=['"][^'"]*source-plaque[^'"]*['"]([^>]*)>([\s\S]*?)<\/(?:span|a)>/gi;
  let pm;
  while ((pm = plaqueRe.exec(headerSlice)) !== null) {
    const attrs = `${pm[1]} ${pm[2]}`;
    const code = stripTagsToText(pm[3]);
    const dq = attrs.match(/title="([^"]*)"/i)?.[1];
    const sq = attrs.match(/title='([^']*)'/i)?.[1];
    const title = decodeEntities(dq ?? sq ?? code);
    const hrefDq = attrs.match(/href="([^"]*)"/i)?.[1];
    const hrefSq = attrs.match(/href='([^']*)'/i)?.[1];
    const href = hrefDq ?? hrefSq;
    if (code) {
      sourceBadges.push(href ? { code, title, href } : { code, title });
    }
  }

  const endUlIdx = html.indexOf('</ul></div><div class="card__footer">', paramsIdx);
  const ulBody = html.slice(
    paramsIdx + '<ul class="params card__article-body">'.length,
    endUlIdx > paramsIdx ? endUlIdx : paramsIdx + 40000
  );

  const typeLine = stripTagsToText(
    ulBody.match(/<li class="size-type-alignment">([\s\S]*?)<\/li>/i)?.[1] || ''
  );

  const descIdx = ulBody.indexOf('<li class="subsection desc">');
  const metaPart = descIdx >= 0 ? ulBody.slice(0, descIdx) : ulBody;

  function extractField(label) {
    const re = new RegExp(`<li>\\s*<strong>${label}:<\\/strong>\\s*([\\s\\S]*?)<\\/li>`, 'i');
    const match = metaPart.match(re);
    return match ? match[1].trim() : '';
  }

  const castingTime = stripTagsToText(extractField('Время накладывания'));
  const spellRange = stripTagsToText(extractField('Дистанция'));
  const components = stripTagsToText(extractField('Компоненты'));
  const duration = stripTagsToText(extractField('Длительность'));

  const rawClassesHtml = extractField('Классы');
  // Detect TCE superscripts per class e.g. `бард<sup><span ...>TCE</span></sup>, волшебник`
  const classes = [];
  const classesTce = [];
  if (rawClassesHtml) {
    for (const part of rawClassesHtml.split(',')) {
      const isTce = /TCE/i.test(part);
      const cleaned = stripTagsToText(part.replace(/<sup[\s\S]*?<\/sup>/gi, '')).trim();
      if (cleaned) {
        classes.push(cleaned);
        if (isTce) classesTce.push(cleaned);
      }
    }
  }

  const subclassesText = stripTagsToText(extractField('Подклассы'));

  const descMatch = ulBody.match(/<div itemprop="description">([\s\S]*?)<\/div>\s*<\/li>\s*$/i);
  const rawDescHtml = descMatch ? descMatch[1] : '';
  const descriptionHtml = sanitizeDescriptionHtml(rawDescHtml);

  return {
    typeLine,
    castingTime,
    spellRange,
    components,
    duration,
    classes,
    classesTce,
    subclassesText,
    sourceBadges,
    descriptionHtml,
  };
}

function buildSpellsDataset(baseDir, listData, isHomebrew) {
  const dirEntries = fs.readdirSync(baseDir);
  const byPrefix = new Map();
  for (const d of dirEntries) {
    const m = d.match(/^(\d+)-/);
    if (m) {
      const idNum = Number(m[1]);
      if (!byPrefix.has(idNum)) byPrefix.set(idNum, []);
      byPrefix.get(idNum).push(d);
    }
  }

  const spells = [];
  for (const card of listData.cards) {
    const slug = card.link.replace(/^\/?(homebrew\/)?spells\//, '').replace(/\/$/, '');
    const idMatch = slug.match(/^(\d+)-/);
    if (!idMatch) throw new Error(`Cannot parse numeric ID from link ${card.link}`);
    const id = Number(idMatch[1]);

    let parsedCard = null;
    const candidates = [slug, ...(byPrefix.get(id) || [])];
    const seen = new Set();
    for (const cand of candidates) {
      if (seen.has(cand)) continue;
      seen.add(cand);
      const fp = path.join(baseDir, cand, 'index.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const res = parseSpellCardHtml(html);
        if (res && res.descriptionHtml) {
          parsedCard = res;
          break;
        }
      }
    }

    if (!parsedCard && isHomebrew && LIVE_FETCHED_HOMEBREW[id]) {
      const fb = LIVE_FETCHED_HOMEBREW[id];
      parsedCard = {
        typeLine: fb.typeLine,
        castingTime: fb.castingTime,
        spellRange: fb.spellRange,
        components: fb.components,
        duration: fb.duration,
        classes: fb.classesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        classesTce: [],
        subclassesText: fb.subclassesText,
        sourceBadges: fb.sourceBadges,
        descriptionHtml: fb.descriptionHtml,
      };
    }

    if (!parsedCard) {
      throw new Error(`Missing card HTML for spell ${id} (${card.link})`);
    }

    const levelNum = Number.parseInt(String(card.level), 10) || 0;
    const concentration = (card.filter_concentration || []).map(String).includes('2');
    const ritual = (card.filter_ritual || []).map(String).includes('2');
    const primarySource =
      parsedCard.sourceBadges[0]?.code || (isHomebrew ? 'HB' : 'PH14');
    const primarySourceTitle =
      parsedCard.sourceBadges[0]?.title || (isHomebrew ? 'Homebrew' : "Player's Handbook");

    spells.push({
      id,
      slug,
      url: `https://dnd.su${card.link}`,
      name: card.title,
      nameSort: card.title_sort || card.title.toUpperCase(),
      nameEn: card.title_en || '',
      level: levelNum,
      school: card.school,
      schoolIcon: card.item_icon || '',
      typeLine:
        parsedCard.typeLine ||
        `${levelNum === 0 ? 'Заговор' : `${levelNum} уровень`}, ${card.school.toLowerCase()}${
          ritual ? ' (ритуал)' : ''
        }`,
      ritual,
      concentration,
      componentsBadge: card.item_suffix || '...',
      castingTime: parsedCard.castingTime || '1 действие',
      spellRange: parsedCard.spellRange || 'На себя',
      components: parsedCard.components || '',
      duration: parsedCard.duration || 'Мгновенная',
      classes: parsedCard.classes,
      classesTce: parsedCard.classesTce,
      subclasses: parsedCard.subclassesText,
      source: primarySource,
      sourceTitle: primarySourceTitle,
      sourceBadges: parsedCard.sourceBadges,
      isHomebrew,
      descriptionHtml: parsedCard.descriptionHtml,
      // Exact dnd.su filter values
      fClass: (card.filter_class || []).map(Number),
      fClassTce: (card.filter_class_tce || []).map(Number),
      fArchetype: (card.filter_archetype || []).map(Number),
      fSource: (card.filter_source || []).map(Number),
      fSchool: (card.filter_school || []).map(Number),
      fConc: (card.filter_concentration || []).map(Number),
      fRitual: (card.filter_ritual || []).map(Number),
      fComp: String(card.filter_components || '0|0|0|'),
      fCast: (card.filter_casttime || []).map(String),
      fDam: (card.filter_damtype || []).map(Number),
    });
  }

  return spells;
}

const offFilters = extractFiltersFromHtml(path.join(MIRROR_ROOT, 'spells/index.html'));
const hbFilters = extractFiltersFromHtml(path.join(MIRROR_ROOT, 'homebrew/spells/index.html'));

const offList = loadListJson(path.join(MIRROR_ROOT, 'piece/spells/index-list/index.html'));
const hbList = loadListJson(path.join(MIRROR_ROOT, 'homebrew/piece/spells/index-list/index.html'));

const officialSpells = buildSpellsDataset(path.join(MIRROR_ROOT, 'spells'), offList, false);
const homebrewSpells = buildSpellsDataset(path.join(MIRROR_ROOT, 'homebrew/spells'), hbList, true);

const filtersPayload = {
  official: offFilters,
  homebrew: hbFilters,
};

fs.writeFileSync(path.join(OUT_DIR, 'dndsu-filters.json'), JSON.stringify(filtersPayload));
fs.writeFileSync(path.join(OUT_DIR, 'dndsu-spells-official.json'), JSON.stringify(officialSpells));
fs.writeFileSync(path.join(OUT_DIR, 'dndsu-spells-homebrew.json'), JSON.stringify(homebrewSpells));

console.log(`Extracted official spells: ${officialSpells.length}`);
console.log(`Extracted homebrew spells: ${homebrewSpells.length}`);
for (const fn of ['dndsu-filters.json', 'dndsu-spells-official.json', 'dndsu-spells-homebrew.json']) {
  const sz = fs.statSync(path.join(OUT_DIR, fn)).size;
  console.log(`${fn}: ${(sz / 1024).toFixed(1)} KB`);
}
