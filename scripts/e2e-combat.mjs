/**
 * E2E-проверка вкладки «Бой» (REST + WebSocket) против локального `wrangler dev`.
 *
 * Запуск:
 *   1) npx wrangler dev --ip 0.0.0.0 --port 8788
 *   2) node scripts/e2e-combat.mjs
 *
 * Тест создаёт собственный бой и удаляет его в конце, поэтому не зависит от
 * данных портала. Бестиарий только читается: используются первые существа из
 * списка `/api/combats/bestiary` (в локальной D1 нужен хотя бы один моб).
 */
import WebSocket from 'ws';

const BASE = 'http://127.0.0.1:8788';
const WSBASE = 'ws://127.0.0.1:8788';

let passed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`);
  }
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, cookie, body };
}

function api(cookie) {
  return async (path, init = {}) => {
    const res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  };
}

function openSocket(cookie, combatId) {
  const ws = new WebSocket(`${WSBASE}/api/combats/${combatId}/ws`, { headers: { cookie } });
  const client = { log: [], ws, closed: false };
  ws.on('message', (raw) => {
    try {
      client.log.push(JSON.parse(raw.toString()));
    } catch {
      client.log.push({ type: 'unparsed', raw: raw.toString() });
    }
  });
  ws.on('close', () => {
    client.closed = true;
  });
  ws.on('error', () => {});
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'hello', payload: {} }));
  });
  client.send = (msg) => ws.send(JSON.stringify(msg));
  client.waitFor = async (pred, timeout = 4000) => {
    const started = Date.now();
    let cursor = 0;
    while (Date.now() - started < timeout) {
      while (cursor < client.log.length) {
        const msg = client.log[cursor++];
        if (pred(msg)) return msg;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`timeout waiting; log=${JSON.stringify(client.log.slice(-6))}`);
  };
  return client;
}

const stamp = Date.now();

const dmAuth = await login('dm', 'Kin939');
check('DM логин', dmAuth.ok, dmAuth.body);
const p1Auth = await login('player1', 'Hero1-7394-Blade');
check('player1 логин', p1Auth.ok, p1Auth.body);
const p2Auth = await login('player2', 'Hero2-5821-Runes');
check('player2 логин', p2Auth.ok, p2Auth.body);

const dm = api(dmAuth.cookie);
const p1 = api(p1Auth.cookie);
const p2 = api(p2Auth.cookie);

// ------------------------------------------------------------ справочники
const bestiary = await dm('/combats/bestiary');
check('GET /combats/bestiary (DM) 200', bestiary.status === 200, bestiary.status);
const creatures = bestiary.body.creatures ?? [];
check('бестиарий содержит существ', creatures.length > 0, creatures.length);
check(
  'существо содержит стат-блок/AC/HP для конструктора',
  creatures.every((c) => 'statblock' in c && 'ac' in c && 'hpAverage' in c && 'cr' in c),
  creatures[0]
);

const bestiaryPlayer = await p1('/combats/bestiary');
check('игрок не видит конструктор (403)', bestiaryPlayer.status === 403, bestiaryPlayer.status);

const conditions = await dm('/combats/conditions');
check('GET /combats/conditions 200', conditions.status === 200, conditions.status);
check('справочник состояний: 14 условий 5e', (conditions.body.conditions ?? []).length === 14, conditions.body.conditions?.length);

const members = await dm('/combats/members');
const players = members.body.players ?? [];
check('GET /combats/members: ростер кампании', members.status === 200 && players.length >= 2, players.length);

const creatureA = creatures[0];
const creatureB = creatures[creatures.length - 1];
const player1Option = players.find((p) => p.username === 'player1') ?? players[0];

// ------------------------------------------------------------- создание боя
const playerCreate = await p1('/combats', { method: 'POST', body: JSON.stringify({ name: 'взлом' }) });
check('игрок не может создать бой (403)', playerCreate.status === 403, playerCreate.status);

const COMBAT_NAME = `E2E бой ${stamp}`;
const created = await dm('/combats', {
  method: 'POST',
  body: JSON.stringify({
    name: COMBAT_NAME,
    turnTimerSeconds: 60,
    settings: { allowPlayerTurn: false, showPlayerHp: true, showOtherDeathSaves: false, monsterHpVisibility: 'bar' },
    participants: [
      {
        participantType: 'player',
        userId: player1Option.userId,
        playerId: player1Option.playerId,
        displayName: 'E2E Герой',
        maxHp: 24,
        currentHp: 24,
        initiativeValue: 15,
      },
      { participantType: 'monster', monsterBestiaryId: creatureA.id, initiativeValue: 12, quantity: 2, isHiddenFromPlayers: true },
      { participantType: 'monster', monsterBestiaryId: creatureB.id, initiativeValue: 8, isHiddenFromPlayers: false },
    ],
  }),
});
check('DM создаёт бой', created.status === 200 && Boolean(created.body.combat?.id), created.body);
const combatId = created.body.combat?.id;
const view = created.body.combat ?? {};
check('новый бой в статусе setup', view.status === 'setup', view.status);
check('участники: 1 игрок + 2 экземпляра + 1 моб', view.participants?.length === 4, view.participants?.length);
check(
  'инициатива отсортирована по убыванию',
  (view.participants ?? []).every((p, i, arr) => i === 0 || arr[i - 1].initiativeValue >= p.initiativeValue),
  view.participants?.map((p) => p.initiativeValue)
);
check('мобы одной пачки пронумерованы', (view.participants ?? []).some((p) => /\s2$/.test(p.displayName)), view.participants?.map((p) => p.displayName));
check('таймер боя сохранён', view.settings?.turnTimerSeconds === 60, view.settings);
check('DM видит стат-блок существ', Boolean(view.participants?.find((p) => p.participantType === 'monster')?.statblock));

const hiddenMonster = (view.participants ?? []).find((p) => p.participantType === 'monster' && p.isHiddenFromPlayers);
const visibleMonster = (view.participants ?? []).find((p) => p.participantType === 'monster' && !p.isHiddenFromPlayers);
const heroParticipant = (view.participants ?? []).find((p) => p.participantType === 'player');

const listForPlayer = await p2('/combats');
check(
  'игрок не видит бой в подготовке',
  (listForPlayer.body.combats ?? []).every((c) => c.id !== combatId),
  listForPlayer.body.combats?.map((c) => [c.id, c.status])
);

const setupForPlayer = await p2(`/combats/${combatId}`);
check('игрок не открывает бой до старта (403)', setupForPlayer.status === 403, setupForPlayer.status);

// ------------------------------------------------------------------- старт
const started = await dm(`/combats/${combatId}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
check('DM начинает бой', started.status === 200 && started.body.combat?.status === 'active', started.body.combat?.status);
check('текущий ход — первый по инициативе', started.body.combat?.participants?.[0]?.isCurrent === true);

