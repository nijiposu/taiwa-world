import type { RoomMessage } from './protocol';

export type { RoomMessage, SignalData } from './protocol';

export type TransportStatus = 'connecting' | 'open' | 'closed';

/**
 * 通信路の抽象。
 * - SocketTransport：Cloudflare の部屋サーバー（Durable Object）につなぐ。公開版はこちら
 * - BroadcastTransport：同じブラウザのタブ同士だけ（手元での開発用）
 */
export interface RoomTransport {
  send(message: RoomMessage): void;
  subscribe(listener: (message: RoomMessage) => void): () => void;
  /** つながった・切れたを知らせる（つながるたびに hello を送り直すため） */
  onStatus?(listener: (status: TransportStatus) => void): () => void;
  close(): void;
}

export class BroadcastTransport implements RoomTransport {
  private channel: BroadcastChannel | null;
  private listeners = new Set<(message: RoomMessage) => void>();

  constructor(roomId: string) {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`taiwa-room:${roomId}`);
    if (this.channel) {
      this.channel.onmessage = (e: MessageEvent<RoomMessage>) => this.listeners.forEach((l) => l(e.data));
    }
  }

  send(message: RoomMessage) {
    this.channel?.postMessage(message);
  }

  subscribe(listener: (message: RoomMessage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
  }
}

const RETRY_MS = [500, 1000, 2000, 4000, 8000];

/**
 * Cloudflare の部屋サーバーにつなぐ。切れたら少しずつ間をあけてつなぎ直す。
 * つながる前に送ったものは、つながってから順に送る。
 */
export class SocketTransport implements RoomTransport {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private listeners = new Set<(message: RoomMessage) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();
  private tries = 0;
  private closed = false;
  private timer = 0;

  constructor(private roomId: string) {
    this.connect();
  }

  private get url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/api/room/${encodeURIComponent(this.roomId)}`;
  }

  private setStatus(status: TransportStatus) {
    this.statusListeners.forEach((l) => l(status));
  }

  private connect() {
    if (this.closed) return;
    this.setStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      // 切れている間の操作を先に届けてから「こんにちは」を送る（返ってくる部屋の状態に、その操作が入るように）
      const pending = this.queue;
      this.queue = [];
      pending.forEach((m) => ws.send(m));
      this.setStatus('open');
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data)) as RoomMessage;
        this.listeners.forEach((l) => l(m));
      } catch {
        /* 壊れたメッセージは捨てる */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.setStatus('closed');
      if (this.closed) return;
      const wait = RETRY_MS[Math.min(this.tries, RETRY_MS.length - 1)];
      this.tries += 1;
      this.timer = window.setTimeout(() => this.connect(), wait);
    };
  }

  send(message: RoomMessage) {
    const data = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    // 部屋の状態に関わるものだけ、つながるまで取っておく（在室の合図や通話の合図は古くなるので捨てる）
    else if (message.kind === 'action' || message.kind === 'seed') this.queue.push(data);
  }

  subscribe(listener: (message: RoomMessage) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: (status: TransportStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  close() {
    this.closed = true;
    window.clearTimeout(this.timer);
    this.ws?.close();
    this.listeners.clear();
    this.statusListeners.clear();
  }
}

/** 公開版は部屋サーバーへ。手元の開発（vite dev）は同じブラウザのタブ同士で */
export function createTransport(roomId: string): RoomTransport {
  const useServer = import.meta.env.PROD || new URLSearchParams(location.search).get('sync') === 'server';
  return useServer ? new SocketTransport(roomId) : new BroadcastTransport(roomId);
}
