import type { WorldId } from '../state/types';

/**
 * 各ワールドのもとになった作品への入口。
 * 世界観を気に入った人が、あとから作品のゲームを遊びに行けるように。
 * url を書くと、地図の詳しいカードと各ワールドの右上に「作品を見る」が出る。空のままなら出ない。
 */
export interface WorkLink {
  label: string;
  url: string;
}

export const WORK_LINKS: Partial<Record<WorldId, WorkLink>> = {
  nagori: { label: 'ゲーム「ナゴリの樹」で遊ぶ', url: '' },
  lantern: { label: '「灯籠祭 −心の旅路−」について', url: '' },
  minasoko: { label: 'TRPG「水底郵便局」で遊ぶ', url: '' },
  bbq: { label: '「才能BBQ」で遊ぶ', url: '' },
  town: { label: '「やりたいことが消えた町」で遊ぶ', url: '' },
};

export function workLink(world: WorldId): WorkLink | null {
  const link = WORK_LINKS[world];
  return link?.url ? link : null;
}