const listAfterStart = await p2('/combats');
const listed = (listAfterStart.body.combats ?? []).find((c) => c.id === combatId);
check('игрок видит начавшийся бой в списке', Boolean(listed), listAfterStart.body.combats?.map((c) => c.name));
check('в списке есть счётчик участников', listed?.participantCount === 4, listed?.participantCount);

// --------------------------------------------------- фильтрация для игрока
const playerView = await p2(`/combats/${combatId}`);
check('игрок получает состояние боя', playerView.status === 200, playerView.status);
const playerCombat = playerView.body.combat ?? {};
const pvHidden = (playerCombat.participants ?? []).find((p) => p.id === hiddenMonster?.id);
const pvVisible = (playerCombat.participants ?? []).find((p) => p.id === visibleMonster?.id);
const pvHero = (playerCombat.participants ?? []).find((p) => p.id === heroParticipant?.id);

check('скрытый моб: нет HP-чисел', pvHidden?.currentHp === null && pvHidden?.maxHp === null, pvHidden);
check('скрытый моб: нет AC', pvHidden?.armorClass === null, pvHidden?.armorClass);
check('скрытый моб: нет стат-блока', pvHidden?.statblock === null, pvHidden?.statblock);
check('скрытый моб: нет полосы HP', pvHidden?.hpPercent === null, pvHidden?.hpPercent);
check('видимый моб (bar): числа скрыты, полоса есть', pvVisible?.currentHp === null && pvVisible?.hpPercent === 100, {
  hp: pvVisible?.currentHp,
  pct: pvVisible?.hpPercent,
});
check('видимый моб (bar): нет AC и стат-блока', pvVisible?.armorClass === null && pvVisible?.statblock === null);
check('HP игрока видны при showPlayerHp', pvHero?.currentHp === 24 && pvHero?.maxHp === 24, pvHero);
check('игрок не видит заметки мастера', pvHidden?.notes === null && pvHero?.notes === null);

