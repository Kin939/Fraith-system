import { DurableObject } from 'cloudflare:workers';

interface ClientAttachment {
  userId: number;
  username: string;
  displayName: string;
  role: 'dm' | 'player';
  playerId: number | null;
  connectedAt: number;
}

export interface DoEnv {
  CAMPAIGN_DO: DurableObjectNamespace;
}

/**
 * Single Durable Object per campaign using Cloudflare WebSocket Hibernation API.
 * Coordinates real-time state updates, presence, and live Long Story Short (LSS) dice rolls
 * between the 3 players and the DM without keeping idle compute billed between messages.
 */
export class CampaignRoom extends DurableObject<DoEnv> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade (Hibernation API)
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = Number.parseInt(url.searchParams.get('userId') || '0', 10);
      const username = url.searchParams.get('username') || 'guest';
      const displayName = url.searchParams.get('displayName') || username;
      const role = (url.searchParams.get('role') === 'dm' ? 'dm' : 'player') as 'dm' | 'player';
      const rawPid = url.searchParams.get('playerId');
      const playerId = rawPid && rawPid !== 'null' ? Number.parseInt(rawPid, 10) : null;

      const attachment: ClientAttachment = {
        userId,
        username,
        displayName,
        role,
        playerId,
        connectedAt: Date.now(),
      };

      this.ctx.acceptWebSocket(server, [role, `user:${userId}`]);
      server.serializeAttachment(attachment);

      // Send immediate welcome + presence snapshot
      server.send(
        JSON.stringify({
          type: 'connected',
          payload: { online: this.getOnlineUsers() },
          timestamp: Date.now(),
        })
      );

      this.broadcastJson({
        type: 'presence:update',
        payload: { online: this.getOnlineUsers() },
        timestamp: Date.now(),
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // 2. Internal broadcast endpoint invoked by Hono API handlers on D1 mutations
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const body = (await request.json()) as {
        type: string;
        payload: unknown;
        senderId?: number;
        targetUserId?: number;
      };

      this.broadcastJson(
        {
          type: body.type,
          payload: body.payload,
          senderId: body.senderId,
          timestamp: Date.now(),
        },
        body.targetUserId
      );

      return Response.json({ ok: true, recipients: this.ctx.getWebSockets().length });
    }

    if (request.method === 'GET' && url.pathname === '/presence') {
      return Response.json({ online: this.getOnlineUsers() });
    }

    return new Response('CampaignRoom Durable Object Active', { status: 200 });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    let parsed: { type?: string; payload?: unknown };
    try {
      parsed = JSON.parse(message) as { type?: string; payload?: unknown };
    } catch {
      return;
    }

    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    const sender = ws.deserializeAttachment() as ClientAttachment | null;

    // Relay live LSS postMessage events (rolls & HP updates) to the entire campaign table
    if (parsed.type === 'lss:roll' || parsed.type === 'lss:health') {
      this.broadcastJson({
        type: parsed.type,
        payload: parsed.payload,
        senderId: sender?.userId,
        timestamp: Date.now(),
      });
    }
  }

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean
  ): Promise<void> {
    try {
      ws.close(code, reason || 'Closed');
    } catch {
      // Socket already closed
    }
    this.broadcastJson({
      type: 'presence:update',
      payload: { online: this.getOnlineUsers(ws) },
      timestamp: Date.now(),
    });
  }

  override async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, 'WebSocket Error');
    } catch {
      // Ignore
    }
    this.broadcastJson({
      type: 'presence:update',
      payload: { online: this.getOnlineUsers(ws) },
      timestamp: Date.now(),
    });
  }

  private getOnlineUsers(excludeSocket?: WebSocket): ClientAttachment[] {
    const sockets = this.ctx.getWebSockets();
    const byUser = new Map<number, ClientAttachment>();
    for (const sock of sockets) {
      if (sock === excludeSocket) continue;
      const meta = sock.deserializeAttachment() as ClientAttachment | null;
      if (meta && meta.userId) {
        byUser.set(meta.userId, meta);
      }
    }
    return Array.from(byUser.values());
  }

  private broadcastJson(data: unknown, targetUserId?: number): void {
    const serialized = JSON.stringify(data);
    const sockets = targetUserId
      ? this.ctx.getWebSockets(`user:${targetUserId}`)
      : this.ctx.getWebSockets();

    for (const sock of sockets) {
      try {
        sock.send(serialized);
      } catch {
        // Stale socket will be cleaned up by Hibernation runtime
      }
    }
  }
}

export default {
  async fetch(request: Request, env: DoEnv): Promise<Response> {
    const id = env.CAMPAIGN_DO.idFromName('fraith-main-campaign');
    const stub = env.CAMPAIGN_DO.get(id);
    return stub.fetch(request);
  },
};
