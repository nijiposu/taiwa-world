import { track } from '../analytics';
import type { SignalData } from '../state/protocol';
import type { RoomStore } from '../state/store';
import type { SeatId } from '../state/types';

/** 相手につながる道を探すためのサーバー（STUN）。多くの家庭・スマホ回線はこれで足りる */
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
const SPEAK_LEVEL = 0.035;

/**
 * 声の音質を上げる。Opus（Discord と同じ方式）のビットレートを、ふつうの約32kbpsから48kbpsへ。
 * 途切れたときの補い（FEC）は入れ、無音時に送らない設定（DTX）は切って声の立ち上がりを自然にする。
 */
function tuneOpus(sdp: string) {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1];
  if (!pt) return sdp;
  return sdp.replace(new RegExp(`a=fmtp:${pt} ([^\r\n]*)`), (_line, params: string) => {
    const keep = params.split(';').filter((p) => !/^(maxaveragebitrate|useinbandfec|usedtx|stereo)=/.test(p.trim()));
    return `a=fmtp:${pt} ${[...keep, 'maxaveragebitrate=48000', 'useinbandfec=1', 'usedtx=0', 'stereo=0'].join(';')}`;
  });
}

export interface VoiceSnapshot {
  joined: boolean;
  joining: boolean;
  muted: boolean;
  /** 声でつながっている相手の数 */
  peers: number;
  /** いま声を出している席 */
  speaking: SeatId[];
  error: string | null;
}

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
  meter: (() => number) | null;
}

/**
 * 部屋の中の声の通話（WebRTC、全員が全員と直接つながる形。4人まで快適）。
 * 合図（だれが入った・接続の申し込み・道すじ）は部屋サーバー経由で送る。
 * 相手と自分の clientId を比べて、小さいほうが申し込む（同時に申し込み合わない）。
 */
export class VoiceChat {
  private stream: MediaStream | null = null;
  private peers = new Map<string, Peer>();
  private listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private localMeter: (() => number) | null = null;
  private timer = 0;
  private unsubscribe: () => void;
  /** 相手の声の音量（0..1）。人ごとに覚えておく */
  private volume = (() => {
    try {
      const v = localStorage.getItem('taiwa:vol:voice');
      return v === null ? 1 : Math.max(0, Math.min(1, Number(v)));
    } catch {
      return 1;
    }
  })();
  private snap: VoiceSnapshot = { joined: false, joining: false, muted: false, peers: 0, speaking: [], error: null };

  constructor(private store: RoomStore) {
    this.unsubscribe = store.onSignal((from, data) => void this.onSignal(from, data));
  }

  getSnapshot = () => this.snap;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private update(patch: Partial<VoiceSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  async join() {
    if (this.snap.joined || this.snap.joining) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.update({ error: 'このブラウザでは声の通話が使えません' });
      return;
    }
    this.update({ joining: true, error: null });
    // 音の大きさをはかる仕組みは、押した瞬間（ブラウザが音を許す間）に作っておく
    this.ctx = new AudioContext();
    void this.ctx.resume();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      void this.ctx.close();
      this.ctx = null;
      this.update({ joining: false, error: 'マイクが使えませんでした（ブラウザの許可を確かめてください）' });
      return;
    }
    void this.ctx.resume();
    this.localMeter = this.meter(this.stream);
    this.update({ joined: true, joining: false, muted: false });
    track('voice');
    this.store.signal({ type: 'voice-join' });
    this.timer = window.setInterval(() => this.measure(), 150);
  }

  leave() {
    if (!this.snap.joined) return;
    this.store.signal({ type: 'voice-leave' });
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
    this.localMeter = null;
    this.update({ joined: false, muted: false, peers: 0, speaking: [] });
  }

  getVolume() {
    return this.volume;
  }

  setVolume(v: number) {
    this.volume = v;
    try {
      localStorage.setItem('taiwa:vol:voice', String(v));
    } catch {
      /* noop */
    }
    for (const p of this.peers.values()) p.audio.volume = v;
  }

  toggleMute() {
    const muted = !this.snap.muted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.update({ muted });
  }

  destroy() {
    this.leave();
    this.unsubscribe();
    this.listeners.clear();
  }

  private async onSignal(from: string, data: SignalData) {
    if (data.type === 'voice-leave') {
      this.drop(from);
      return;
    }
    if (!this.snap.joined) return;
    switch (data.type) {
      case 'voice-join':
        this.store.signal({ type: 'voice-here' }, from);
        await this.connect(from);
        break;
      case 'voice-here':
        await this.connect(from);
        break;
      case 'offer': {
        const peer = this.peer(from);
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await this.flushIce(peer);
        const answer = await peer.pc.createAnswer();
        const sdp = tuneOpus(answer.sdp ?? '');
        await peer.pc.setLocalDescription({ type: 'answer', sdp });
        this.store.signal({ type: 'answer', sdp }, from);
        break;
      }
      case 'answer': {
        const peer = this.peers.get(from);
        if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await this.flushIce(peer);
        break;
      }
      case 'ice': {
        const peer = this.peer(from);
        if (!data.candidate) return;
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate).catch(() => undefined);
        else peer.pendingIce.push(data.candidate);
        break;
      }
    }
  }

  private async flushIce(peer: Peer) {
    const list = peer.pendingIce;
    peer.pendingIce = [];
    for (const c of list) await peer.pc.addIceCandidate(c).catch(() => undefined);
  }

  /** 相手とつながる。申し込むのは clientId が小さいほう */
  private async connect(id: string) {
    const peer = this.peer(id);
    if (this.store.clientId < id && peer.pc.signalingState === 'stable' && !peer.pc.remoteDescription) {
      const offer = await peer.pc.createOffer();
      const sdp = tuneOpus(offer.sdp ?? '');
      await peer.pc.setLocalDescription({ type: 'offer', sdp });
      this.store.signal({ type: 'offer', sdp }, id);
    }
  }

  private peer(id: string): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audio = new Audio();
    audio.autoplay = true;
    audio.volume = this.volume;
    const peer: Peer = { pc, audio, pendingIce: [], meter: null };
    this.stream?.getTracks().forEach((t) => pc.addTrack(t, this.stream!));
    pc.onicecandidate = (e) => this.store.signal({ type: 'ice', candidate: e.candidate ? e.candidate.toJSON() : null }, id);
    pc.ontrack = (e) => {
      const remote = e.streams[0] ?? new MediaStream([e.track]);
      audio.srcObject = remote;
      void audio.play().catch(() => undefined);
      peer.meter = this.meter(remote);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.drop(id);
      this.update({ peers: [...this.peers.values()].filter((p) => p.pc.connectionState === 'connected').length });
    };
    this.peers.set(id, peer);
    return peer;
  }

  private drop(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peer.audio.srcObject = null;
    this.update({ peers: [...this.peers.values()].filter((p) => p.pc.connectionState === 'connected').length });
  }

  /** 声の大きさをはかる */
  private meter(stream: MediaStream) {
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      return () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        return Math.sqrt(sum / buf.length);
      };
    } catch {
      return null;
    }
  }

  private measure() {
    const speaking = new Set<SeatId>();
    const mine = this.store.seat;
    if (mine && !this.snap.muted && (this.localMeter?.() ?? 0) > SPEAK_LEVEL) speaking.add(mine);
    for (const [id, peer] of this.peers) {
      const seat = this.store.seatOf(id);
      if (seat && (peer.meter?.() ?? 0) > SPEAK_LEVEL) speaking.add(seat);
    }
    const next = [...speaking].sort();
    if (next.join() !== this.snap.speaking.join()) this.update({ speaking: next });
  }
}
