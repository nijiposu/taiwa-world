import type { ReactionId } from '../state/types';

export interface ReactionInfo {
  id: ReactionId;
  emoji: string;
  label: string;
  color: string;
}

export const REACTIONS: ReactionInfo[] = [
  { id: 'empathy', emoji: '🧡', label: 'わかる！', color: '#ff9a52' },
  { id: 'more', emoji: '✨', label: 'もっと聞きたい', color: '#ffe08a' },
  { id: 'speak', emoji: '✋', label: '私も話したい', color: '#9ad7ff' },
  { id: 'other', emoji: '🌱', label: '違う視点がある', color: '#8fe3a1' },
];

export const REACTION_BY_ID = Object.fromEntries(REACTIONS.map((r) => [r.id, r])) as Record<ReactionId, ReactionInfo>;
