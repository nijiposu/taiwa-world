import { assetUrl } from '../config/assets';

/**
 * アイコン。絵文字か、作品の人物の絵（'img:キー'）のどちらか。
 * 絵は public/assets/nagori-ui/face-<キー>.webp
 */
export const FACE_AVATARS = [
  'hero-empathy', 'hero-courage', 'hero-unease', 'player', 'senpai', 'mina', 'kai', 'noa', 'ruka', 'mari', 'ren',
].map((k) => `img:${k}`);

export function Avatar({ value, className = '' }: { value?: string; className?: string }) {
  if (value?.startsWith('img:')) {
    return <img className={`avatar-img ${className}`} src={assetUrl(`assets/nagori-ui/face-${value.slice(4)}.webp`)} alt="" draggable={false} />;
  }
  return <span className={className}>{value ?? '·'}</span>;
}