// ------------------------------------------------------------ скрытие имени
const hideName = await dm(`/combats/${combatId}/participants/${visibleMonster?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ hideName: true }),
});
check('DM включает скрытие имени', hideName.status === 200 && hideName.body.combat?.participants?.find((p) => p.id === visibleMonster?.id)?.hideName === true);
const masked = await p2(`/combats/${combatId}`);
check(
  'игрок видит «Неизвестное существо»',
  (masked.body.combat?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.displayName === 'Неизвестное существо',
  masked.body.combat?.participants?.map((p) => p.displayName)
);
const dmSeesName = await dm(`/combats/${combatId}`);
check(
  'мастер по-прежнему видит настоящее имя',
  (dmSeesName.body.combat?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.displayName === creatureB.name
);
await dm(`/combats/${combatId}/participants/${visibleMonster?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ hideName: false }),
});

// --------------------------------------------------------------- HP-правки
const damage = await dm(`/combats/${combatId}/participants/${visibleMonster?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ hpDelta: -30 }),
});
check('DM наносит урон (hpDelta)', damage.status === 200, damage.status);
check('полоса HP пересчитана для bar-режима', damage.body.combat?.participants?.find((p) => p.id === visibleMonster?.id)?.hpPercent === 49, damage.body.combat?.participants?.find((p) => p.id === visibleMonster?.id)?.hpPercent);

const playerDamage = await p1(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ hpDelta: -100 }),
});
check('игрок не может править HP (403)', playerDamage.status === 403, playerDamage.status);

const downed = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ currentHp: 0 }),
});
check('участник помечен поверженным при 0 HP', downed.body.combat?.participants?.find((p) => p.id === heroParticipant?.id)?.isDefeated === true);

const heal = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ currentHp: 12, tempHp: 5 }),
});
const healedHero = heal.body.combat?.participants?.find((p) => p.id === heroParticipant?.id);
check('лечение и временные HP применились', healedHero?.currentHp === 12 && healedHero?.tempHp === 5 && healedHero?.isDefeated === false, healedHero);

// ------------------------------------------------- смерти, истощение, AC
const deathSave = await dm(`/combats/${combatId}/death-saves`, {
  method: 'POST',
  body: JSON.stringify({ participantId: heroParticipant?.id, kind: 'failure' }),
});
check('провал спасброска от смерти', deathSave.body.combat?.participants?.find((p) => p.id === heroParticipant?.id)?.deathSaves?.failures === 1);

const selfSaves = await p1(`/combats/${combatId}`);
check(
  'игрок видит свои спасброски',
  selfSaves.body.combat?.participants?.find((p) => p.isYou)?.deathSaves?.failures === 1,
  selfSaves.body.combat?.participants?.find((p) => p.isYou)?.deathSaves
);
const otherSaves = await p2(`/combats/${combatId}`);
check(
  'чужие спасброски скрыты (showOtherDeathSaves=false)',
  otherSaves.body.combat?.participants?.find((p) => p.id === heroParticipant?.id)?.deathSaves === null
);

const stabilized = await dm(`/combats/${combatId}/death-saves`, {
  method: 'POST',
  body: JSON.stringify({ participantId: heroParticipant?.id, stable: true }),
});
check('стабилизация отмечается', stabilized.body.combat?.participants?.find((p) => p.id === heroParticipant?.id)?.deathSaves?.stable === true);

const exhaustion = await dm(`/combats/${combatId}/exhaustion`, {
  method: 'POST',
  body: JSON.stringify({ participantId: heroParticipant?.id, level: 2 }),
});
check('уровень истощения 2', exhaustion.body.combat?.participants?.find((p) => p.id === heroParticipant?.id)?.exhaustionLevel === 2);
const exhaustionClamp = await dm(`/combats/${combatId}/exhaustion`, {
  method: 'POST',
  body: JSON.stringify({ participantId: heroParticipant?.id, level: 9 }),
});
check('истощение ограничено 6', exhaustionClamp.body.combat?.participants?.find((p) => p.id === heroParticipant?.id)?.exhaustionLevel === 6);

// ------------------------------------------------------------------ эффекты
const prone = await dm(`/combats/${combatId}/effects`, {
  method: 'POST',
  body: JSON.stringify({
    participantId: visibleMonster?.id,
    effectName: 'Prone',
    durationType: 'rounds',
    durationValue: 2,
    isVisibleToPlayers: true,
  }),
});
const proneEffect = (prone.body.combat?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.effects?.[0];
check('состояние добавлено с описанием 5e', prone.status === 200 && proneEffect?.effectName === 'Prone' && Boolean(proneEffect?.description), proneEffect);

const secretEffect = await dm(`/combats/${combatId}/effects`, {
  method: 'POST',
  body: JSON.stringify({
    participantId: visibleMonster?.id,
    effectName: 'Метка охотника',
    effectType: 'custom',
    durationType: 'until_removed',
    isVisibleToPlayers: false,
  }),
});
check('скрытый эффект есть у мастера', (secretEffect.body.combat?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.effects?.length === 2);

const playerEffects = await p2(`/combats/${combatId}`);
const pvEffects = (playerEffects.body.combat?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.effects ?? [];
check('игрок видит только видимые эффекты', pvEffects.length === 1 && pvEffects[0].effectName === 'Prone', pvEffects.map((e) => e.effectName));

const playerTriesEffect = await p1(`/combats/${combatId}/effects`, {
  method: 'POST',
  body: JSON.stringify({ participantId: visibleMonster?.id, effectName: 'Blinded' }),
});
check('игрок не может навесить состояние (403)', playerTriesEffect.status === 403, playerTriesEffect.status);

// ------------------------------------------------------------- ход и раунды
const beforeTurn = await dm(`/combats/${combatId}`);
const startIndex = beforeTurn.body.combat?.currentTurnIndex ?? 0;
const next = await dm(`/combats/${combatId}/next-turn`, { method: 'POST', body: JSON.stringify({}) });
check('«Следующий ход» двигает индекс', next.status === 200 && next.body.combat?.currentTurnIndex === (startIndex + 1) % 4, {
  from: startIndex,
  to: next.body.combat?.currentTurnIndex,
});
const roundAfterOne = next.body.combat?.roundNumber;
check('раунд не растёт внутри круга', roundAfterOne === 1, roundAfterOne);

// прокручиваем круг до конца: должно произойти +1 раунд и затухание эффектов
let wrapView = next.body.combat;
for (let i = 0; i < 3; i += 1) {
  const step = await dm(`/combats/${combatId}/next-turn`, { method: 'POST', body: JSON.stringify({}) });
  wrapView = step.body.combat;
}
check('раунд увеличивается на переходе через круг', wrapView?.roundNumber === 2, wrapView?.roundNumber);
check('после круга ход у первого участника', wrapView?.currentTurnIndex === startIndex, wrapView?.currentTurnIndex);
const proneAfterRound = (wrapView?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.effects?.find((e) => e.effectName === 'Prone');
check('эффект с длительностью в раундах уменьшился', proneAfterRound?.durationValue === 1, proneAfterRound?.durationValue);

const second = await dm(`/combats/${combatId}/next-turn`, { method: 'POST', body: JSON.stringify({}) });
// доводим до конца второго круга
let effectView = second.body.combat;
for (let i = 0; i < 3; i += 1) {
  const step = await dm(`/combats/${combatId}/next-turn`, { method: 'POST', body: JSON.stringify({}) });
  effectView = step.body.combat;
}
const proneGone = (effectView?.participants ?? []).find((p) => p.id === visibleMonster?.id)?.effects?.find((e) => e.effectName === 'Prone');
check('эффект снят автоматически при 0 раундов', proneGone === undefined, proneGone);

const playerNextTurn = await p1(`/combats/${combatId}/next-turn`, { method: 'POST', body: JSON.stringify({}) });
check('игрок не может завершать чужой ход (403)', playerNextTurn.status === 403, playerNextTurn.status);

// ---------------------------------------------------------------- таймер
const timerConfigure = await dm(`/combats/${combatId}/timer`, {
  method: 'POST',
  body: JSON.stringify({ action: 'configure', seconds: 30 }),
});
check('таймер настраивается', timerConfigure.body.combat?.settings?.turnTimerSeconds === 30, timerConfigure.body.combat?.settings);
check('таймер стартует вместе с настройкой', typeof timerConfigure.body.combat?.settings?.turnTimerEndsAt === 'number');
const timerPause = await dm(`/combats/${combatId}/timer`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) });
check('пауза сохраняет остаток', timerPause.body.combat?.settings?.turnTimerEndsAt === null && typeof timerPause.body.combat?.settings?.turnTimerPausedRemainingMs === 'number', timerPause.body.combat?.settings);
const timerOff = await dm(`/combats/${combatId}/timer`, { method: 'POST', body: JSON.stringify({ action: 'configure', seconds: null }) });
check('таймер можно выключить (NULL)', timerOff.body.combat?.settings?.turnTimerSeconds === null, timerOff.body.combat?.settings);
const playerTimer = await p1(`/combats/${combatId}/timer`, { method: 'POST', body: JSON.stringify({ action: 'reset' }) });
check('игрок не управляет таймером (403)', playerTimer.status === 403, playerTimer.status);

// ------------------------------------------------------------- журнал боя
const log = await dm(`/combats/${combatId}/log`);
check('GET /combats/:id/log 200', log.status === 200, log.status);
const eventTypes = (log.body.log ?? []).map((e) => e.eventType);
check('журнал содержит turn_start', eventTypes.includes('turn_start'), eventTypes.slice(0, 8));
check('журнал содержит combat_started', eventTypes.includes('combat_started'), eventTypes.slice(0, 8));
check('журнал содержит effect_added и damage', eventTypes.includes('effect_added') && eventTypes.includes('damage'), eventTypes.slice(0, 10));
const playerLog = await p1(`/combats/${combatId}/log`);
check('игрок не читает журнал мастера (403)', playerLog.status === 403, playerLog.status);

// ------------------------------------------------------------ WebSocket-синк
const dmSock = openSocket(dmAuth.cookie, combatId);
const p2Sock = openSocket(p2Auth.cookie, combatId);

const dmWelcome = await dmSock.waitFor((m) => m.type === 'welcome');
check('DM получает welcome', Boolean(dmWelcome.payload?.state?.participants), dmWelcome.payload?.role);
check('welcome: role=dm и полный стат-блок', dmWelcome.payload?.state?.participants?.some((p) => Boolean(p.statblock)));
const p2Welcome = await p2Sock.waitFor((m) => m.type === 'welcome');
check('игрок получает welcome', Boolean(p2Welcome.payload?.state?.participants));
check('welcome игрока: скрытые мобы без HP', p2Welcome.payload?.state?.participants?.find((p) => p.id === hiddenMonster?.id)?.currentHp === null);
check('welcome: peers содержат color/avatarUrl', (p2Welcome.payload?.peers ?? []).every((p) => 'color' in p && 'avatarUrl' in p), p2Welcome.payload?.peers);

const presence = await p2Sock.waitFor((m) => m.type === 'presence' && (m.payload?.peers ?? []).length >= 2);
check('presence приходит обоим участникам', presence.payload.peers.length >= 2, presence.payload.peers?.map((p) => p.userId));

await dm(`/combats/${combatId}/next-turn`, { method: 'POST', body: JSON.stringify({}) });
const pushState = await p2Sock.waitFor(
  (m) => m.type === 'state' && m.payload?.state?.participants?.some((p) => p.isCurrent)
);
check('изменение хода пушится игроку', Boolean(pushState.payload?.state), pushState.payload?.state?.currentTurnIndex);

await dm(`/combats/${combatId}/participants/${visibleMonster?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ hpDelta: -5 }),
});
const pushHp = await p2Sock.waitFor(
  (m) => m.type === 'state' && typeof m.payload?.state?.participants?.find((p) => p.id === visibleMonster?.id)?.hpPercent === 'number'
);
check('HP-изменение доходит по WS', true, pushHp.payload?.state?.participants?.find((p) => p.id === visibleMonster?.id)?.hpPercent);

