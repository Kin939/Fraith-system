import type { Hono } from 'hono';
import type { Env, Variables } from '../functions/api/[[route]]';
import type { AuthUser } from '../src/lib/types';
import { uploadChatAttachmentToR2 } from '../src/lib/r2';

/**
 * HTTP-слой вкладки «Доска».
 *
 * Метаданные/доступы/шаблоны живут в D1, сам холст — в BoardRoom (Durable Object,
 * один инстанс на доску). Существующие эндпоинты не изменяются: всё новое
 * смонтировано под /api/boards.
 */

type BoardPermission = 'read' | 'write';

interface BoardRow {
  id: string;
  name: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  background: string | null;
  grid_size: number | null;
}

interface AccessRow {
  board_id: string;
  user_id: number;
  permission: BoardPermission;
  display_name: string;
  username: string;
  role: 'dm' | 'player';
}

interface CreateBoardBody {
  name?: string;
  background?: string;
  access?: Array<{ userId: number; permission: BoardPermission | null }>;
}

interface TemplateBody {
  name?: string;
  content?: string;
  scope?: 'global' | 'board';
}

const DEFAULT_BOARD_NAME = 'Доска кампании';
const MAX_BOARD_NAME = 80;

function newId(): string {
  return crypto.randomUUID();
}

async function fetchBoardRow(env: Env, boardId: string): Promise<BoardRow | null> {
  return await env.DB.prepare(
    `SELECT b.id, b.name, b.created_by, b.created_at, b.updated_at,
            s.background, s.grid_size
     FROM boards b
     LEFT JOIN board_settings s ON s.board_id = b.id
     WHERE b.id = ?`
  )
    .bind(boardId)
    .first<BoardRow>();
}

async function resolvePermission(
  env: Env,
  boardId: string,
  user: AuthUser
): Promise<BoardPermission | null> {
  if (user.role === 'dm') return 'write';
  const row = await env.DB.prepare(
    `SELECT permission FROM board_access WHERE board_id = ? AND user_id = ?`
  )
    .bind(boardId, user.id)
    .first<{ permission: BoardPermission }>();
  return row?.permission ?? null;
}

/** DM всегда видит все доски; игрок — только те, где ему выдан доступ. */
async function listBoardsForUser(env: Env, user: AuthUser) {
  const rows = await env.DB.prepare(
    `SELECT b.id, b.name, b.created_by, b.created_at, b.updated_at,
            s.background, s.grid_size,
            a.permission AS my_permission
     FROM boards b
     LEFT JOIN board_settings s ON s.board_id = b.id
     LEFT JOIN board_access a ON a.board_id = b.id AND a.user_id = ?
     ORDER BY b.updated_at DESC, b.created_at DESC`
  )
    .bind(user.id)
    .all<BoardRow & { my_permission: BoardPermission | null }>();

  const accessByBoard = new Map<string, Array<{ userId: number; permission: BoardPermission }>>();
  if (user.role === 'dm') {
    const accessRows = await env.DB.prepare(
      `SELECT board_id, user_id, permission FROM board_access`
    ).all<{ board_id: string; user_id: number; permission: BoardPermission }>();
    (accessRows.results ?? []).forEach((row) => {
      const list = accessByBoard.get(row.board_id) ?? [];
      list.push({ userId: row.user_id, permission: row.permission });
      accessByBoard.set(row.board_id, list);
    });
  }

  const boards = (rows.results ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      background: row.background ?? 'dots',
      gridSize: row.grid_size ?? 24,
      permission: (user.role === 'dm' ? 'write' : row.my_permission) as BoardPermission | null,
      access: user.role === 'dm' ? accessByBoard.get(row.id) ?? [] : undefined,
    }))
    .filter((b) => b.permission !== null);

  return boards;
}

