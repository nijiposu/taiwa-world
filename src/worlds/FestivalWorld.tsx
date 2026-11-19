import { useEffect, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { assetUrl, worldAssets } from '../config/assets';
import { coverPoint, coverUV } from '../engine/cover';
import { useActionEffect, useDispatch } from '../state/RoomContext';
import { CoverStage } from './CoverStage';
import { FESTIVAL_ASPECT, FestivalScene } from './FestivalScene';
import { useReactionEffects } from './useReactionEffects';

const IMG = worldAssets.lantern.scenes ?? {};

/**
 * 灯籠祭 −心の旅路−（ちえさんの世界）。湖と鳥居の絵が舞台。
 * ちえさんの作品の仕掛けはネタバレになるので置かず、湖・空・鳥居に触れたときの静かな反応だけにする。
 */
export function FestivalWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<FestivalScene | null>(null);
  useReactionEffects('lantern', scene);
  const dispatch = useDispatch();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = new FestivalScene(canvas, IMG.festival ? assetUrl(IMG.festival) : undefined);
    s.start();
    setScene(s);
    return () => s.destroy();
  }, []);

  // 誰かが触れたら、みんなの画面で同じことが起きる
  useActionEffect((action) => {
    const root = rootRef.current;
    if (!scene || !root || action.type !== 'fx' || action.world !== 'lantern') return;
    if (action.fx === 'torii') {
      scene.torii();
      sound.chime(0, undefined, 0.6);
      window.setTimeout(() => sound.chime(2, undefined, 0.45), 300);
      return;
    }
    if (action.u === undefined || action.v === undefined) return;
    const q = coverPoint(root.clientWidth, root.clientHeight, FESTIVAL_ASPECT, action.u, action.v);
    if (action.fx === 'star') {
      scene.shootingStar(q.x, q.y);
      sound.chime(3, undefined, 0.3);
    }
    if (action.fx === 'ripple') {
      scene.ripple(q.x, q.y);
      sound.chime(1, undefined, 0.2);
    }
  });

  const onDown = (e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!scene || !root) return;
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = scene.pointer(x, y, 'down');
    if (!hit) return;
    const { u, v } = coverUV(root.clientWidth, root.clientHeight, FESTIVAL_ASPECT, x, y);
    if (hit === 'torii') dispatch({ type: 'fx', world: 'lantern', fx: 'torii' });
    else dispatch({ type: 'fx', world: 'lantern', fx: hit === 'sky' ? 'star' : 'ripple', u, v });
  };

  return (
    <div ref={rootRef} className="world world--lantern festival" onPointerDown={onDown}>
      <CoverStage src={IMG.festival} aspect={FESTIVAL_ASPECT} fallback="linear-gradient(#0a0a2a, #4a2250 52%, #2a1838 56%, #05040f)" className="festival__stage" />
      <canvas ref={canvasRef} className="world__canvas world__canvas--fx" />
    </div>
  );
}
