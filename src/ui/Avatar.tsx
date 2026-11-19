import { assetUrl } from '../config/assets';

/**
 * アイコン。絵文字か、絵（'img:キー'）のどちらか。
 * 絵は public/assets/nagori-ui/face-<キー>.webp。焚き火を囲む芽の子と同じ子の、色ちがい8人。
 */
export const FACE_AVATARS = [
  'sprout-cream', 'sprout-peach', 'sprout-sakura', 'sprout-lavender', 'sprout-sky', 'sprout-mint', 'sprout-sage', 'sprout-night',
].map((k) => `img:${k}`);

export function Avatar({ value, className = '' }: { value?: string; className?: string }) {
  if (value?.startsWith('img:')) {
    return <img className={`avatar-img ${className}`} src={assetUrl(`assets/nagori-ui/face-${value.slice(4)}.webp`)} alt="" draggable={false} />;
  }
  return <span className={className}>{value ?? '·'}</span>;
}
