/**
 * GREENLIT room server, on Cloudflare Workers.
 * Each room code is its own Durable Object: one tiny server per game night.
 */
import { RoomHost } from '../src/net/room-host';
import type { HostAdapter } from '../src/net/room-host';
import type { Meta, RoomState } from '../src/net/room-core';
import { isRoomCode } from '../src/net/protocol';

interface Env {
  ROOMS: DurableObjectNamespace;
}

const HISTORY_KEYS = Array.from({ length: 10 }, (_, i) => `h${i}`);

export class Room {
  private host: RoomHost<WebSocket> | null = null;

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    void this.env;
    // Answer keep-alive pings without waking the room up.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  private getHost(code: string): RoomHost<WebSocket> {
    if (this.host) return this.host;
    const ctx = this.ctx;
    const io: HostAdapter<WebSocket> = {
      sockets: () => ctx.getWebSockets(),
      getMeta: (s) => (s.deserializeAttachment() as { meta?: Meta } | null)?.meta ?? null,
      setMeta: (s, meta) => s.serializeAttachment({ meta, code }),
      load: async () => {
        const got = await ctx.storage.get(['room', ...HISTORY_KEYS]);
        const room = got.get('room') as RoomState | undefined;
        if (!room) return null;
        room.history = HISTORY_KEYS.map((k) => got.get(k)).filter(Boolean) as RoomState['history'];
        return room;
      },
      save: async (state) => {
        const { history, ...rest } = state;
        const entries: Record<string, unknown> = { room: { ...rest, history: [] } };
        HISTORY_KEYS.forEach((k, i) => (entries[k] = history[i] ?? null));
        await ctx.storage.put(entries);
      },
      setAlarm: async (at) => {
        if (at === null) await ctx.storage.deleteAlarm();
        else await ctx.storage.setAlarm(Math.max(at, Date.now() + 50));
      },
      now: () => Date.now(),
    };
    this.host = new RoomHost(io, code);
    return this.host;
  }

  private codeFor(ws: WebSocket): string {
    return (ws.deserializeAttachment() as { code?: string } | null)?.code ?? 'XXXX';
  }

  async fetch(request: Request): Promise<Response> {
    const code = new URL(request.url).pathname.split('/').pop() ?? 'XXXX';
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ meta: { token: null, role: 'guest', studioId: null }, code });
    this.getHost(code);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return;
    await this.getHost(this.codeFor(ws)).onMessage(ws, message);
  }

  async webSocketClose(ws: WebSocket, code: number) {
    await this.getHost(this.codeFor(ws)).onClose(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'Bye');
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.getHost(this.codeFor(ws)).onClose(ws);
  }

  async alarm() {
    const sockets = this.ctx.getWebSockets();
    const code = sockets.length ? this.codeFor(sockets[0]) : 'XXXX';
    await this.getHost(code).onAlarm();
  }
}

const CORS = { 'access-control-allow-origin': '*' };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([A-Z]{4})$/);
    if (match && isRoomCode(match[1])) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426, headers: CORS });
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    }
    return new Response('GREENLIT rooms are open.', { headers: { ...CORS, 'content-type': 'text/plain' } });
  },
};
