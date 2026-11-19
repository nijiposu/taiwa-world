import { initialState, reduce, upgrade } from './reducer';
import type { SignalData } from './protocol';
import { createTransport, type RoomMessage, type RoomTransport, type TransportStatus } from './transport';
import type { Action, SeatId, SessionState } from './types';
import { safeStorage, uid } from './util';

const PRESENCE_INTERVAL = 4000;
const PRESENCE_TIMEOUT = 11000;

type Listener = () => void;
type ActionListener = (action: Action, remote: boolean) => void;
type SignalListener = (from: string, data: SignalData) => void;

/** 'local' は同じブラウザのタブ同士だけ（開発用） */
export type ConnectionStatus = TransportStatus | 'local';

/**
 * ルームの状態を持つストア。
 * - dispatch した Action は手元で適用し、同時に transport へ流す
 * - 他の端末から届いた Action も同じ reducer で適用する
 * - 演出（花火・火の粉など）は onAction で Action を購読して起こす
 */
export class RoomStore {
  readonly clientId = uid();
  private state: SessionState;
  private rev = 0;
  private listeners = new Set<Listener>();
  private actionListeners = new Set<ActionListener>();
  private presence = new Map<string, { seat: SeatId | null; at: number }>();
  private presenceSnapshot: SeatId[] = [];
  private mySeat: SeatId | null = null;
  private status: ConnectionStatus = 'local';
  private signalListeners = new Set<SignalListener>();
  private timer: number | undefined;
  private unsubscribe: () => void;

  constructor(
    readonly roomId: string,
    private transport: RoomTransport = createTransport(roomId),
  ) {
    this.state = this.load() ?? initialState(roomId);
    this.unsubscribe = transport.subscribe((m) => this.receive(m));
    if (transport.onStatus) {
      // 部屋サーバーにつながるたびに「こんにちは」を送り、部屋の状態を受け取りなおす
      this.status = 'connecting';
      transport.onStatus((s) => {
        this.status = s;
        if (s === 'open') {
          transport.send({ kind: 'hello', from: this.clientId });
          this.beat();
        } else {
          // 切れている間は、ほかの人の在室がわからない
          this.presence.clear();
          this.refreshPresence();
        }
        this.emit();
      });
    } else {
      transport.send({ kind: 'hello', from: this.clientId });
    }
    this.timer = window.setInterval(() => this.beat(), PRESENCE_INTERVAL);
    window.addEventListener('pagehide', () => this.destroy(), { once: true });
  }

  private get storageKey() {
    return `taiwa:room:${this.roomId}`;
  }

  private load(): SessionState | null {
    const raw = safeStorage.get('local', this.storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { rev: number; state: SessionState };
      if (parsed.state?.version !== 1) return null;
      this.rev = parsed.rev ?? 0;
      return upgrade(parsed.state);
    } catch {
      return null;
    }
  }

  private save() {
    safeStorage.set('local', this.storageKey, JSON.stringify({ rev: this.rev, state: this.state }));
  }

  getState = () => this.state;
  getOnline = () => this.presenceSnapshot;
  getStatus = () => this.status;

  /** 声の通話の合図を送る（to が無ければ部屋の全員へ） */
  signal(data: SignalData, to?: string) {
    this.transport.send({ kind: 'signal', from: this.clientId, to, data });
  }

  onSignal(listener: SignalListener) {
    this.signalListeners.add(listener);
    return () => {
      this.signalListeners.delete(listener);
    };
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  onAction(listener: ActionListener) {
    this.actionListeners.add(listener);
    return () => {
      this.actionListeners.delete(listener);
    };
  }

  dispatch = (action: Action) => {
    this.apply(action, false);
    this.transport.send({ kind: 'action', from: this.clientId, action });
  };

  setSeat(seat: SeatId | null) {
    this.mySeat = seat;
    this.beat();
  }

  private apply(action: Action, remote: boolean) {
    const next = reduce(this.state, action);
    if (next !== this.state) {
      this.state = next;
      this.rev += 1;
      this.save();
      this.emit();
    }
    this.actionListeners.forEach((l) => l(action, remote));
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private receive(m: RoomMessage) {
    if (m.from === this.clientId) return;
    switch (m.kind) {
      case 'action':
        this.apply(m.action, true);
        break;
      case 'hello':
        // タブ同士のときだけ、先にいた人が状態を渡す（サーバーがあるときはサーバーが渡す）
        if (this.status === 'local') this.transport.send({ kind: 'snapshot', from: this.clientId, to: m.from, rev: this.rev, state: this.state });
        this.beat();
        break;
      case 'snapshot':
        if (m.to !== this.clientId) break;
        if (m.authoritative) {
          if (m.state === null) {
            // 部屋サーバーがまだ空なら、手元の状態を最初の状態として渡す
            this.transport.send({ kind: 'seed', from: this.clientId, state: this.state });
          } else {
            this.state = upgrade(m.state);
            this.rev = m.rev;
            this.save();
            this.emit();
          }
        } else if (m.state && m.rev > this.rev) {
          this.state = upgrade(m.state);
          this.rev = m.rev;
          this.save();
          this.emit();
        }
        break;
      case 'signal':
        this.signalListeners.forEach((l) => l(m.from, m.data));
        break;
      case 'presence':
        this.presence.set(m.from, { seat: m.seat, at: Date.now() });
        this.refreshPresence();
        break;
      case 'bye':
        this.presence.delete(m.from);
        this.refreshPresence();
        break;
    }
  }

  private beat() {
    this.transport.send({ kind: 'presence', from: this.clientId, seat: this.mySeat, at: Date.now() });
    this.refreshPresence();
  }

  private refreshPresence() {
    const now = Date.now();
    const seats = new Set<SeatId>();
    if (this.mySeat) seats.add(this.mySeat);
    for (const [id, p] of this.presence) {
      if (now - p.at > PRESENCE_TIMEOUT) this.presence.delete(id);
      else if (p.seat) seats.add(p.seat);
    }
    const next = [...seats].sort();
    if (next.join() !== this.presenceSnapshot.join()) {
      this.presenceSnapshot = next;
      this.emit();
    }
  }

  destroy() {
    this.transport.send({ kind: 'bye', from: this.clientId, seat: this.mySeat });
    window.clearInterval(this.timer);
    this.unsubscribe();
    this.transport.close();
  }
}
