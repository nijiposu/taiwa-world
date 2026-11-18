import { assetUrl } from '../config/assets';
import { REACTION_BY_ID } from '../data/reactions';
import type { ReactionId, WorldId } from '../state/types';

/** ナゴリの樹のスタンプ（樹のエリアで使う） */
const NAGORI_STAMPS: Record<ReactionId, string> = {
  empathy: 'assets/nagori-ui/stamp-feel.webp',
  more: 'assets/nagori-ui/sign-near.webp',
  speak: 'assets/nagori-ui/stamp-fire.webp',
  other: 'assets/nagori-ui/stamp-sprout.webp',
};

/**
 * リアクションの見た目を、いる世界に合わせて変える。
 * 樹のエリア：ナゴリの樹のスタンプ／灯籠祭：提灯の中に灯る印／それ以外：絵文字
 */
export function ReactionIcon({ reaction, world }: { reaction: ReactionId; world: WorldId }) {
  const info = REACTION_BY_ID[reaction];
  if (world === 'campfire' || world === 'nagori') {
    return <img className="r-icon r-icon--stamp" src={assetUrl(NAGORI_STAMPS[reaction])} alt="" draggable={false} />;
  }
  if (world === 'lantern') {
    return (
      <span className="r-icon r-icon--chochin" style={{ ['--c' as string]: info.color }}>
        <i>{info.emoji}</i>
      </span>
    );
  }
  return <span className="r-icon">{info.emoji}</span>;
}
