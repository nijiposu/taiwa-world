import type { ReactNode, RefObject } from 'react';
import { assetUrl, worldAssets } from '../config/assets';
import type { WorldId } from '../state/types';

/** 差し替え素材（背景・前景）とキャンバスを重ねる */
export function WorldLayers({
  world,
  canvasRef,
  children,
}: {
  world: WorldId;
  canvasRef: RefObject<HTMLCanvasElement>;
  children?: ReactNode;
}) {
  const assets = worldAssets[world];
  return (
    <div className={`world world--${world}`}>
      {assets.background && <img className="world__bg" src={assetUrl(assets.background)} alt="" draggable={false} />}
      <canvas ref={canvasRef} className="world__canvas" />
      {assets.foreground && <img className="world__fg" src={assetUrl(assets.foreground)} alt="" draggable={false} />}
      <div className="world__overlay">{children}</div>
    </div>
  );
}

export const drawsBackdrop = (world: WorldId) => !worldAssets[world].background;
