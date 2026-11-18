import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { WorldId } from '../state/types';
import { AmbientScene, type AmbientKind } from './AmbientScene';
import { CoverStage } from './CoverStage';
import { useReactionEffects } from './useReactionEffects';

/**
 * 作品のイラストを舞台にするワールドの共通部分。
 * stage には絵の座標（%）で置くもの、children には画面の座標で置くものを渡す。
 */
export function ImageWorld({
  world,
  kind,
  src,
  aspect,
  fallback,
  stage,
  stageClass,
  children,
  onScene,
}: {
  world: WorldId;
  kind: AmbientKind;
  src?: string;
  aspect: number;
  fallback: string;
  stage?: ReactNode;
  stageClass?: string;
  children?: ReactNode;
  onScene?: (scene: AmbientScene) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<AmbientScene | null>(null);
  useReactionEffects(world, scene);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = new AmbientScene(canvas, kind, aspect);
    s.start();
    setScene(s);
    onScene?.(s);
    return () => s.destroy();
    // 舞台の絵の比率が変わったときだけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, aspect]);

  return (
    <div className={`world world--${world}`}>
      <CoverStage src={src} aspect={aspect} fallback={fallback} className={stageClass}>
        {stage}
      </CoverStage>
      <canvas ref={canvasRef} className="world__canvas world__canvas--fx" />
      <div className="world__overlay">{children}</div>
    </div>
  );
}
