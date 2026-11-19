import type { Action, SeatId, SessionState } from './types';

/** 同じルームにいる端末どうしでやり取りするメッセージ */
export type RoomMessage =
  | { kind: 'action'; from: string; action: Action }
  | { kind: 'hello'; from: string }
  /**
   * 部屋の状態のまるごと。authoritative はサーバーから届いたもの（そのまま採用する）。
   * サーバーがまだ何も持っていないときは state が null で届くので、手元の状態を seed で渡す。
   */
  | { kind: 'snapshot'; from: string; to: string; rev: number; state: SessionState | null; authoritative?: boolean }
  | { kind: 'seed'; from: string; state: SessionState }
  | { kind: 'presence'; from: string; seat: SeatId | null; at: number }
  | { kind: 'bye'; from: string; seat: SeatId | null }
  /** 声の通話の合図（WebRTC）。to が無ければ部屋の全員へ */
  | { kind: 'signal'; from: string; to?: string; data: SignalData };

export type SignalData =
  | { type: 'voice-join' }
  | { type: 'voice-here' }
  | { type: 'voice-leave' }
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidate | null };

/** RTCIceCandidateInit と同じ形（サーバー側でも使えるように自前で書く） */
export interface IceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}
