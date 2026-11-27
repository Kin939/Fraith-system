/**
 * E2E: НПС из «Связей» в бою + редактируемый боевой лист.
 *
 * Запуск:
 *   1) npx wrangler dev --ip 0.0.0.0 --port 8788
 *   2) node scripts/e2e-npc-combat.mjs
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

const SHEET = {
  ac: 15,
  hp: 22,
  hitDice: '4d8 + 4',
  speed: '30 фт.',
  cr: '2',
  initiativeBonus: 3,
  abilities: { str: 14, dex: 16, con: 12, int: 10, mud: 13, cha: 8 },
  saves: 'ЛОВ +5',
  skills: 'Внимательность +3',
  senses: 'тёмное зрение 60 фт.',
  languages: 'общий, эльфийский',
  traits: 'Стойкий: преимущество против страха',
  actions: 'Мультиатака: два удара рапирой, +5, 1d8+3 колющего',
  bonusActions: 'Хитрое действие',
  reactions: 'Парирование',
  legendary: '',
};

const main = async () => {
  const dm = await login('dm', 'Kin939');
  const p1 = await login('player1', 'Hero1-7394-Blade');
  const p2 = await login('player2', 'Hero2-5821-Runes');
  const dmApi = api(dm.cookie);
  const p1Api = api(p1.cookie);
  const p2Api = api(p2.cookie);
  check('логин мастера и игроков', dm.ok && p1.ok && p2.ok, { dm: dm.ok, p1: p1.ok, p2: p2.ok });
  if (!dm.ok || !p1.ok) return;

  const stamp = Date.now().toString(36);
  const npcName = `E2E НПС ${stamp}`;
  let npcId = null;
  let combatId = null;

  /* --------------------------------------------------- создание НПС с листом */
  console.log('\n== боевой лист НПС ==');
  const created = await dmApi('/dm/npcs', {
    method: 'POST',
    body: JSON.stringify({
      name: npcName,
      role: 'Наёмник',
      attitude: 'friendly',
      description: 'Проверочный НПС',
      isRevealed: false,
      sheet: SHEET,
    }),
  });
  check('НПС создан', created.status === 200, created.body);
  const npc = (created.body?.npcs ?? []).find((item) => item.name === npcName);
  npcId = npc?.id ?? null;
  check('в ответе есть боевой лист', Boolean(npc?.sheet), npc?.sheet);
  check('AC/HP сохранились', npc?.sheet?.ac === 15 && npc?.sheet?.hp === 22, {
    ac: npc?.sheet?.ac,
    hp: npc?.sheet?.hp,
  });
  check(
    'характеристики сохранились',
    npc?.sheet?.abilities?.str === 14 && npc?.sheet?.abilities?.dex === 16,
    npc?.sheet?.abilities
  );
  check('атаки сохранились', (npc?.sheet?.actions ?? '').includes('Мультиатака'), npc?.sheet?.actions);

  // Игрок не должен получать статы даже открытого НПС
  await dmApi(`/dm/npcs/${npcId}/reveal`, {
    method: 'PATCH',
    body: JSON.stringify({ isRevealed: true }),
  });
  const playerNpcs = (await p1Api('/npcs')).body?.npcs ?? [];
  const playerNpc = playerNpcs.find((item) => item.id === npcId);
  check('НПС открыт игроку', Boolean(playerNpc), playerNpcs.length);
  check('статы НПС игроку не отдаются', playerNpc?.sheet === null, playerNpc?.sheet);
  const dmNpcs = (await dmApi('/npcs')).body?.npcs ?? [];
  check('мастер видит статы', Boolean(dmNpcs.find((item) => item.id === npcId)?.sheet));

  // Правка только листа
  const patchedSheet = await dmApi(`/dm/npcs/${npcId}/sheet`, {
    method: 'PATCH',
    body: JSON.stringify({ sheet: { ...SHEET, ac: 17, hp: 30 } }),
  });
  check('лист обновлён отдельным запросом', patchedSheet.status === 200, patchedSheet.body);
  const afterPatch = (patchedSheet.body?.npcs ?? []).find((item) => item.id === npcId);
  check('AC обновился до 17', afterPatch?.sheet?.ac === 17, afterPatch?.sheet?.ac);
  check('HP обновился до 30', afterPatch?.sheet?.hp === 30, afterPatch?.sheet?.hp);

  // Нормализация мусора
  const junk = await dmApi(`/dm/npcs/${npcId}/sheet`, {
    method: 'PATCH',
    body: JSON.stringify({
      sheet: { ac: 'abc', hp: -100, cr: 'X'.repeat(40), abilities: { str: 999, dex: 'nope' } },
    }),
  });
  const junkSheet = (junk.body?.npcs ?? []).find((item) => item.id === npcId)?.sheet;
  check('мусорный AC → null', junkSheet?.ac === null, junkSheet?.ac);
  check('отрицательный HP обрезан до 0', junkSheet?.hp === 0, junkSheet?.hp);
  check('CR обрезан по длине', (junkSheet?.cr ?? '').length <= 16, junkSheet?.cr?.length);
  check('характеристика обрезана до 40', junkSheet?.abilities?.str === 40, junkSheet?.abilities?.str);
  check('нечисловая характеристика → null', junkSheet?.abilities?.dex === null, junkSheet?.abilities?.dex);

  // PUT без поля sheet (старый клиент) не должен стирать лист
  await dmApi(`/dm/npcs/${npcId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: npcName, role: 'Наёмник', attitude: 'friendly', isRevealed: true }),
  });
  const keptSheet = ((await dmApi('/npcs')).body?.npcs ?? []).find((item) => item.id === npcId)?.sheet;
  check(
    'правка карточки не стирает лист',
    (keptSheet?.cr ?? '') === (junkSheet?.cr ?? '') && keptSheet?.cr !== '',
    { kept: keptSheet?.cr, before: junkSheet?.cr }
  );

  // Возвращаем рабочие статы
  await dmApi(`/dm/npcs/${npcId}/sheet`, {
    method: 'PATCH',
    body: JSON.stringify({ sheet: { ...SHEET, ac: 15, hp: 22 } }),
  });

  /* ------------------------------------------------ конструктор боя: список */
  console.log('\n== конструктор боя ==');
  const builderNpcs = await dmApi('/combats/npcs');
  check('GET /combats/npcs: 200', builderNpcs.status === 200, builderNpcs.status);
  const builderNpc = (builderNpcs.body?.npcs ?? []).find((item) => item.id === npcId);
  check('НПС в списке конструктора', Boolean(builderNpc), builderNpcs.body?.npcs?.length);
  check('конструктор получает статы', builderNpc?.sheet?.ac === 15, builderNpc?.sheet?.ac);
  check('есть готовый стат-блок', (builderNpc?.statblock ?? '').includes('Мультиатака'), builderNpc?.statblock?.slice(0, 80));
  const playerBuilder = await p1Api('/combats/npcs');
  check('игроку список НПС запрещён', playerBuilder.status === 403, playerBuilder.status);

  /* ------------------------------------------------------- НПС в бою */
  console.log('\n== НПС в бою ==');
  const members = await dmApi('/combats/members');
  const member = (members.body?.players ?? []).find((p) => p.playerId === 1) ?? (members.body?.players ?? [])[0];
  check('ростер игроков доступен', Boolean(member), member?.displayName);

  const combat = await dmApi('/combats', {
    method: 'POST',
    body: JSON.stringify({
      name: `E2E НПС бой ${stamp}`,
      participants: [
        {
          participantType: 'npc',
          npcId,
          initiativeValue: 14,
          hideName: false,
          isHiddenFromPlayers: true,
        },
        {
          participantType: 'player',
          userId: member.userId,
          playerId: member.playerId,
          displayName: member.characterName || member.displayName,
          initiativeValue: 10,
          maxHp: 20,
          currentHp: 20,
        },
      ],
    }),
  });
  check('бой с НПС создан', combat.status === 200, combat.body);
  combatId = combat.body?.combat?.id ?? null;
  const npcParticipant = (combat.body?.combat?.participants ?? []).find(
    (item) => item.participantType === 'npc'
  );
  check('участник типа npc', Boolean(npcParticipant), combat.body?.combat?.participants?.map((p) => p.participantType));
  check('участник связан с НПС', npcParticipant?.npcId === npcId, npcParticipant?.npcId);
  check('HP взяты из листа', npcParticipant?.maxHp === 22, npcParticipant?.maxHp);
  check('AC взяты из листа', npcParticipant?.armorClass === 15, npcParticipant?.armorClass);
  check('стат-блок из листа виден мастеру', (npcParticipant?.statblock ?? '').includes('Мультиатака'), npcParticipant?.statblock?.slice(0, 60));
  check('имя НПС в трекере', npcParticipant?.displayName === npcName, npcParticipant?.displayName);

  // Стартуем бой и проверяем маскировку для игроков
  await dmApi(`/combats/${combatId}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
  const playerView = await p1Api(`/combats/${combatId}`);
  const playerNpcParticipant = (playerView.body?.combat?.participants ?? []).find(
    (item) => item.participantType === 'npc'
  );
  check('игрок видит НПС в трекере', Boolean(playerNpcParticipant), playerView.body?.combat?.participants?.length);
  check('статы НПС скрыты от игрока', playerNpcParticipant?.currentHp === null && playerNpcParticipant?.armorClass === null, {
    hp: playerNpcParticipant?.currentHp,
    ac: playerNpcParticipant?.armorClass,
  });
  check('стат-блок скрыт от игрока', playerNpcParticipant?.statblock === null, playerNpcParticipant?.statblock);

  // Урон: НПС ведёт себя как существо — без спасбросков от смерти
  const dmg = await dmApi(`/combats/${combatId}/participants/${npcParticipant.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ hpDelta: -5 }),
  });
  const npcAfterDmg = (dmg.body?.combat?.participants ?? []).find((item) => item.id === npcParticipant.id);
  check('урон применён к НПС', npcAfterDmg?.currentHp === 17, npcAfterDmg?.currentHp);
  check('у НПС нет спасбросков от смерти', npcAfterDmg?.deathSaves === null, npcAfterDmg?.deathSaves);
  const overkill = await dmApi(`/combats/${combatId}/participants/${npcParticipant.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ hpDelta: -999 }),
  });
  const npcDead = (overkill.body?.combat?.participants ?? []).find((item) => item.id === npcParticipant.id);
  check('HP не уходит ниже нуля', npcDead?.currentHp === 0, npcDead?.currentHp);
  check('НПС помечен поверженным', npcDead?.isDefeated === true, npcDead?.isDefeated);

  // Обновление стат-блока участника (после правки листа в бою)
  const statblockPatch = await dmApi(`/combats/${combatId}/participants/${npcParticipant.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ statblock: 'Новый стат-блок НПС', armorClass: 18, maxHp: 40 }),
  });
  const npcRestated = (statblockPatch.body?.combat?.participants ?? []).find(
    (item) => item.id === npcParticipant.id
  );
  check('стат-блок участника обновлён', npcRestated?.statblock === 'Новый стат-блок НПС', npcRestated?.statblock);
  check('AC участника обновлён', npcRestated?.armorClass === 18, npcRestated?.armorClass);
  check('максимум HP обновлён', npcRestated?.maxHp === 40, npcRestated?.maxHp);

  // Повторное открытие статов для игроков
  await dmApi(`/combats/${combatId}/participants/${npcParticipant.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isHiddenFromPlayers: false, hideName: false }),
  });
  const playerVisible = (await p1Api(`/combats/${combatId}`)).body?.combat?.participants ?? [];
  const playerNpcVisible = playerVisible.find((item) => item.id === npcParticipant.id);
  check('открытый НПС показывает AC игроку', playerNpcVisible?.armorClass === 18, playerNpcVisible?.armorClass);
  check('открытый НПС показывает имя', playerNpcVisible?.displayName === npcName, playerNpcVisible?.displayName);

  // Добавление НПС в существующий бой
  const added = await dmApi(`/combats/${combatId}/participants`, {
    method: 'POST',
    body: JSON.stringify({
      participants: [{ participantType: 'npc', npcId, initiativeValue: 3, isHiddenFromPlayers: true }],
    }),
  });
  check('НПС добавлен в идущий бой', added.status === 200, added.body);
  const npcCount = (added.body?.combat?.participants ?? []).filter((item) => item.participantType === 'npc').length;
  check('в бою два НПС', npcCount === 2, npcCount);

  const badNpc = await dmApi(`/combats/${combatId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participants: [{ participantType: 'npc', npcId: 9876543 }] }),
  });
  check('несуществующий НПС → 400', badNpc.status === 400, badNpc.status);

  // Игроку запрещено создавать бой и добавлять участников
  const playerCreate = await p1Api('/combats', {
    method: 'POST',
    body: JSON.stringify({ name: 'Не должен создаться', participants: [] }),
  });
  check('игрок не может создать бой', playerCreate.status === 403, playerCreate.status);
  const playerAdd = await p1Api(`/combats/${combatId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participants: [{ participantType: 'npc', npcId }] }),
  });
  check('игрок не может добавить НПС', playerAdd.status === 403, playerAdd.status);

  // История боёв видит НПС
  await dmApi(`/combats/${combatId}`, { method: 'PATCH', body: JSON.stringify({ status: 'finished' }) });
  const history = await dmApi('/combats/history');
  const historyEntry = (history.body?.combats ?? []).find((item) => item.id === combatId);
  check(
    'НПС есть в истории боёв',
    (historyEntry?.participants ?? []).some((item) => item.type === 'npc'),
    historyEntry?.participants?.map((item) => item.type)
  );

  /* --------------------------------------------------------------- уборка */
  console.log('\n== уборка ==');
  if (combatId) await dmApi(`/combats/${combatId}`, { method: 'DELETE' });
  if (npcId) await dmApi(`/dm/npcs/${npcId}`, { method: 'DELETE' });
  const leftovers = (await dmApi('/npcs')).body?.npcs ?? [];
  check('НПС удалён', !leftovers.some((item) => item.id === npcId), leftovers.length);

  console.log(`\nИтог: ${passed} ok, ${failures.length} fail`);
  if (failures.length > 0) process.exitCode = 1;
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
