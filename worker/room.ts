import { DurableObject } from 'cloudflare:workers';
import { initialState, reduce, upgrade } from '../src/state/reducer';
import type { RoomMessage } from '../src/state/protocol';
import type { SeatId, SessionState } from '../src/state/types';
import type { Env } from './index';

interface Attachment {
  clientId: string | null;
  seat: SeatId | null;
}

/** 部屋に入れる人数の上限（ホスト2・ゲスト2＋見学や再接続の余裕） */
const MAX_SOCKETS = 12;

/**
 * 1つの部屋の小さなサーバー。部屋ごとに1つだけ動く。
 * - 部屋の状態（いる世界・リアクション・記録など）をここが正として持ち、保存する
 * - 誰かの操作（Action）を同じ reducer で適用して、ほかの全員へ配る
 * - 在室の合図と、声の通話の合図（WebRTC）を中継する
 * WebSocket は休止（hibernation）できる受け方にして、誰も話していない間は眠る。
 */
export class Room extends DurableObject<Env> {
  private state: SessionState | null | undefined;
  private rev = 0;
  private roomId = 'room';

  private async load() {
    if (this.state !== undefined) return;
    this.roomId = (await this.ctx.storage.get<string>('name')) ?? this.roomId;
    const saved = await this.ctx.storage.get<{ rev: number; state: SessionState }>('room');
    this.state = saved ? upgrade(saved.state) : null;
    this.rev = saved?.rev ?? 0;
  }

  private async save() {
    if (this.state) await this.ctx.storage.put('room', { rev: this.rev, state: this.state });
  }

  async fetch(request: Request): Promise<Response> {
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response('Room is full', { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ clientId: null, seat: null } satisfies Attachment);
    const name = new URL(request.url).pathname.split('/').pop();
    if (name && !(await this.ctx.storage.get('name'))) await this.ctx.storage.put('name', decodeURIComponent(name));
    return new Response(null, { status: 101, webSocket: client });
  }

  private others(ws: WebSocket) {
    return this.ctx.getWebSockets().filter((s) => s !== ws);
  }

  private broadcast(from: WebSocket, data: string) {
    for (const s of this.others(from)) {
      try {
        s.send(data);
      } catch {
        /* 切れかけの相手は飛ばす */
      }
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 256_000) return;
    let m: RoomMessage;
    try {
      m = JSON.parse(raw) as RoomMessage;
    } catch {
      return;
    }
    const att = (ws.deserializeAttachment() as Attachment) ?? { clientId: null, seat: null };
    if (!att.clientId && typeof m.from === 'string') {
      att.clientId = m.from.slice(0, 64);
      ws.serializeAttachment(att);
    }

    switch (m.kind) {
      case 'hello': {
        await this.load();
        ws.send(JSON.stringify({ kind: 'snapshot', from: 'server', to: m.from, rev: this.rev, state: this.state ?? null, authoritative: true } satisfies RoomMessage));
        // いま部屋にいる人を、新しく来た人に知らせる
        for (const s of this.others(ws)) {
          const a = s.deserializeAttachment() as Attachment | null;
          if (a?.clientId) ws.send(JSON.stringify({ kind: 'presence', from: a.clientId, seat: a.seat, at: Date.now() } satisfies RoomMessage));
        }
        break;
      }
      case 'seed': {
        await this.load();
        if (this.state === null && m.state?.version === 1) {
          this.state = upgrade(m.state);
          this.rev = 1;
          await this.save();
        }
        break;
      }
      case 'action': {
        await this.load();
        if (m.action.type !== 'fx') {
          const base = this.state ?? initialState(this.roomId);
          const next = reduce(base, m.action);
          if (next !== this.state) {
            this.state = next;
            this.rev += 1;
            await this.save();
          }
        }
        this.broadcast(ws, raw);
        break;
      }
      case 'presence':
        att.seat = m.seat;
        ws.serializeAttachment(att);
        this.broadcast(ws, raw);
        break;
      case 'bye':
        this.broadcast(ws, raw);
        break;
      case 'signal': {
        if (!m.to) {
          this.broadcast(ws, raw);
          break;
        }
        for (const s of this.others(ws)) {
          const a = s.deserializeAttachment() as Attachment | null;
          if (a?.clientId === m.to) s.send(raw);
        }
        break;
      }
      default:
        break;
    }
  }

  async webSocketClose(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.clientId) {
      const bye = JSON.stringify({ kind: 'bye', from: att.clientId, seat: att.seat } satisfies RoomMessage);
      this.broadcast(ws, bye);
      this.broadcast(ws, JSON.stringify({ kind: 'signal', from: att.clientId, data: { type: 'voice-leave' } } satisfies RoomMessage));
    }
    try {
      ws.close();
    } catch {
      /* すでに閉じている */
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
