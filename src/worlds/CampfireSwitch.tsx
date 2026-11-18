import { useEffect, useState } from 'react';
import { assetUrl, worldAssets } from '../config/assets';
import { ProceduralCampfire } from './CampfireWorld';
import { HearthWorld } from './HearthWorld';

const HIROBA = worldAssets.campfire.scenes?.hiroba;

/** 森の広場の絵が置かれていればそれを舞台に、無ければコードで描いた焚き火にする */
export function CampfireWorld() {
  const [ok, setOk] = useState<boolean | null>(HIROBA ? null : false);

  useEffect(() => {
    if (!HIROBA) return;
    const img = new Image();
    img.onload = () => setOk(true);
    img.onerror = () => setOk(false);
    img.src = assetUrl(HIROBA);
  }, []);

  if (ok === null) return <div className="world world--campfire" />;
  return ok ? <HearthWorld /> : <ProceduralCampfire />;
}
