import type { WorldId } from '../state/types';

/**
 * 世界地図のエリア。x, y は地図（1600×1000）の中の位置。
 * worlds が空のエリアは「準備中」として霧がかかる。
 */
export interface AtlasRegion {
  id: string;
  name: string;
  /** そのエリアの作り手・由来 */
  note: string;
  x: number;
  y: number;
  /** 島の大きさ */
  r: number;
  color: [string, string];
  worlds: WorldId[];
  comingSoon?: string;
}

export const ATLAS: AtlasRegion[] = [
  { id: 'tree', name: '樹のエリア', note: '虹乃氏の世界', x: 800, y: 520, r: 190, color: ['#3f8a5e', '#16402c'], worlds: ['campfire', 'nagori'] },
  { id: 'wa', name: '倭のエリア', note: 'ちえさんの世界', x: 330, y: 270, r: 150, color: ['#c0584a', '#4a1a26'], worlds: ['lantern'] },
  { id: 'moon', name: '月のエリア', note: 'ちえさんの世界', x: 800, y: 150, r: 120, color: ['#8c86c8', '#2a2856'], worlds: [], comingSoon: 'ちえさんの作品がここに来る予定です' },
  { id: 'town', name: '町のエリア', note: '虹乃氏の世界', x: 1270, y: 280, r: 150, color: ['#8a6ab8', '#2e2048'], worlds: ['town'] },
  { id: 'water', name: '水のエリア', note: '虹乃氏の世界', x: 330, y: 770, r: 160, color: ['#3a78c0', '#0e2448'], worlds: ['minasoko'] },
  { id: 'bbq', name: 'BBQ広場', note: '虹乃氏の世界', x: 1270, y: 770, r: 150, color: ['#c88a3e', '#4a2a14'], worlds: ['bbq'] },
];

/** エリアの中で、各ワールドの入口を置く位置（エリア中心からのずれ） */
export const SPOT_OFFSET: Partial<Record<WorldId, [number, number]>> = {
  campfire: [-110, 80],
  nagori: [120, -20],
  lantern: [0, 56],
  town: [0, 56],
  minasoko: [0, 56],
  bbq: [0, 56],
};
