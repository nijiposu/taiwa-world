import type { Action, PersonalRecord, SessionState, WorldId } from './types';

const MAX_REACTIONS = 60;
const MAX_KEEPSAKES = 80;

export const EMPTY_RECORD: PersonalRecord = { works: '', feelings: '', insights: '', feedback: '' };

export function initialState(roomId: string): SessionState {
  return {
    version: 1,
    roomId,
    startedAt: null,
    world: 'campfire',
    visited: [],
    current: null,
    history: [],
    deckUsed: [],
    theme: '',
    participants: {},
    reactions: [],
    reactionCount: { campfire: 0, lantern: 0, nagori: 0, minasoko: 0, bbq: 0, town: 0 },
    speakQueue: [],
    leaves: [],
    lanterns: [],
    scenes: {},
    bottles: [],
    scraps: [],
    records: {},
  };
}

function visit(state: SessionState, world: WorldId, at: number): SessionState['visited'] {
  const last = state.visited[state.visited.length - 1];
  return last?.world === world ? state.visited : [...state.visited, { world, at }];
}

export function reduce(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'join':
      return {
        ...state,
        participants: { ...state.participants, [action.participant.seat]: action.participant },
      };
    case 'leave': {
      const participants = { ...state.participants };
      delete participants[action.seat];
      return { ...state, participants, speakQueue: state.speakQueue.filter((q) => q.seat !== action.seat) };
    }
    case 'start':
      return { ...state, startedAt: action.at, visited: visit(state, state.world, action.at) };
    case 'travel':
      if (state.world === action.world) return state;
      return { ...state, world: action.world, visited: visit(state, action.world, action.at) };
    case 'drawTopic': {
      const used = state.deckUsed.includes(action.drawn.topic.id)
        ? state.deckUsed
        : [...state.deckUsed, action.drawn.topic.id];
      return { ...state, current: action.drawn, history: [...state.history, action.drawn], deckUsed: used };
    }
    case 'clearTopic':
      return { ...state, current: null };
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'react': {
      const { event } = action;
      const queued = state.speakQueue.some((q) => q.seat === event.seat);
      return {
        ...state,
        reactions: [...state.reactions, event].slice(-MAX_REACTIONS),
        reactionCount: { ...state.reactionCount, [event.world]: (state.reactionCount[event.world] ?? 0) + 1 },
        speakQueue:
          event.reaction === 'speak' && !queued
            ? [...state.speakQueue, { seat: event.seat, at: event.at }]
            : state.speakQueue,
      };
    }
    case 'speakDone':
      return { ...state, speakQueue: state.speakQueue.filter((q) => q.seat !== action.seat) };
    case 'addLeaf':
      return { ...state, leaves: [...state.leaves, action.leaf].slice(-MAX_KEEPSAKES) };
    case 'floatLantern':
      return { ...state, lanterns: [...state.lanterns, action.lantern].slice(-MAX_KEEPSAKES) };
    case 'setScene':
      return { ...state, scenes: { ...state.scenes, [action.world]: action.scene } };
    case 'keepBottle':
      return { ...state, bottles: [...state.bottles, action.bottle].slice(-MAX_KEEPSAKES) };
    case 'addScrap':
      return { ...state, scraps: [...state.scraps, action.scrap].slice(-MAX_KEEPSAKES) };
    case 'updateRecord': {
      const prev = state.records[action.seat] ?? EMPTY_RECORD;
      return { ...state, records: { ...state.records, [action.seat]: { ...prev, ...action.patch } } };
    }
    case 'fx':
      return state;
    case 'reset':
      return { ...initialState(state.roomId), participants: state.participants, startedAt: action.at };
  }
}

/** 古い保存データに、あとから増えた項目を補う */
export function upgrade(state: SessionState): SessionState {
  const base = initialState(state.roomId);
  return { ...base, ...state, reactionCount: { ...base.reactionCount, ...state.reactionCount } };
}
