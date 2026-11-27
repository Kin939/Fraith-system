/**
 * E2E-проверка партии «Литература + личные квесты + история боёв».
 *
 * Запуск:
 *   1) npx wrangler dev --ip 0.0.0.0 --port 8788
 *   2) node scripts/e2e-literature.mjs
 *
 * Тест создаёт свои квест, файл и бой, а в конце всё удаляет.
 */
const BASE = 'http://127.0.0.1:8788';

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
    const headers = { cookie, ...(init.headers ?? {}) };
    if (init.body !== undefined && !(init.body instanceof FormData)) {
      headers['content-type'] = headers['content-type'] ?? 'application/json';
    }
    const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  };
}

const DM = { username: 'dm', password: 'Kin939' };
const P1 = { username: 'player1', password: 'Hero1-7394-Blade' };
const P2 = { username: 'player2', password: 'Hero2-5821-Runes' };
const P3 = { username: 'player3', password: 'Hero3-6149-Spark' };

const main = async () => {
  console.log('\n== авторизация ==');
  const dm = await login(DM.username, DM.password);
  const p1 = await login(P1.username, P1.password);
  const p2 = await login(P2.username, P2.password);
  const p3 = await login(P3.username, P3.password);
  check('dm login', dm.ok, dm.body);
  check('player1 login', p1.ok, p1.body);
  check('player2 login', p2.ok, p2.body);
  check('player3 login', p3.ok, p3.body);
  if (!dm.ok || !p1.ok || !p2.ok || !p3.ok) return;

  const dmApi = api(dm.cookie);
  const p1Api = api(p1.cookie);
  const p2Api = api(p2.cookie);
  const p3Api = api(p3.cookie);

  /* ------------------------------------------------------- ростер игроков */
  console.log('\n== /api/dm/players ==');
  const roster = await dmApi('/dm/players');
  check('dm roster 200', roster.status === 200, roster.status);
  const players = roster.body?.players ?? [];
  check('ростер содержит 3 игроков', players.length >= 3, players.length);
  const byPlayerId = Object.fromEntries(players.map((p) => [p.playerId, p.userId]));
  const idP1 = byPlayerId[1];
  const idP2 = byPlayerId[2];
  const idP3 = byPlayerId[3];
  check('есть id всех трёх игроков', Boolean(idP1 && idP2 && idP3), byPlayerId);
  check(
    'ростер отдаёт имя персонажа или аккаунта',
    players.every((p) => typeof p.displayName === 'string' && p.displayName.length > 0),
    players
  );
  const rosterForPlayer = await p1Api('/dm/players');
  check('игроку ростер запрещён (403)', rosterForPlayer.status === 403, rosterForPlayer.status);

  /* ---------------------------------------------------------- личные квесты */
  console.log('\n== личные квесты ==');
  const stamp = Date.now().toString(36);
  const personalQuest = await dmApi('/dm/quests', {
    method: 'POST',
    body: JSON.stringify({
      title: `Личный квест ${stamp}`,
      shortDesc: 'Виден только двоим',
      fullDesc: 'Секретная линия',
      progressCurrent: 0,
      progressTarget: 3,
      visibleUserIds: [idP2, idP3],
    }),
  });
  check('создан личный квест', personalQuest.status === 200, personalQuest.body);
  const createdQuest = (personalQuest.body?.quests ?? []).find((q) => q.title === `Личный квест ${stamp}`);
  check('в ответе есть visibleUserIds', Array.isArray(createdQuest?.visibleUserIds), createdQuest);
  check(
    'visibleUserIds сохранены (p2,p3)',
    JSON.stringify((createdQuest?.visibleUserIds ?? []).slice().sort()) ===
      JSON.stringify([idP2, idP3].sort()),
    createdQuest?.visibleUserIds
  );

  const publicQuest = await dmApi('/dm/quests', {
    method: 'POST',
    body: JSON.stringify({
      title: `Общий квест ${stamp}`,
      shortDesc: 'Для всех',
      fullDesc: '',
      progressCurrent: 0,
      progressTarget: 1,
      visibleUserIds: [],
    }),
  });
  check('создан общий квест', publicQuest.status === 200, publicQuest.body);

  const dmQuests = (await dmApi('/quests')).body?.quests ?? [];
  check(
    'мастер видит личный квест',
    dmQuests.some((q) => q.title === `Личный квест ${stamp}`),
    dmQuests.length
  );

  const q1 = (await p1Api('/quests')).body?.quests ?? [];
  const q2 = (await p2Api('/quests')).body?.quests ?? [];
  const q3 = (await p3Api('/quests')).body?.quests ?? [];
  check('player1 НЕ видит личный квест', !q1.some((q) => q.title === `Личный квест ${stamp}`), q1.length);
  check('player2 видит личный квест', q2.some((q) => q.title === `Личный квест ${stamp}`), q2.length);
  check('player3 видит личный квест', q3.some((q) => q.title === `Личный квест ${stamp}`), q3.length);
  check('player1 видит общий квест', q1.some((q) => q.title === `Общий квест ${stamp}`), q1.length);
  check('в списке player2 нет чужих полей', q2.every((q) => !('secretNotes' in q)));

  // заметки к личному квесту не должны протекать к постороннему игроку
  const noteBlocked = await p1Api(`/quests/${createdQuest.id}/notes`);
  check('player1 не получает заметки личного квеста', [403, 404].includes(noteBlocked.status), noteBlocked.status);
  const noteAllowed = await p2Api(`/quests/${createdQuest.id}/notes`);
  check('player2 получает заметки личного квеста', noteAllowed.status === 200, noteAllowed.status);

  // смена видимости: открыть player1 и закрыть остальных
  const updatedQuest = await dmApi(`/dm/quests/${createdQuest.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: createdQuest.title,
      shortDesc: createdQuest.shortDesc,
      fullDesc: createdQuest.fullDesc,
      progressCurrent: 0,
      progressTarget: 3,
      visibleUserIds: [idP1],
    }),
  });
  check('видимость квеста обновлена', updatedQuest.status === 200, updatedQuest.body);
  const q1After = (await p1Api('/quests')).body?.quests ?? [];
  const q2After = (await p2Api('/quests')).body?.quests ?? [];
  check('player1 теперь видит квест', q1After.some((q) => q.id === createdQuest.id), q1After.length);
  check('player2 больше не видит квест', !q2After.some((q) => q.id === createdQuest.id), q2After.length);

  /* ----------------------------------------------------------- литература */
  console.log('\n== литература ==');
  const txtFile = new File([`Заметки мастера\nстрока 2 ${stamp}`], `notes-${stamp}.txt`, {
    type: 'text/plain',
  });
  const pngBytes = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64'
    )
  );
  const imgFile = new File([pngBytes], `map-${stamp}.png`, { type: 'image/png' });
  const pdfFile = new File([new TextEncoder().encode('%PDF-1.4\n%test\n')], `handout-${stamp}.pdf`, {
    type: 'application/pdf',
  });
  const htmlFile = new File(['<script>alert(1)</script>'], `evil-${stamp}.html`, {
    type: 'text/html',
  });

  const fetchFile = (cookie, path) => fetch(`${BASE}${path}`, { headers: { cookie } });

  const upload = async (file, extra) => {
    const fd = new FormData();
    fd.append('file', file);
    if (extra?.title) fd.append('title', extra.title);
    if (extra?.description) fd.append('description', extra.description);
    fd.append('visibleUserIds', JSON.stringify(extra?.visibleUserIds ?? []));
    return dmApi('/dm/literature', { method: 'POST', body: fd });
  };

  const txtUpload = await upload(txtFile, {
    title: `Записи ${stamp}`,
    description: 'Текст для партии',
  });
  check('загрузка TXT', txtUpload.status === 200, txtUpload.body);
  check('определён kind=text', txtUpload.body?.file?.kind === 'text', txtUpload.body?.file?.kind);
  check('url файла есть', typeof txtUpload.body?.file?.url === 'string', txtUpload.body?.file);

  const imgUpload = await upload(imgFile, { title: `Карта ${stamp}`, visibleUserIds: [idP1, idP2] });
  check('загрузка PNG', imgUpload.status === 200, imgUpload.body);
  check('определён kind=image', imgUpload.body?.file?.kind === 'image', imgUpload.body?.file?.kind);

  const pdfUpload = await upload(pdfFile, { title: `Раздатка ${stamp}` });
  check('загрузка PDF', pdfUpload.status === 200, pdfUpload.body);
  check('определён kind=pdf', pdfUpload.body?.file?.kind === 'pdf', pdfUpload.body?.file?.kind);

  // Файл больше одного чанка D1 (200 КБ) — проверяем сборку «байт в байт».
  const bigBytes = new Uint8Array(520_000);
  for (let i = 0; i < bigBytes.length; i += 1) bigBytes[i] = (i * 31 + 7) % 256;
  const bigFile = new File([bigBytes], `tome-${stamp}.pdf`, { type: 'application/pdf' });
  const bigUpload = await upload(bigFile, { title: `Фолиант ${stamp}` });
  check('загрузка большого PDF (>2 чанков)', bigUpload.status === 200, bigUpload.status);
  const bigFetch = await fetchFile(p3.cookie, `/api/literature/${bigUpload.body?.file?.id}/file`);
  check('большой PDF читается', bigFetch.status === 200, bigFetch.status);
  const bigBack = new Uint8Array(await bigFetch.arrayBuffer());
  let sameBytes = bigBack.length === bigBytes.length;
  if (sameBytes) {
    for (let i = 0; i < bigBytes.length; i += 1) {
      if (bigBack[i] !== bigBytes[i]) {
        sameBytes = false;
        break;
      }
    }
  }
  check('байты многобайтового файла совпадают', sameBytes, {
    expected: bigBytes.length,
    actual: bigBack.length,
  });
  check(
    'размер в списке совпадает',
    (await dmApi('/literature')).body?.files?.find((f) => f.id === bigUpload.body?.file?.id)?.fileSize ===
      bigBytes.length
  );

  // Настоящий DOCX (zip с word/document.xml) — проверяем, что сервер не портит
  // байты: mammoth в браузере конвертирует именно этот поток в HTML.
  const DOCX_BASE64 = `UEsDBBQAAAAIAEw6e13XeYTq8QAAALgBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QzU7DMBCE730Ky9cqccoBIZSkB36OwKE8
wMreJFb9J69b2rdn00KREOVozXwz62nXB+/EHjPZGDq5qhspMOhobBg7+b55ru6koALBgIsBO3lEkut+0W6OCUkwHKiTUynpXinS
E3qgOiYMrAwxeyj8zKNKoLcworppmlulYygYSlXmDNkvhGgfcYCdK+LpwMr5loyOpHg4e+e6TkJKzmoorKt9ML+Kqq+SmsmThyab
aMkGqa6VzOL1jh/0lSfK1qB4g1xewLNRfcRslIl65xmu/0/649o4DFbjhZ/TUo4aiXh77+qL4sGG71+06jR8/wlQSwMEFAAAAAgA
TDp7XSAbhuqyAAAALgEAAAsAAABfcmVscy8ucmVsc43Puw6CMBQG4J2naM4uBQdjDIXFmLAafICmPZRGeklbL7y9HRzEODie23fy
N93TzOSOIWpnGdRlBQStcFJbxeAynDZ7IDFxK/nsLDJYMELXFs0ZZ57yTZy0jyQjNjKYUvIHSqOY0PBYOo82T0YXDE+5DIp6Lq5c
Id1W1Y6GTwPagpAVS3rJIPSyBjIsHv/h3ThqgUcnbgZt+vHlayPLPChMDB4uSCrf7TKzQHNKuorZvgBQSwMEFAAAAAgATDp7XQJ3
hCNAAQAA6QEAABEAAAB3b3JkL2RvY3VtZW50LnhtbI1RT0/CMBS/8yma3mVDE2MWNm7Eo4n6AepWYcnWLm1lckOIXjDh4M27d0Ig
EoH5FV6/ka9DTEw8eOjr77W/Py9tu3OfZ2TAlU6lCGmr6VPCRSyTVPRCen3VPTqjRBsmEpZJwUM65Jp2oka7DBIZ3+VcGIIOQgdl
SPvGFIHn6bjPc6absuAC726lypnBVvW8UqqkUDLmWmNAnnnHvn/q5SwVNGoQgq43Mhk6WDdF5MqFqrdLM8w4KYMBy0J6zpkbsUW9
qO39cOpiInizI6hgB2v4gDXpKpaavqOZmqz2kt8pB+kLbGAOC5gT+IQV+iC0s8B1FSzhHVawxbWxz7D6PiTwaid2ZB8wrYJt859J
KEK7HYY8EVjYKbrPYUOgsmM0m8HSTsiJ7xMkVTiUO57aR4LxVa0a/x3kwP4RHTp8UvQFUEsDBBQAAAAIAEw6e13T2p7WsQAAAO4A
AAAPAAAAd29yZC9zdHlsZXMueG1sNY4xbsMwDEX3nILgnsjOUBSGpWxBu6cHIGzWNiBRgijE8e2roPZG4vF9/v72Ch6enHWJYrG9
NAgsQxwXmSz+PO7nTwQtJCP5KGxxY8WbO/Vrp2XzrFB90W61OJeSOmN0mDmQXmJiqew35kClrnkya8xjynFg1RofvLk2zYcJtAi6
E8CRCWtXtlR/Jco0ZUozwo6+R4tfTO92LboqCIX3/ZN8LfAPoEXjerMbteoxqvsDUEsBAhQDFAAAAAgATDp7Xdd5hOrxAAAAuAEA
ABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACABMOntdIBuG6rIAAAAuAQAACwAAAAAAAAAA
AAAAgAEiAQAAX3JlbHMvLnJlbHNQSwECFAMUAAAACABMOntdAneEI0ABAADpAQAAEQAAAAAAAAAAAAAAgAH9AQAAd29yZC9kb2N1
bWVudC54bWxQSwECFAMUAAAACABMOntd09qe1rEAAADuAAAADwAAAAAAAAAAAAAAgAFsAwAAd29yZC9zdHlsZXMueG1sUEsFBgAA
AAAEAAQA9gAAAEoEAAAAAA==`;
  const docxBytes = Buffer.from(DOCX_BASE64.replace(/\s+/g, ''), 'base64');
  const docxFile = new File([docxBytes], `chronicle-${stamp}.docx`, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const docxUpload = await upload(docxFile, { title: `Хроники ${stamp}` });
  check('загрузка DOCX', docxUpload.status === 200, docxUpload.body);
  check('определён kind=docx', docxUpload.body?.file?.kind === 'docx', docxUpload.body?.file?.kind);
  const docxBack = await fetchFile(p2.cookie, `/api/literature/${docxUpload.body?.file?.id}/file`);
  check('DOCX читается', docxBack.status === 200, docxBack.status);
  const docxRound = Buffer.from(await docxBack.arrayBuffer());
  check('байты DOCX не изменились', docxRound.equals(docxBytes), {
    expected: docxBytes.length,
    actual: docxRound.length,
  });
  // DOCX браузер не умеет показывать сам — отдаём вложением, а клиент читает
  // поток через fetch() и конвертирует mammoth-ом.
  check(
    'DOCX отдаётся вложением',
    (docxBack.headers.get('content-disposition') ?? '').startsWith('attachment'),
    docxBack.headers.get('content-disposition')
  );

  const htmlUpload = await upload(htmlFile, { title: 'Злой файл' });
  check('HTML отклонён', htmlUpload.status === 400, htmlUpload.status);

  const playerUpload = await (async () => {
    const fd = new FormData();
    fd.append('file', txtFile);
    fd.append('visibleUserIds', '[]');
    return p1Api('/dm/literature', { method: 'POST', body: fd });
  })();
  check('игрок не может загружать (403)', playerUpload.status === 403, playerUpload.status);

  const dmList = await dmApi('/literature');
  check('dm видит список', dmList.status === 200, dmList.status);
  const dmFiles = dmList.body?.files ?? [];
  check('dm видит все загруженные файлы', dmFiles.length >= 4, dmFiles.length);
  check('dm isDm=true', dmList.body?.isDm === true);

  const p1List = (await p1Api('/literature')).body?.files ?? [];
  const p2List = (await p2Api('/literature')).body?.files ?? [];
  const p3List = (await p3Api('/literature')).body?.files ?? [];
  const hasFile = (list, title) => list.some((f) => f.title === title);
  check('player1 видит карту', hasFile(p1List, `Карта ${stamp}`));
  check('player2 видит карту', hasFile(p2List, `Карта ${stamp}`));
  check('player3 НЕ видит карту', !hasFile(p3List, `Карта ${stamp}`));
  check('player3 видит общую раздатку', hasFile(p3List, `Раздатка ${stamp}`));
  check('игрок не получает флаг canManage', p1List.every((f) => f.canManage === false));

  // скачивание файла с проверкой прав
  const idTxt = txtUpload.body.file.id;
  const idImg = imgUpload.body.file.id;

  const txtForP3 = await fetchFile(p3.cookie, `/api/literature/${idTxt}/file`);
  check('player3 читает общий TXT', txtForP3.status === 200, txtForP3.status);
  const txtText = await txtForP3.text();
  check('текст файла совпадает', txtText.includes(`строка 2 ${stamp}`), txtText.slice(0, 40));
  check(
    'TXT отдаётся инлайн',
    (txtForP3.headers.get('content-disposition') ?? '').startsWith('inline'),
    txtForP3.headers.get('content-disposition')
  );

  const imgForP3 = await fetchFile(p3.cookie, `/api/literature/${idImg}/file`);
  check('player3 НЕ получает личную карту', imgForP3.status === 404, imgForP3.status);
  const imgForP1 = await fetchFile(p1.cookie, `/api/literature/${idImg}/file`);
  check('player1 получает личную карту', imgForP1.status === 200, imgForP1.status);
  check(
    'картинка отдаётся с image/png',
    (imgForP1.headers.get('content-type') ?? '').includes('image/png'),
    imgForP1.headers.get('content-type')
  );

  const pdfForP1 = await fetchFile(p1.cookie, `/api/literature/${pdfUpload.body.file.id}/file`);
  check('PDF читается инлайн', pdfForP1.status === 200, pdfForP1.status);
  check(
    'PDF content-type application/pdf',
    (pdfForP1.headers.get('content-type') ?? '').includes('application/pdf'),
    pdfForP1.headers.get('content-type')
  );

  const unknownFile = await fetchFile(p1.cookie, '/api/literature/999999/file');
  check('несуществующий файл → 404', unknownFile.status === 404, unknownFile.status);

  // смена видимости файла игроком запрещена, мастером — разрешена
  const playerPatch = await p1Api(`/dm/literature/${idImg}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibleUserIds: [idP3] }),
  });
  check('игрок не может менять видимость (403)', playerPatch.status === 403, playerPatch.status);

  const dmPatch = await dmApi(`/dm/literature/${idImg}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibleUserIds: [idP3], title: `Карта ${stamp} (для P3)` }),
  });
  check('мастер меняет видимость файла', dmPatch.status === 200, dmPatch.body);
  const p3After = (await p3Api('/literature')).body?.files ?? [];
  const p1After = (await p1Api('/literature')).body?.files ?? [];
  check('player3 теперь видит карту', hasFile(p3After, `Карта ${stamp} (для P3)`), p3After.length);
  check('player1 больше не видит карту', !hasFile(p1After, `Карта ${stamp} (для P3)`), p1After.length);

  // удаление
  const delTxt = await dmApi(`/dm/literature/${idTxt}`, { method: 'DELETE' });
  check('мастер удаляет файл', delTxt.status === 200, delTxt.body);
  const afterDelete = (await dmApi('/literature')).body?.files ?? [];
  check('удалённый файл исчез', !afterDelete.some((f) => f.id === idTxt), afterDelete.length);
  const deletedFetch = await fetchFile(p1.cookie, `/api/literature/${idTxt}/file`);
  check('удалённый файл → 404', deletedFetch.status === 404, deletedFetch.status);

  /* --------------------------------------------------------- история боёв */
  console.log('\n== история боёв ==');
  let bestiary = await dmApi('/combats/bestiary');
  let creature = (bestiary.body?.creatures ?? [])[0];
  let seededCreatureId = null;
  if (!creature) {
    // Локальная D1 может быть пустой — заводим существо для истории боёв.
    await dmApi('/dm/bestiary', {
      method: 'POST',
      body: JSON.stringify({ name: `E2E Гоблин ${stamp}`, cr: '0.25', hp: '7', ac: 13, xp: 50 }),
    });
    bestiary = await dmApi('/combats/bestiary');
    creature = (bestiary.body?.creatures ?? []).find((c) => c.name === `E2E Гоблин ${stamp}`);
    seededCreatureId = creature?.id ?? null;
  }
  const members = await dmApi('/combats/members');
  const member = (members.body?.players ?? [])[0];
  check('есть существо и игрок для боя', Boolean(creature && member), {
    creature: creature?.name,
    member: member?.displayName,
  });

  let combatId = null;
  if (creature && member) {
    const participants = [
      {
        participantType: 'player',
        userId: member.userId,
        playerId: member.playerId,
        displayName: member.characterName || member.displayName,
        initiative: 15,
        maxHp: 20,
        currentHp: 20,
        armorClass: 14,
      },
      {
        participantType: 'monster',
        creatureId: creature.id,
        displayName: creature.name,
        initiative: 9,
        maxHp: 12,
        currentHp: 12,
        armorClass: 12,
        hideName: true,
      },
    ];
    const created = await dmApi('/combats', {
      method: 'POST',
      body: JSON.stringify({ name: `E2E бой ${stamp}`, participants }),
    });
    check('бой создан', created.status === 200, created.body);
    combatId = created.body?.combat?.id ?? null;

    if (combatId) {
      const logWhileSetup = await p1Api(`/combats/${combatId}/log`);
      check('журнал живого боя скрыт от игрока (403)', logWhileSetup.status === 403, logWhileSetup.status);

      await dmApi(`/combats/${combatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      const logWhileActive = await p1Api(`/combats/${combatId}/log`);
      check('журнал идущего боя скрыт от игрока (403)', logWhileActive.status === 403, logWhileActive.status);

      await dmApi(`/combats/${combatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'finished' }),
      });

      const history = await p1Api('/combats/history');
      check('игрок видит историю боёв', history.status === 200, history.status);
      const entry = (history.body?.combats ?? []).find((c) => c.id === combatId);
      check('завершённый бой в истории', Boolean(entry), history.body?.combats?.length);
      check('в истории есть участники', Array.isArray(entry?.participants) && entry.participants.length === 2, entry?.participants?.length);
      check('раунды посчитаны', typeof entry?.roundNumber === 'number', entry?.roundNumber);
      check(
        'скрытое существо замаскировано',
        (entry?.participants ?? []).some((p) => p.name === 'Неизвестное существо'),
        entry?.participants?.map((p) => p.name)
      );

      const dmHistory = await dmApi('/combats/history');
      const dmEntry = (dmHistory.body?.combats ?? []).find((c) => c.id === combatId);
      check('мастер видит настоящее имя', (dmEntry?.participants ?? []).some((p) => p.name === creature.name), dmEntry?.participants?.map((p) => p.name));

      const logFinished = await p1Api(`/combats/${combatId}/log`);
      check('игрок читает журнал завершённого боя', logFinished.status === 200, logFinished.status);
      check('журнал не пустой', (logFinished.body?.log ?? []).length > 0, logFinished.body?.log?.length);
      const leaked = (logFinished.body?.log ?? []).some(
        (entryLog) => entryLog.payload?.name === creature.name
      );
      check('в журнале игрока нет скрытых имён', !leaked);

      await dmApi(`/combats/${combatId}`, { method: 'DELETE' });
    }
  }

  /* --------------------------------------------------------------- уборка */
  console.log('\n== уборка ==');
  await dmApi(`/dm/quests/${createdQuest.id}`, { method: 'DELETE' });
  const publicCreated = (publicQuest.body?.quests ?? []).find((q) => q.title === `Общий квест ${stamp}`);
  if (publicCreated) await dmApi(`/dm/quests/${publicCreated.id}`, { method: 'DELETE' });
  for (const file of [imgUpload, pdfUpload, bigUpload, docxUpload]) {
    if (file.body?.file?.id) await dmApi(`/dm/literature/${file.body.file.id}`, { method: 'DELETE' });
  }
  if (seededCreatureId) await dmApi(`/dm/bestiary/${seededCreatureId}`, { method: 'DELETE' });
  const leftovers = (await dmApi('/quests')).body?.quests ?? [];
  check('квесты убраны', !leftovers.some((q) => q.title.endsWith(stamp)), leftovers.length);

  console.log(`\nИтог: ${passed} ok, ${failures.length} fail`);
  if (failures.length > 0) {
    console.log('Провалено:', failures.join('; '));
    process.exitCode = 1;
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
