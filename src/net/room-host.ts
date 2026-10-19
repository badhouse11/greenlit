/**
 * Glue between the room logic and whatever is hosting it (a Cloudflare Durable
 * Object in production, a small Node server in tests). The host supplies sockets,
 * storage and an alarm; this file does the rest.
 */
import type { ClientMsg, ServerMsg } from './protocol';
import { RoomCore, newRoom } from './room-core';
import type { Meta, RoomState } from './room-core';

export interface Sock {
  send(data: string): void;
}

export interface HostAdapter<S extends Sock> {
  sockets(): S[];
  getMeta(s: S): Meta | null;
  setMeta(s: S, m: Meta): void;
  load(): Promise<RoomState | null>;
  save(state: RoomState): Promise<void>;
  setAlarm(at: number | null): Promise<void>;
  now(): number;
}

const GUEST: Meta = { token: null, role: 'guest', studioId: null };

export class RoomHost<S extends Sock> {
  private core: RoomCore | null = null;

  constructor(private io: HostAdapter<S>, private code: string) {}

  private async room(): Promise<RoomCore> {
    if (!this.core) this.core = new RoomCore((await this.io.load()) ?? newRoom(this.code, this.io.now()));
    return this.core;
  }

  private online(except?: S): Set<string> {
    const ids = new Set<string>();
    for (const s of this.io.sockets()) {
      if (s === except) continue;
      const m = this.io.getMeta(s);
      if (!m) continue;
      if (m.role === 'screen') ids.add('screen');
      if (m.studioId) ids.add(m.studioId);
    }
    return ids;
  }

  private send(s: S, msg: ServerMsg) {
    try {
      s.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }

  private async broadcast(core: RoomCore, except?: S) {
    const now = this.io.now();
    const online = this.online(except);
    for (const s of this.io.sockets()) {
      if (s === except) continue;
      this.send(s, { t: 'state', view: core.viewFor(this.io.getMeta(s) ?? GUEST, online, now) });
    }
  }

  /** Seats can change under a socket (game start, takeover): keep every socket's identity current. */
  private syncMetas(core: RoomCore) {
    for (const s of this.io.sockets()) {
      const m = this.io.getMeta(s);
      if (!m?.token) continue;
      const seat = core.state.seats[m.token];
      const next: Meta = seat ? { token: m.token, role: seat.role, studioId: seat.studioId } : { ...GUEST };
      if (next.role !== m.role || next.studioId !== m.studioId || next.token !== m.token) this.io.setMeta(s, next);
    }
  }

  private async persist(core: RoomCore) {
    await this.io.save(core.state);
    await this.io.setAlarm(core.nextAlarm());
  }

  onOpen(s: S) {
    this.io.setMeta(s, GUEST);
  }

  async onMessage(s: S, raw: string) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'ping') {
      this.send(s, { t: 'pong', serverNow: this.io.now() });
      return;
    }
    const core = await this.room();
    const now = this.io.now();
    const meta = this.io.getMeta(s) ?? GUEST;
    const before = new Set(this.online());
    const out = core.handle(meta, msg, now, before);
    if (out.meta) {
      this.io.setMeta(s, out.meta);
      if (out.meta.studioId) core.markSeen(out.meta.studioId, now);
    }
    if (out.reply) this.send(s, out.reply);
    if (msg.t === 'hello' && out.reply?.t === 'error') return;
    // Expired timers are settled before anyone sees the new state.
    core.tick(now);
    if (out.changed || out.meta) {
      this.syncMetas(core);
      await this.persist(core);
      await this.broadcast(core);
    } else {
      this.send(s, { t: 'state', view: core.viewFor(this.io.getMeta(s) ?? GUEST, this.online(), now) });
    }
  }

  async onClose(s: S) {
    const core = await this.room();
    const m = this.io.getMeta(s);
    if (m?.studioId) core.markSeen(m.studioId, this.io.now());
    if (m?.role === 'screen') core.markSeen('screen', this.io.now());
    await this.io.save(core.state);
    await this.broadcast(core, s);
  }

  async onAlarm() {
    const core = await this.room();
    if (core.tick(this.io.now())) {
      await this.persist(core);
      await this.broadcast(core);
    } else {
      await this.io.setAlarm(core.nextAlarm());
    }
  }
}
