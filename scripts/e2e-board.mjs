/**
 * E2E-проверка доски (REST + WebSocket) против локального `wrangler dev`.
 * Запуск: node scripts/e2e-board.mjs (нужен локальный wrangler dev на :8788)
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

function openSocket(cookie, boardId) {
  const ws = new WebSocket(`${WSBASE}/api/boards/${boardId}/ws`, {
    headers: { cookie },
  });
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
  client.send = (msg) => ws.send(JSON.stringify(msg));
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'hello', payload: { lastSeq: -1 } }));
  });
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DM_PASS = 'Kin939';
const P1_PASS = 'Hero1-7394-Blade';
const P2_PASS = 'Hero2-5821-Runes';

const stamp = Date.now();
const BOARD_NAME = `E2E борд ${stamp}`;

const dmAuth = await login('dm', DM_PASS);
check('DM логин', dmAuth.ok, dmAuth.body);
const p1Auth = await login('player1', P1_PASS);
check('player1 логин', p1Auth.ok, p1Auth.body);
const p2Auth = await login('player2', P2_PASS);
check('player2 логин', p2Auth.ok, p2Auth.body);

const dm = api(dmAuth.cookie);
const p1 = api(p1Auth.cookie);
const p2 = api(p2Auth.cookie);

// ---------------------------------------------------------------- REST: списки
const dmList = await dm('/boards');
check('GET /boards (DM) 200', dmList.status === 200, dmList.status);
check('DM: isDm=true и canManage', dmList.body.isDm === true && dmList.body.canManage === true, {
  isDm: dmList.body.isDm,
  canManage: dmList.body.canManage,
});
check('DM: поля доски содержат fontPreset/bgColor/canEdit',
  (dmList.body.boards ?? []).every((b) => 'fontPreset' in b && 'bgColor' in b && 'canEdit' in b),
  dmList.body.boards?.[0]);

const p1List = await p1('/boards');
check('GET /boards (player1) 200', p1List.status === 200, p1List.status);

// --------------------------------------------------- игрок создаёт доску сам
const created = await p1('/boards', { method: 'POST', body: JSON.stringify({ name: BOARD_NAME }) });
check('игрок может создать доску', created.status === 200 && Boolean(created.body.board?.id), created.body);
const boardId = created.body.board?.id;
check('автор получает canEdit=true', created.body.board?.canEdit === true, created.body.board);
check('новая доска: фон по умолчанию dots', created.body.board?.background === 'dots', created.body.board?.background);
check('новая доска: шрифт по умолчанию classic', created.body.board?.fontPreset === 'classic', created.body.board?.fontPreset);
check('новая доска: цвет по умолчанию пустой', created.body.board?.bgColor === '', created.body.board?.bgColor);

const p2Sees = await p2('/boards');
const p2Board = (p2Sees.body.boards ?? []).find((b) => b.id === boardId);
check('доска игрока видна другому игроку', Boolean(p2Board), p2Sees.body.boards?.map((b) => b.name));
check('второй игрок получает write', p2Board?.permission === 'write', p2Board?.permission);
check('второй игрок не может управлять чужой доской', p2Board?.canEdit === false, p2Board?.canEdit);

const membersList = await p1('/boards');
check('список участников содержит avatarUrl',
  (membersList.body.members ?? []).every((m) => 'avatarUrl' in m),
  membersList.body.members);

// --------------------------------------------------------- права/настройки
const blockedPatch = await p2(`/boards/${boardId}`, {
  method: 'PATCH',
  body: JSON.stringify({ name: 'взлом' }),
});
check('не-автор не может менять доску (403)', blockedPatch.status === 403, blockedPatch.status);

const patched = await p1(`/boards/${boardId}`, {
  method: 'PATCH',
  body: JSON.stringify({ bgColor: '#1A1020', fontPreset: 'modern', background: 'squares' }),
});
check('автор меняет фон/цвет/шрифт', patched.status === 200, patched.status);
check('PATCH: bgColor нормализован в нижний регистр', patched.body.board?.bgColor === '#1a1020', patched.body.board?.bgColor);
check('PATCH: fontPreset=modern', patched.body.board?.fontPreset === 'modern', patched.body.board?.fontPreset);
check('PATCH: background=squares', patched.body.board?.background === 'squares', patched.body.board?.background);

const invalidColor = await p1(`/boards/${boardId}`, {
  method: 'PATCH',
  body: JSON.stringify({ bgColor: 'javascript:alert(1)' }),
});
check('некорректный цвет отвергнут (сброс в тему)', invalidColor.body.board?.bgColor === '', invalidColor.body.board?.bgColor);

await p1(`/boards/${boardId}`, {
  method: 'PATCH',
  body: JSON.stringify({ bgColor: '#0d1b2a', fontPreset: 'modern', background: 'squares' }),
});

const persisted = await p1('/boards');
const persistedBoard = (persisted.body.boards ?? []).find((b) => b.id === boardId);
check('настройки сохраняются в списке',
  persistedBoard?.bgColor === '#0d1b2a' && persistedBoard?.fontPreset === 'modern' && persistedBoard?.background === 'squares',
  persistedBoard);

// ------------------------------------------------------------------- WebSocket
const dmSock = openSocket(dmAuth.cookie, boardId);
const p1Sock = openSocket(p1Auth.cookie, boardId);

const dmWelcome = await dmSock.waitFor((m) => m.type === 'welcome');
check('DM получил welcome', Boolean(dmWelcome.payload?.selfId), dmWelcome.payload?.mode);
check('welcome содержит timer/comments/votes',
  'timer' in dmWelcome.payload && 'comments' in dmWelcome.payload && 'votes' in dmWelcome.payload);
const p1Welcome = await p1Sock.waitFor((m) => m.type === 'welcome');
check('player1 получил welcome', Boolean(p1Welcome.payload?.selfId));
check('welcome: permission=write', p1Welcome.payload?.permission === 'write', p1Welcome.payload?.permission);
check('welcome: peers содержат avatarUrl',
  (p1Welcome.payload?.peers ?? []).every((p) => 'avatarUrl' in p),
  p1Welcome.payload?.peers);

const diff = {
  added: {
    'shape:test-e2e': {
      id: 'shape:test-e2e',
      typeName: 'shape',
      type: 'geo',
      x: 10,
      y: 10,
      rotation: 0,
      index: 'a1',
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      meta: {},
      props: { geo: 'rectangle', w: 100, h: 60, color: 'black', labelColor: 'black', fill: 'none', dash: 'draw', size: 'm', font: 'draw', align: 'middle', verticalAlign: 'middle', growY: 0, url: '', richText: { type: 'doc' } },
    },
  },
  updated: {},
  removed: {},
};
p1Sock.send({ type: 'diff', payload: { diff } });
const relayed = await dmSock.waitFor((m) => m.type === 'diff');
check('diff транслируется другим участникам', relayed.payload?.diff?.added?.['shape:test-e2e']?.type === 'geo');
check('diff нумеруется seq', typeof relayed.payload?.seq === 'number' && relayed.payload.seq > 0, relayed.payload?.seq);

p1Sock.send({ type: 'cursor', payload: { x: 123.5, y: 45.25, pageId: 'page:page' } });
const cursor = await dmSock.waitFor((m) => m.type === 'cursor');
check('курсор транслируется', cursor.payload?.x === 123.5 && cursor.payload?.y === 45.25, cursor.payload);
check('курсор несёт имя и цвет', Boolean(cursor.payload?.displayName) && Boolean(cursor.payload?.color), cursor.payload);

p1Sock.send({ type: 'selection', payload: { ids: ['shape:test-e2e'] } });
const selection = await dmSock.waitFor((m) => m.type === 'selection');
check('выделение транслируется', Array.isArray(selection.payload?.ids) && selection.payload.ids.length === 1, selection.payload);

p1Sock.send({ type: 'comment:add', payload: { text: 'Проверка коммента', x: 10, y: 20, shapeId: 'shape:test-e2e', mentions: [1] } });
const commentMsg = await dmSock.waitFor((m) => m.type === 'comment:add');
check('комментарий транслируется', commentMsg.payload?.comment?.text === 'Проверка коммента', commentMsg.payload?.comment);
check('комментарий несёт упоминание', (commentMsg.payload?.comment?.mentions ?? []).includes(1));
const commentId = commentMsg.payload?.comment?.id;

p1Sock.send({ type: 'comment:resolve', payload: { commentId, resolved: true } });
const resolvedMsg = await dmSock.waitFor((m) => m.type === 'comment:update' && m.payload?.comment?.resolved === true);
check('комментарий резолвится', resolvedMsg.payload?.comment?.resolved === true);

p1Sock.send({ type: 'vote', payload: { shapeId: 'shape:test-e2e', delta: 1 } });
const votes = await dmSock.waitFor((m) => m.type === 'votes');
check('голос засчитан', (votes.payload?.votes?.['shape:test-e2e']?.['2'] ?? 0) === 1, votes.payload?.votes);

p1Sock.send({ type: 'timer', payload: { action: 'set', durationMs: 300000 } });
const timerSet = await dmSock.waitFor((m) => m.type === 'timer' && m.payload?.timer?.durationMs === 300000);
check('таймер: установка длительности', timerSet.payload?.timer?.durationMs === 300000, timerSet.payload?.timer);
p1Sock.send({ type: 'timer', payload: { action: 'start' } });
const timerStart = await dmSock.waitFor((m) => m.type === 'timer' && m.payload?.timer?.running === true);
check('таймер: запуск', timerStart.payload?.timer?.running === true && typeof timerStart.payload.timer.startedAt === 'number');
p1Sock.send({ type: 'timer', payload: { action: 'reset' } });
const timerReset = await dmSock.waitFor((m) => m.type === 'timer' && m.payload?.timer?.running === false);
check('таймер: сброс', timerReset.payload?.timer?.durationMs === 0 || timerReset.payload?.timer?.elapsedMs === 0, timerReset.payload?.timer);

// ------------------------------------------------- права только для чтения
await p1(`/boards/${boardId}`, {
  method: 'PATCH',
  body: JSON.stringify({ access: [{ userId: 3, permission: 'read' }] }),
});
const p2ReadSock = openSocket(p2Auth.cookie, boardId);
const p2Welcome = await p2ReadSock.waitFor((m) => m.type === 'welcome');
check('read-права применяются к WS', p2Welcome.payload?.permission === 'read', p2Welcome.payload?.permission);

const beforeReadDiff = p1Sock.log.filter((m) => m.type === 'diff').length;
p2ReadSock.send({ type: 'diff', payload: { diff } });
await sleep(600);
const afterReadDiff = p1Sock.log.filter((m) => m.type === 'diff').length;
check('read-участник не может писать в документ', beforeReadDiff === afterReadDiff, { beforeReadDiff, afterReadDiff });

// ------------------------------------------- персистентность: удаление фигур
// Регрессия: diff с removed раньше терялся при закрытии сокета (дебаунс жил
// в памяти DO и умирал вместе с инстансом), и удалённая фигура возвращалась
// после F5. Теперь удаление сохраняется сразу + есть alarm-подстраховка.
const persistSock = openSocket(p1Auth.cookie, boardId);
const persistWelcome = await persistSock.waitFor((m) => m.type === 'welcome');
check('persist: сокет открыт', Boolean(persistWelcome.payload?.selfId));

// Автор diff не получает эхо — подтверждение ждём на наблюдателе.
const persistObserver = openSocket(dmAuth.cookie, boardId);
await persistObserver.waitFor((m) => m.type === 'welcome');

const makeShape = (id) => ({
  id,
  typeName: 'shape',
  type: 'geo',
  x: 40,
  y: 40,
  rotation: 0,
  index: 'a2',
  parentId: 'page:page',
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    geo: 'ellipse', w: 80, h: 80, color: 'black', labelColor: 'black', fill: 'none',
    dash: 'draw', size: 'm', font: 'draw', align: 'middle', verticalAlign: 'middle',
    growY: 0, url: '', richText: { type: 'doc' },
  },
});

const persistentId = 'shape:persist-delete';
persistSock.send({
  type: 'diff',
  payload: { diff: { added: { [persistentId]: makeShape(persistentId) }, updated: {}, removed: {} } },
});
await persistObserver.waitFor((m) => m.type === 'diff' && m.payload?.diff?.added?.[persistentId]);
await sleep(150);

persistSock.send({
  type: 'diff',
  payload: { diff: { added: {}, updated: {}, removed: { [persistentId]: makeShape(persistentId) } } },
});
const removedEcho = await persistObserver.waitFor(
  (m) => m.type === 'diff' && m.payload?.diff?.removed && persistentId in m.payload.diff.removed
);
check('persist: удаление принято и разослано', Boolean(removedEcho), removedEcho?.payload?.seq);

// Закрываем сокеты сразу после удаления — именно этот сценарий терял данные.
persistObserver.ws.close();
persistSock.ws.close();
await sleep(2200);

const reopenSock = openSocket(p1Auth.cookie, boardId);
const reopenWelcome = await reopenSock.waitFor((m) => m.type === 'welcome');
let reopenedRecords = {};
if (reopenWelcome.payload?.mode === 'snapshot') {
  await reopenSock.waitFor((m) => m.type === 'snapshot:chunk' && m.payload?.done === true);
  for (const msg of reopenSock.log) {
    if (msg.type === 'snapshot:chunk') Object.assign(reopenedRecords, msg.payload?.records ?? {});
  }
}
check('persist: после переподключения режим snapshot', reopenWelcome.payload?.mode === 'snapshot', reopenWelcome.payload?.mode);
check('persist: удалённая фигура не вернулась', !(persistentId in reopenedRecords), Object.keys(reopenedRecords));
check('persist: ранее добавленная фигура на месте', Boolean(reopenedRecords['shape:test-e2e']), Object.keys(reopenedRecords));
reopenSock.ws.close();

// ------------------------------------ досылка патчей без сокета (HTTP fallback)
// Клиент закрывает вкладку/теряет сокет — очередь правок уходит через fetch(keepalive).
const httpShapeId = 'shape:http-diff';
const httpObserver = openSocket(dmAuth.cookie, boardId);
await httpObserver.waitFor((m) => m.type === 'welcome');

const httpAdd = await p1(`/boards/${boardId}/diffs`, {
  method: 'POST',
  body: JSON.stringify({
    diffs: [{ added: { [httpShapeId]: makeShape(httpShapeId) }, updated: {}, removed: {} }],
  }),
});
check('HTTP-досылка патча принимается', httpAdd.status === 200 && httpAdd.body.applied === 1, httpAdd.body);
const httpEcho = await httpObserver.waitFor(
  (m) => m.type === 'diff' && m.payload?.diff?.added?.[httpShapeId]
);
check('HTTP-патч транслируется по WS остальным', Boolean(httpEcho), httpEcho?.payload?.seq);

const httpRemove = await p1(`/boards/${boardId}/diffs`, {
  method: 'POST',
  body: JSON.stringify({
    diffs: [{ added: {}, updated: {}, removed: { [httpShapeId]: makeShape(httpShapeId) } }],
  }),
});
check('HTTP-удаление применяется', httpRemove.status === 200 && httpRemove.body.applied === 1, httpRemove.body);

const httpForbidden = await p2(`/boards/${boardId}/diffs`, {
  method: 'POST',
  body: JSON.stringify({ diffs: [{ added: { 'shape:evil': makeShape('shape:evil') }, updated: {}, removed: {} }] }),
});
check('read-права не могут досылать патчи (403)', httpForbidden.status === 403, httpForbidden.status);

const httpEmpty = await p1(`/boards/${boardId}/diffs`, { method: 'POST', body: JSON.stringify({ diffs: [] }) });
check('пустая очередь не ошибка', httpEmpty.status === 200 && httpEmpty.body.applied === 0, httpEmpty.body);
httpObserver.ws.close();

// ---------------------------------------------------------------- удаление
const blockedDelete = await p2(`/boards/${boardId}`, { method: 'DELETE' });
check('не-автор не может удалить доску (403)', blockedDelete.status === 403, blockedDelete.status);

const deleted = await p1(`/boards/${boardId}`, { method: 'DELETE' });
check('автор удаляет доску', deleted.status === 200, deleted.body);
const afterDelete = await p1('/boards');
check('доска исчезла из списка', !(afterDelete.body.boards ?? []).some((b) => b.id === boardId));

const dmDeleteForeign = await dm(`/boards/${boardId}`, { method: 'DELETE' });
check('удалённая доска → 404 для DM', dmDeleteForeign.status === 404, dmDeleteForeign.status);

for (const sock of [dmSock, p1Sock, p2ReadSock]) {
  try {
    sock.ws.close();
  } catch {
    /* ignore */
  }
}
await sleep(200);

console.log(`\n${passed}/${passed + failures.length} проверок пройдено`);
if (failures.length) {
  console.log('Провалы:', failures);
  process.exit(1);
}
