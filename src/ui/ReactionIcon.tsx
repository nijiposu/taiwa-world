import { assetUrl } from '../config/assets';
import type { ReactionId, WorldId } from '../state/types';

/**
 * リアクションの見た目。どの世界でも、夜空のしずくの中に金色の印が灯るアイコンにそろえる。
 * （world は将来、世界ごとに変えたくなったとき用に受け取っておく）
 */
export function ReactionIcon({ reaction }: { reaction: ReactionId; world?: WorldId }) {
  return <img className="r-icon r-icon--stamp" src={assetUrl(`assets/festival-ui/${reaction}.svg`)} alt="" draggable={false} />;
}
