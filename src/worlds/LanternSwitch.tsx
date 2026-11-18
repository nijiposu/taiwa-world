import { useEffect, useState } from 'react';
import { assetUrl, worldAssets } from '../config/assets';
import { FestivalWorld } from './FestivalWorld';
import { LanternWorld as ProceduralLantern } from './LanternWorld';

const FESTIVAL = worldAssets.lantern.scenes?.festival;

/** ちえさんの絵が置かれていればそれを舞台に、無ければコードで描いた灯籠祭にする */
export function LanternWorld() {
  const [ok, setOk] = useState<boolean | null>(FESTIVAL ? null : false);
  useEffect(() => {
    if (!FESTIVAL) return;
    const img = new Image();
    img.onload = () => setOk(true);
    img.onerror = () => setOk(false);
    img.src = assetUrl(FESTIVAL);
  }, []);
  if (ok === null) return <div className="world world--lantern" />;
  return ok ? <FestivalWorld /> : <ProceduralLantern />;
}
