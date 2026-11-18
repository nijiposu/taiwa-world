import { initialState, reduce, upgrade } from './reducer';
import { BroadcastTransport, type RoomMessage, type RoomTransport } from './transport';
import type { Action, SeatId, SessionState } from './types';
import { safeStorage, uid } from './util';

const PRESENCE_INTERVAL = 4000;
const PRESENCE_TIMEOUT = 11000;

type Listener = () => void;
type ActionListener = (action: Action, remote: boolean) => void;

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
  private timer: number | undefined;
  private unsubscribe: () => void;

  constructor(
    readonly roomId: string,
    private transport: RoomTransport = new BroadcastTransport(roomId),
  ) {
    this.state = this.load() ?? initialState(roomId);
    this.unsubscribe = transport.subscribe((m) => this.receive(m));
    transport.send({ kind: 'hello', from: this.clientId });
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
        this.transport.send({ kind: 'snapshot', from: this.clientId, to: m.from, rev: this.rev, state: this.state });
        this.beat();
        break;
      case 'snapshot':
        if (m.to === this.clientId && m.rev > this.rev) {
          this.state = upgrade(m.state);
          this.rev = m.rev;
          this.save();
          this.emit();
        }
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
