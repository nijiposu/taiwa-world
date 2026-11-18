import { FORTUNES, TOPICS } from '../data/topics';
import type { Action, DrawnTopic, Keepsake, ReactionId, SeatId, SessionState, Topic, TopicSource } from './types';
import { pick, uid } from './util';

/** 山札からまだ引いていないお題を一枚。尽きたら山札を戻す */
export function nextFromDeck(state: SessionState): Topic {
  const currentId = state.current?.topic.id;
  let pool = TOPICS.filter((t) => !state.deckUsed.includes(t.id));
  if (pool.length === 0) pool = TOPICS.filter((t) => t.id !== currentId);
  return pick(pool);
}

export function drawTopic(
  state: SessionState,
  by: SeatId,
  source: TopicSource,
  topic: Topic = nextFromDeck(state),
  extra?: string,
): Action {
  const drawn: DrawnTopic = {
    topic,
    source,
    by,
    world: state.world,
    at: Date.now(),
    extra: extra ?? (source === 'omikuji' ? pick(FORTUNES) : undefined),
  };
  return { type: 'drawTopic', drawn };
}

export function react(state: SessionState, seat: SeatId, reaction: ReactionId): Action {
  return { type: 'react', event: { id: uid(), seat, reaction, world: state.world, at: Date.now() } };
}

export function keepsake(seat: SeatId, text: string, x = Math.random(), y = Math.random()): Keepsake {
  return { id: uid(), seat, text: text.trim().slice(0, 40), at: Date.now(), x, y };
}