async function listMembers(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT id, username, display_name, role FROM users ORDER BY role DESC, id ASC`
  ).all<{ id: number; username: string; display_name: string; role: 'dm' | 'player' }>();
  return (rows.results ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
  }));
}

async function listAccess(env: Env, boardId: string) {
  const rows = await env.DB.prepare(
    `SELECT a.board_id, a.user_id, a.permission, u.display_name, u.username, u.role
     FROM board_access a
     JOIN users u ON u.id = a.user_id
     WHERE a.board_id = ?
     ORDER BY u.role DESC, u.id ASC`
  )
    .bind(boardId)
    .all<AccessRow>();
  return (rows.results ?? []).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    username: r.username,
    role: r.role,
    permission: r.permission,
  }));
}

async function setAccess(env: Env, boardId: string, userId: number, permission: BoardPermission | null) {
  if (permission === null) {
    await env.DB.prepare(`DELETE FROM board_access WHERE board_id = ? AND user_id = ?`)
      .bind(boardId, userId)
      .run();
    return;
  }
  await env.DB.prepare(
    `INSERT INTO board_access (board_id, user_id, permission) VALUES (?, ?, ?)
     ON CONFLICT(board_id, user_id) DO UPDATE SET permission = excluded.permission`
  )
    .bind(boardId, userId, permission)
    .run();
}

async function createBoard(
  env: Env,
  user: AuthUser,
  name: string,
  background = 'dots',
  access?: Array<{ userId: number; permission: BoardPermission }>
) {
  const id = newId();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO boards (id, name, created_by) VALUES (?, ?, ?)`
    ).bind(id, name, user.id),
    env.DB.prepare(
      `INSERT INTO board_settings (board_id, background) VALUES (?, ?)`
    ).bind(id, background),
  ]);

  if (access) {
    for (const entry of access) {
      await setAccess(env, id, entry.userId, entry.permission);
    }
  }
  return id;
}

/** Первая доска создаётся автоматически: игроки получают право записи, DM может сузить. */
async function ensureDefaultBoard(env: Env, user: AuthUser): Promise<void> {
  if (user.role !== 'dm') return;
  const existing = await env.DB.prepare(`SELECT id FROM boards LIMIT 1`).first<{ id: string }>();
  if (existing) return;

  const players = await env.DB.prepare(`SELECT id FROM users WHERE role = 'player'`)
    .all<{ id: number }>();
  await createBoard(
    env,
    user,
    DEFAULT_BOARD_NAME,
    'dots',
    (players.results ?? []).map((p) => ({ userId: p.id, permission: 'write' as BoardPermission }))
  );
}

