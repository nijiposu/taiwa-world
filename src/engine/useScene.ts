import { useEffect, useRef, useState } from 'react';
import type { Scene } from './Scene';

/**
 * キャンバスに Scene を載せる。
 * onHit には、Scene.pointer が返した「触れた場所の名前」が届く。
 */
export function useScene<S extends Scene>(
  create: (canvas: HTMLCanvasElement) => S,
  options: { backdrop: boolean; onHit?: (hit: string, scene: S) => void },
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<S | null>(null);
  const onHit = useRef(options.onHit);
  onHit.current = options.onHit;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = create(canvas);
    s.setBackdropEnabled(options.backdrop);
    s.start();
    setScene(s);

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const move = (e: PointerEvent) => s.pointer(...pos(e), 'move');
    const down = (e: PointerEvent) => {
      const hit = s.pointer(...pos(e), 'down');
      if (hit) onHit.current?.(hit, s);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', down);
    return () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', down);
      s.destroy();
    };
    // Scene は一度だけ作る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scene?.setBackdropEnabled(options.backdrop);
  }, [scene, options.backdrop]);

  return { canvasRef, scene };
}
