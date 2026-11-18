export type WorldId = 'campfire' | 'lantern' | 'nagori' | 'minasoko' | 'bbq' | 'town';
export type ReactionId = 'empathy' | 'more' | 'speak' | 'other';
export type Role = 'host' | 'guest';
export type SeatId = 'host1' | 'host2' | 'guest1' | 'guest2';
export type TopicSource = 'deck' | 'pick' | 'furin' | 'omikuji' | 'tree' | 'letter' | 'bbq' | 'clock';

export interface Participant {
  seat: SeatId;
  name: string;
  avatar: string;
  role: Role;
}

export interface Topic {
  id: string;
  text: string;
  tag: string;
}

export interface DrawnTopic {
  topic: Topic;
  source: TopicSource;
  by: SeatId;
  world: WorldId;
  at: number;
  /** おみくじの運勢など、ギミック固有の添え物 */
  extra?: string;
}

export interface ReactionEvent {
  id: string;
  seat: SeatId;
  reaction: ReactionId;
  world: WorldId;
  at: number;
}

export interface SpeakRequest {
  seat: SeatId;
  at: number;
}

/** ナゴリの樹に残した言葉、灯籠に託した一言 */
export interface Keepsake {
  id: string;
  seat: SeatId;
  text: string;
  at: number;
  /** 0..1 の正規化座標（樹の葉の位置など）。灯籠では流し始めの時刻ずれに使う */
  x: number;
  y: number;
}

export interface PersonalRecord {
  works: string;
  feelings: string;
  insights: string;
  feedback: string;
}

export interface SessionState {
  version: 1;
  roomId: string;
  startedAt: number | null;
  world: WorldId;
  visited: { world: WorldId; at: number }[];
  current: DrawnTopic | null;
  history: DrawnTopic[];
  /** 山札から引いた順番。全員で同じ山札を共有するため state に持つ */
  deckUsed: string[];
  theme: string;
  participants: Partial<Record<SeatId, Participant>>;
  reactions: ReactionEvent[];
  reactionCount: Record<WorldId, number>;
  speakQueue: SpeakRequest[];
  leaves: Keepsake[];
  lanterns: Keepsake[];
  /** ワールドの中の場面（水底郵便局の入口／受付など） */
  scenes: Partial<Record<WorldId, string>>;
  /** 水底郵便局に預けた手紙 */
  bottles: Keepsake[];
  /** やりたいことが消えた町に持ち寄った「好き」 */
  scraps: Keepsake[];
  records: Partial<Record<SeatId, PersonalRecord>>;
}

/**
 * 全員の画面に同じ変化を起こすための操作。
 * Phase 2 ではこの Action をそのままリアルタイム通信に流す。
 * ランダム性（引いたお題など）は発行側で確定させ、Action に含める。
 */
export type Action =
  | { type: 'join'; participant: Participant }
  | { type: 'leave'; seat: SeatId }
  | { type: 'start'; at: number }
  | { type: 'travel'; world: WorldId; at: number }
  | { type: 'drawTopic'; drawn: DrawnTopic }
  | { type: 'clearTopic' }
  | { type: 'setTheme'; theme: string }
  | { type: 'react'; event: ReactionEvent }
  | { type: 'speakDone'; seat: SeatId }
  | { type: 'addLeaf'; leaf: Keepsake }
  | { type: 'floatLantern'; lantern: Keepsake }
  | { type: 'setScene'; world: WorldId; scene: string }
  | { type: 'keepBottle'; bottle: Keepsake }
  | { type: 'addScrap'; scrap: Keepsake }
  | { type: 'updateRecord'; seat: SeatId; patch: Partial<PersonalRecord> }
  | { type: 'reset'; at: number }
  /** 状態は変えず、全員の画面で同じ演出だけを起こす（焚き火をつつく、ランタンに触れる など） */
  | { type: 'fx'; world: WorldId; fx: string; value?: number; u?: number; v?: number };