export function registerBoardRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>) {
  // ------------------------------------------------------------------- список

  app.get('/boards', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

    await ensureDefaultBoard(c.env, user);
    const [boards, members] = await Promise.all([listBoardsForUser(c.env, user), listMembers(c.env)]);
    return c.json({ boards, members, canManage: user.role === 'dm' });
  });

  // ------------------------------------------------------------------ создание

  app.post('/boards', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Создавать доски может только Мастер' }, 403);

    const body = await c.req
      .json<CreateBoardBody>()
      .catch((): CreateBoardBody => ({}));

    const name = (body.name || '').trim().slice(0, MAX_BOARD_NAME) || 'Новая доска';
    const allowedBackgrounds = ['dots', 'lines', 'squares', 'plain'];
    const background = allowedBackgrounds.includes(body.background || '') ? body.background! : 'dots';

    const members = await listMembers(c.env);
    const playerIds = members.filter((m) => m.role === 'player').map((m) => m.id);

    const requested = (body.access ?? [])
      .filter((a) => playerIds.includes(a.userId) && (a.permission === 'read' || a.permission === 'write'))
      .map((a) => ({ userId: a.userId, permission: a.permission as BoardPermission }));

    const access =
      requested.length > 0
        ? requested
        : playerIds.map((id) => ({ userId: id, permission: 'write' as BoardPermission }));

    const id = await createBoard(c.env, user, name, background, access);

    return c.json({
      board: {
        id,
        name,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        background,
        gridSize: 24,
        permission: 'write' as BoardPermission,
      },
      access: await listAccess(c.env, id),
    });
  });

  // ------------------------------------------------- переименование/права/фон

  app.patch('/boards/:id', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Менять доску может только Мастер' }, 403);

    const boardId = c.req.param('id');
    const board = await fetchBoardRow(c.env, boardId);
    if (!board) return c.json({ error: 'Доска не найдена' }, 404);

    const body = await c.req
      .json<CreateBoardBody>()
      .catch((): CreateBoardBody => ({}));

    if (typeof body.name === 'string' && body.name.trim()) {
      await c.env.DB.prepare(
        `UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(body.name.trim().slice(0, MAX_BOARD_NAME), boardId)
        .run();
    }

    if (typeof body.background === 'string') {
      const allowed = ['dots', 'lines', 'squares', 'plain'];
      if (allowed.includes(body.background)) {
        await c.env.DB.prepare(
          `INSERT INTO board_settings (board_id, background) VALUES (?, ?)
           ON CONFLICT(board_id) DO UPDATE SET background = excluded.background`
        )
          .bind(boardId, body.background)
          .run();
      }
    }

    if (Array.isArray(body.access)) {
      const members = await listMembers(c.env);
      const validIds = new Set(members.filter((m) => m.role === 'player').map((m) => m.id));
      for (const entry of body.access) {
        if (!validIds.has(entry.userId)) continue;
        const permission =
          entry.permission === 'read' || entry.permission === 'write' ? entry.permission : null;
        await setAccess(c.env, boardId, entry.userId, permission);
      }
    }

    const updated = await fetchBoardRow(c.env, boardId);
    return c.json({
      board: updated
        ? {
            id: updated.id,
            name: updated.name,
            createdBy: updated.created_by,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
            background: updated.background ?? 'dots',
            gridSize: updated.grid_size ?? 24,
            permission: 'write' as BoardPermission,
          }
        : null,
      access: await listAccess(c.env, boardId),
    });
  });

  // ------------------------------------------------------------------ удаление

  app.delete('/boards/:id', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Удалять доски может только Мастер' }, 403);

    const boardId = c.req.param('id');
    const board = await fetchBoardRow(c.env, boardId);
    if (!board) return c.json({ error: 'Доска не найдена' }, 404);

    // Сбрасываем содержимое DO (сторадж Durable Object не удаляется вместе с D1-строкой).
    try {
      if (c.env.BOARD_ROOM) {
        const stub = c.env.BOARD_ROOM.get(c.env.BOARD_ROOM.idFromName(boardId));
        await stub.fetch(`https://board-do.internal/reset?boardId=${encodeURIComponent(boardId)}`, {
          method: 'POST',
        });
      }
    } catch {
      /* DO мог быть уже выгружен — не блокируем удаление */
    }

    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM board_access WHERE board_id = ?`).bind(boardId),
      c.env.DB.prepare(`DELETE FROM board_templates WHERE board_id = ?`).bind(boardId),
      c.env.DB.prepare(`DELETE FROM board_settings WHERE board_id = ?`).bind(boardId),
      c.env.DB.prepare(`DELETE FROM boards WHERE id = ?`).bind(boardId),
    ]);

    return c.json({ ok: true });
  });

  // -------------------------------------------------------------- WebSocket

  app.get('/boards/:id/ws', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Требуется авторизация для WebSocket-подключения' }, 401);

    const boardId = c.req.param('id');
    const board = await fetchBoardRow(c.env, boardId);
    if (!board) return c.json({ error: 'Доска не найдена' }, 404);

    const permission = await resolvePermission(c.env, boardId, user);
    if (!permission) return c.json({ error: 'Нет доступа к этой доске' }, 403);

    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
      return c.json({ error: 'Expected WebSocket Upgrade' }, 426);
    }
    if (!c.env.BOARD_ROOM) {
      return c.json({ error: 'Durable Object BOARD_ROOM не настроен' }, 503);
    }

    const stub = c.env.BOARD_ROOM.get(c.env.BOARD_ROOM.idFromName(boardId));
    const doUrl = new URL('https://board-do.internal/ws');
    doUrl.searchParams.set('boardId', boardId);
    doUrl.searchParams.set('userId', String(user.id));
    doUrl.searchParams.set('username', user.username);
    doUrl.searchParams.set('displayName', user.displayName);
    doUrl.searchParams.set('role', user.role);
    doUrl.searchParams.set('permission', permission);
    doUrl.searchParams.set('color', user.theme?.accent || '#22d3ee');

    return stub.fetch(new Request(doUrl.toString(), c.req.raw));
  });

  // ------------------------------------------------- загрузка файлов на холст

  app.post('/boards/:id/upload', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

    const boardId = c.req.param('id');
    const board = await fetchBoardRow(c.env, boardId);
    if (!board) return c.json({ error: 'Доска не найдена' }, 404);

    const permission = await resolvePermission(c.env, boardId, user);
    if (permission !== 'write') {
      return c.json({ error: 'Доска доступна только для чтения' }, 403);
    }

    let file: File | null = null;
    try {
      const form = await c.req.formData();
      const entry = form.get('file');
      if (entry instanceof File) file = entry;
    } catch {
      return c.json({ error: 'Ожидается multipart/form-data с полем file' }, 400);
    }

    if (!file) return c.json({ error: 'Файл не передан' }, 400);

    try {
      const uploaded = await uploadChatAttachmentToR2(c.env.BUCKET, c.env.DB, file);
      return c.json({
        key: uploaded.key,
        url: uploaded.url,
        name: uploaded.name,
        size: uploaded.size,
        mimeType: uploaded.mimeType,
        kind: uploaded.kind,
      });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Не удалось загрузить файл' },
        400
      );
    }
  });

  // -------------------------------------------------------------- шаблоны

  app.get('/boards/:id/templates', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);

    const boardId = c.req.param('id');
    const permission = await resolvePermission(c.env, boardId, user);
    if (!permission) return c.json({ error: 'Нет доступа к этой доске' }, 403);

    const rows = await c.env.DB.prepare(
      `SELECT t.id, t.board_id, t.name, t.content_json, t.created_by, t.created_at, u.display_name
       FROM board_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.board_id IS NULL OR t.board_id = ?
       ORDER BY t.created_at DESC`
    )
      .bind(boardId)
      .all<{
        id: string;
        board_id: string | null;
        name: string;
        content_json: string;
        created_by: number;
        created_at: string;
        display_name: string | null;
      }>();

    return c.json({
      templates: (rows.results ?? []).map((r) => ({
        id: r.id,
        boardId: r.board_id,
        name: r.name,
        content: r.content_json,
        createdBy: r.created_by,
        createdByName: r.display_name ?? 'Мастер',
        createdAt: r.created_at,
        canDelete: user.role === 'dm',
      })),
    });
  });

  app.post('/boards/:id/templates', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Сохранять шаблоны может только Мастер' }, 403);

    const boardId = c.req.param('id');
    const board = await fetchBoardRow(c.env, boardId);
    if (!board) return c.json({ error: 'Доска не найдена' }, 404);

    const body = await c.req
      .json<TemplateBody>()
      .catch((): TemplateBody => ({}));

    const name = (body.name || '').trim().slice(0, MAX_BOARD_NAME);
    const content = body.content ?? '';
    if (!name || !content) {
      return c.json({ error: 'Нужны название и содержимое выделения' }, 400);
    }
    if (content.length > 900_000) {
      return c.json({ error: 'Выделение слишком большое для шаблона' }, 413);
    }

    const id = newId();
    await c.env.DB.prepare(
      `INSERT INTO board_templates (id, board_id, name, content_json, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, body.scope === 'global' ? null : boardId, name, content, user.id)
      .run();

    return c.json({
      template: {
        id,
        boardId: body.scope === 'global' ? null : boardId,
        name,
        content,
        createdBy: user.id,
        createdByName: user.displayName,
        createdAt: new Date().toISOString(),
        canDelete: true,
      },
    });
  });

  app.delete('/boards/:id/templates/:templateId', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Необходима авторизация' }, 401);
    if (user.role !== 'dm') return c.json({ error: 'Удалять шаблоны может только Мастер' }, 403);

    await c.env.DB.prepare(`DELETE FROM board_templates WHERE id = ?`)
      .bind(c.req.param('templateId'))
      .run();
    return c.json({ ok: true });
  });
}
