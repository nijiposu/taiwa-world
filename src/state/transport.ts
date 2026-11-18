import type { Action, SeatId, SessionState } from './types';

/** 同じルームにいる端末どうしでやり取りするメッセージ */
export type RoomMessage =
  | { kind: 'action'; from: string; action: Action }
  | { kind: 'hello'; from: string }
  | { kind: 'snapshot'; from: string; to: string; rev: number; state: SessionState }
  | { kind: 'presence'; from: string; seat: SeatId | null; at: number }
  | { kind: 'bye'; from: string; seat: SeatId | null };

/**
 * 通信路の抽象。Phase 1 はブラウザ内（タブ間）で完結する BroadcastChannel 実装。
 * Phase 2 では Supabase Realtime / PartyKit / Liveblocks などで同じ interface を実装して差し替える。
 */
export interface RoomTransport {
  send(message: RoomMessage): void;
  subscribe(listener: (message: RoomMessage) => void): () => void;
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
