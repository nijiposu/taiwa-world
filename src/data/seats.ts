import type { Role, SeatId } from '../state/types';

export interface SeatInfo {
  seat: SeatId;
  role: Role;
  label: string;
  defaultName: string;
  defaultAvatar: string;
}

/** ホスト2名・ゲスト2名の席。名前とアイコンは入室時に変えられる */
export const SEATS: SeatInfo[] = [
  { seat: 'host1', role: 'host', label: 'ホスト', defaultName: '虹乃', defaultAvatar: '🌈' },
  { seat: 'host2', role: 'host', label: 'ホスト', defaultName: 'ちえ', defaultAvatar: '🏮' },
  { seat: 'guest1', role: 'guest', label: 'ゲスト', defaultName: '', defaultAvatar: '🦊' },
  { seat: 'guest2', role: 'guest', label: 'ゲスト', defaultName: '', defaultAvatar: '🐇' },
];

export const SEAT_BY_ID = Object.fromEntries(SEATS.map((s) => [s.seat, s])) as Record<SeatId, SeatInfo>;

export const AVATARS = ['🌈', '🏮', '🦊', '🐇', '🦉', '🐈', '🐋', '🐢', '🌙', '⭐', '🍄', '🌷', '🍃', '🔥', '🎐', '📚'];

export function displayName(name: string | undefined, seat: SeatId) {
  if (name) return name;
  return seat === 'guest1' ? 'ゲストA' : seat === 'guest2' ? 'ゲストB' : SEAT_BY_ID[seat].defaultName;
}
