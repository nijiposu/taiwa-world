import { useEffect, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { assetUrl, worldAssets } from '../config/assets';
import { WORLDS } from '../data/worlds';
import { useSession } from '../state/RoomContext';
import type { WorldId } from '../state/types';
import { BbqWorld } from './BbqWorld';
import { CampfireWorld } from './CampfireSwitch';
import { LanternWorld } from './LanternWorld';
import { MinasokoWorld } from './MinasokoWorld';
import { NagoriWorld } from './NagoriWorld';
import { TownWorld } from './TownWorld';

const VIEWS: Record<WorldId, () => JSX.Element> = {
  campfire: CampfireWorld,
  lantern: LanternWorld,
  nagori: NagoriWorld,
  minasoko: MinasokoWorld,
  bbq: BbqWorld,
  town: TownWorld,
};

const FADE_OUT = 900;
const HOLD = 700;

type Phase = 'idle' | 'leaving' | 'arriving';

/**
 * ワールド間の移動。
 * ベールが降りきってから次の世界に切り替え、題字を見せてからゆっくり明ける。
 */
export function WorldStage() {
  const world = useSession((s) => s.world);
  const [shown, setShown] = useState<WorldId>(world);
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState<WorldId>(world);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    sound.setWorld(shown);
  }, [shown]);

  useEffect(() => {
    if (world === shown && phase === 'idle') return;
    timers.current.forEach(clearTimeout);
    setTarget(world);
    setPhase('leaving');
    sound.whoosh();
    timers.current = [
      window.setTimeout(() => {
        setShown(world);
        setPhase('arriving');
      }, FADE_OUT),
      window.setTimeout(() => setPhase('idle'), FADE_OUT + HOLD + 1200),
    ];
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const View = VIEWS[shown];
  const info = WORLDS[target];
  const logo = worldAssets[target].logo;

  return (
    <div className="stage">
      <View key={shown} />
      <div
        className={`veil veil--${phase}`}
        style={{ ['--veil' as string]: info.veil, ['--accent' as string]: info.accent }}
        aria-hidden={phase === 'idle'}
      >
        <div className="veil__title">
          <small>{info.host}</small>
          {logo ? <img src={assetUrl(logo)} alt={info.name} /> : <h2>{info.name}</h2>}
          <p>{info.subtitle}</p>
        </div>
      </div>
    </div>
  );
}
