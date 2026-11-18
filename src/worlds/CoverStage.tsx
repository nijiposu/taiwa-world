import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { assetUrl } from '../config/assets';
import { coverRect } from '../engine/cover';

/**
 * イラストを画面いっぱいに敷き（cover）、その絵の座標系で子要素を置ける舞台。
 * 子要素は style の left/top を % で書くと、絵の中の位置に重なる。
 * 画像が無いときは fallback のグラデーションを敷く。
 */
export function CoverStage({
  src,
  aspect,
  fallback,
  className = '',
  children,
}: {
  src?: string;
  aspect: number;
  fallback: string;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<CSSProperties>({ inset: 0 });
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = coverRect(el.clientWidth, el.clientHeight, aspect);
      setBox({ left: r.x, top: r.y, width: r.w, height: r.h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  return (
    <div ref={ref} className={`cover ${className}`} style={{ background: fallback }}>
      <div className="cover__box" style={box}>
        {src && !failed && (
          <img className="cover__img" src={assetUrl(src)} alt="" draggable={false} onError={() => setFailed(true)} />
        )}
        {children}
      </div>
    </div>
  );
}
