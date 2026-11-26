/**
 * Проверка персистентности доски через перезапуск воркера (эвикция DO).
 *
 *   node scripts/e2e-board-persist.mjs write   → создаёт доску, пишет фигуры, удаляет одну, печатает id
 *   node scripts/e2e-board-persist.mjs verify <boardId>
 *
 * Между фазами нужно перезапустить `wrangler dev`: только так из памяти уходит
 * инстанс DO, и проверяется реальная запись в storage, а не кэш воркера.
 */
import WebSocket from 'ws';

const BASE = 'http://127.0.0.1:8788';
const WSBASE = 'ws://127.0.0.1:8788';

const phase = process.argv[2];
const boardArg = process.argv[3];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  return { ok: res.ok, cookie };
}

function openSocket(cookie, boardId) {
  const ws = new WebSocket(`${WSBASE}/api/boards/${boardId}/ws`, { headers: { cookie } });
  const client = { log: [], ws };
  ws.on('message', (raw) => {
    try {
      client.log.push(JSON.parse(raw.toString()));
    } catch {
      /* ignore */
    }
  });
  ws.on('error', () => {});
  client.send = (msg) => ws.send(JSON.stringify(msg));
  ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', payload: { lastSeq: -1 } })));
  client.waitFor = async (pred, timeout = 5000) => {
    const started = Date.now();
    let cursor = 0;
    while (Date.now() - started < timeout) {
      while (cursor < client.log.length) {
        const msg = client.log[cursor++];
        if (pred(msg)) return msg;
      }
      await sleep(25);
    }
    throw new Error(`timeout; log=${JSON.stringify(client.log.slice(-5))}`);
  };
  return client;
}

const shape = (id, x) => ({
  id,
  typeName: 'shape',
  type: 'geo',
  x,
  y: 30,
  rotation: 0,
  index: 'a1',
  parentId: 'page:page',
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    geo: 'rectangle', w: 120, h: 70, color: 'black', labelColor: 'black', fill: 'none',
    dash: 'draw', size: 'm', font: 'draw', align: 'middle', verticalAlign: 'middle',
    growY: 0, url: '', richText: { type: 'doc' },
  },
});

const auth = await login('player1', 'Hero1-7394-Blade');
check('логин player1', auth.ok);

if (phase === 'write') {
  const created = await fetch(`${BASE}/api/boards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: auth.cookie },
    body: JSON.stringify({ name: `Persist ${Date.now()}` }),
  });
  const body = await created.json();
  const boardId = body.board?.id;
  check('доска создана', Boolean(boardId), body);
  console.log(`BOARD_ID=${boardId}`);

  const sock = openSocket(auth.cookie, boardId);
  await sock.waitFor((m) => m.type === 'welcome');

  // Автор diff не получает собственное сообщение назад — ждём на наблюдателе.
  const observer = openSocket(auth.cookie, boardId);
  await observer.waitFor((m) => m.type === 'welcome');

  sock.send({
    type: 'diff',
    payload: {
      diff: {
        added: { 'shape:keep': shape('shape:keep', 20), 'shape:gone': shape('shape:gone', 200) },
        updated: {},
        removed: {},
      },
    },
  });
  await observer.waitFor((m) => m.type === 'diff' && m.payload?.diff?.added?.['shape:keep']);
  await sleep(120);
  sock.send({
    type: 'diff',
    payload: {
      diff: { added: {}, updated: {}, removed: { 'shape:gone': shape('shape:gone', 200) } },
    },
  });
  await observer.waitFor((m) => m.type === 'diff' && m.payload?.diff?.removed?.['shape:gone']);

  if (process.argv.includes('--keep-open')) {
    // Жёсткий сценарий: сокет остаётся открытым, воркер убивают снаружи.
    // Никакого webSocketClose → persistDoc не вызывается, работает только
    // немедленная запись при удалении и alarm-подстраховка.
    console.log('READY');
    await sleep(120000);
  }

  observer.ws.close();
  sock.ws.close();
  await sleep(300);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length > 0 ? 1 : 0);
}

if (phase === 'verify') {
  const boardId = boardArg;
  if (!boardId) {
    console.error('нужен boardId');
    process.exit(2);
  }
  const sock = openSocket(auth.cookie, boardId);
  const welcome = await sock.waitFor((m) => m.type === 'welcome');
  const records = {};
  if (welcome.payload?.mode === 'snapshot') {
    await sock.waitFor((m) => m.type === 'snapshot:chunk' && m.payload?.done === true);
    for (const msg of sock.log) {
      if (msg.type === 'snapshot:chunk') Object.assign(records, msg.payload?.records ?? {});
    }
  }
  check('после перезапуска воркера документ отдан снапшотом', welcome.payload?.mode === 'snapshot', welcome.payload?.mode);
  check('удалённая фигура не воскресла', !('shape:gone' in records), Object.keys(records));
  check('сохранённая фигура на месте', Boolean(records['shape:keep']), Object.keys(records));
  sock.ws.close();

  const del = await fetch(`${BASE}/api/boards/${boardId}`, { method: 'DELETE', headers: { cookie: auth.cookie } });
  check('тестовая доска удалена', del.ok, del.status);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length > 0 ? 1 : 0);
}

console.error('usage: node scripts/e2e-board-persist.mjs write | verify <boardId>');
process.exit(2);