// пинг/понг
p2Sock.send({ type: 'ping' });
const pong = await p2Sock.waitFor((m) => m.type === 'pong');
check('ping → pong', Boolean(pong.timestamp));

dmSock.ws.close();
p2Sock.ws.close();

// ------------------------------------- правка инициативы и состав в бою
const beforeReorder = await dm(`/combats/${combatId}`);
const currentBefore = (beforeReorder.body.combat?.participants ?? []).find((p) => p.isCurrent);
const reorder = await dm(`/combats/${combatId}/participants/${visibleMonster?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ initiativeValue: 99 }),
});
const reordered = reorder.body.combat?.participants ?? [];
check('инициатива пересортирована в бою', reordered[0]?.id === visibleMonster?.id && reordered[0]?.initiativeOrder === 0, reordered.map((p) => [p.displayName, p.initiativeValue, p.initiativeOrder]));
check(
  'текущий участник сохраняется при пересортировке',
  reordered.find((p) => p.isCurrent)?.id === currentBefore?.id,
  { before: currentBefore?.id, now: reordered.find((p) => p.isCurrent)?.id }
);

// ------------------------------- правка карточки участника (панель настроек)
// Регрессия: PATCH только с maxHp раньше отправлял value=undefined и обнулял
// текущие HP — участник «умирал» от смены максимума.
const heroBefore = (await dm(`/combats/${combatId}`)).body.combat?.participants?.find(
  (p) => p.id === heroParticipant?.id
);
const maxOnly = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ maxHp: (heroBefore?.maxHp ?? 12) + 4 }),
});
const heroMaxOnly = maxOnly.body.combat?.participants?.find((p) => p.id === heroParticipant?.id);
check(
  'смена только максимума HP сохраняет текущие HP',
  heroMaxOnly?.currentHp === heroBefore?.currentHp && heroMaxOnly?.maxHp === (heroBefore?.maxHp ?? 12) + 4,
  { before: [heroBefore?.currentHp, heroBefore?.maxHp], after: [heroMaxOnly?.currentHp, heroMaxOnly?.maxHp] }
);

const overMax = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ currentHp: 9999, tempHp: 7 }),
});
const heroOver = overMax.body.combat?.participants?.find((p) => p.id === heroParticipant?.id);
check(
  'текущие HP подрезаются до максимума, временные применяются',
  heroOver?.currentHp === heroOver?.maxHp && heroOver?.tempHp === 7,
  { hp: heroOver?.currentHp, max: heroOver?.maxHp, temp: heroOver?.tempHp }
);

const multiPatch = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    displayName: 'Герой E2E',
    armorClass: 17,
    hideName: true,
    notes: 'заметка E2E',
    isHiddenFromPlayers: false,
  }),
});
const heroPatched = multiPatch.body.combat?.participants?.find((p) => p.id === heroParticipant?.id);
check(
  'одним запросом применяются имя, КД, скрытие имени и заметки',
  heroPatched?.displayName === 'Герой E2E' &&
    heroPatched?.armorClass === 17 &&
    heroPatched?.hideName === true &&
    heroPatched?.notes === 'заметка E2E',
  { name: heroPatched?.displayName, ac: heroPatched?.armorClass, hide: heroPatched?.hideName, notes: heroPatched?.notes }
);

const restored = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    displayName: heroBefore?.displayName,
    armorClass: heroBefore?.armorClass,
    hideName: false,
    notes: heroBefore?.notes ?? '',
    maxHp: heroBefore?.maxHp,
    currentHp: heroBefore?.currentHp,
    tempHp: heroBefore?.tempHp ?? 0,
  }),
});
const heroRestored = restored.body.combat?.participants?.find((p) => p.id === heroParticipant?.id);
check(
  'сброс карточки участника к исходным значениям',
  heroRestored?.displayName === heroBefore?.displayName && heroRestored?.currentHp === heroBefore?.currentHp,
  { name: heroRestored?.displayName, hp: heroRestored?.currentHp }
);

const addMidFight = await dm(`/combats/${combatId}/participants`, {
  method: 'POST',
  body: JSON.stringify({
    participants: [{ participantType: 'monster', monsterBestiaryId: creatureA.id, initiativeValue: 5, quantity: 2 }],
  }),
});
const afterAdd = addMidFight.body.combat?.participants ?? [];
check('участников можно добавить в идущий бой', addMidFight.status === 200 && afterAdd.length === 6, afterAdd.length);
check(
  'добавленные экземпляры пронумерованы',
  afterAdd.filter((p) => p.monsterBestiaryId === creatureA.id).length === 4,
  afterAdd.filter((p) => p.monsterBestiaryId === creatureA.id).map((p) => p.displayName)
);
const addedParticipant = afterAdd.find((p) => p.initiativeValue === 5);
const removedParticipant = await dm(`/combats/${combatId}/participants/${addedParticipant?.id}`, { method: 'DELETE' });
check('участника можно убрать из боя', removedParticipant.status === 200 && (removedParticipant.body.combat?.participants ?? []).length === 5);

// -------------------------------------------------------- завершение и права
const finishByPlayer = await p1(`/combats/${combatId}`, { method: 'PATCH', body: JSON.stringify({ status: 'finished' }) });
check('игрок не завершает бой (403)', finishByPlayer.status === 403, finishByPlayer.status);

const finished = await dm(`/combats/${combatId}`, { method: 'PATCH', body: JSON.stringify({ status: 'finished' }) });
check('DM завершает бой', finished.body.combat?.status === 'finished', finished.body.combat?.status);
check('завершённый бой read-only для мастера', finished.body.combat?.canAdvanceTurn === true);
const patchAfterFinish = await dm(`/combats/${combatId}/participants/${heroParticipant?.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ hpDelta: -1 }),
});
check('правки после завершения отклоняются (409)', patchAfterFinish.status === 409, patchAfterFinish.status);
const playerSeesHistory = await p2(`/combats/${combatId}`);
check('игрок видит историю завершённого боя', playerSeesHistory.status === 200 && playerSeesHistory.body.combat?.status === 'finished');

// ---------------------------------------------------------------- уборка
const removed = await dm(`/combats/${combatId}`, { method: 'DELETE' });
check('DM удаляет бой', removed.status === 200 && removed.body.ok === true, removed.body);
const gone = await dm(`/combats/${combatId}`);
check('удалённый бой не найден (404)', gone.status === 404, gone.status);

// ------------------------------------------------------- регрессия: табы
const page = await fetch(`${BASE}/`);
const html = await page.text();
check('портал отдаёт приложение', page.ok && html.includes('<div id="root"'), page.status);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(`failures: ${failures.join(', ')}`);
  process.exitCode = 1;
}
