import { useState } from 'react';
import { WORLDS } from '../data/worlds';
import { useScene } from '../engine/useScene';
import { useDispatch, useMe } from '../state/RoomContext';
import { useOpenPanel } from '../ui/PanelContext';
import { CampfireScene } from './CampfireScene';
import { WorldLayers, drawsBackdrop } from './WorldLayers';
import { useReactionEffects } from './useReactionEffects';

/** 素材が置かれていないときの、コードで描いた焚き火 */
export function ProceduralCampfire() {
  const [poked, setPoked] = useState(false);
  const { canvasRef, scene } = useScene((c) => new CampfireScene(c), {
    backdrop: drawsBackdrop('campfire'),
    onHit: () => setPoked(true),
  });
  useReactionEffects('campfire', scene);
  const me = useMe();
  const dispatch = useDispatch();
  const openPanel = useOpenPanel();
  const canTravel = me.role === 'host';

  return (
    <WorldLayers world="campfire" canvasRef={canvasRef}>
      <button
        className="campfire__fire"
        aria-label="焚き火をつつく"
        onClick={() => {
          scene?.poke();
          setPoked(true);
        }}
      />
      <p className={`world-hint ${poked ? 'is-hidden' : ''}`}>焚き火に触れると、火の粉が舞います。夜空に触れると……？</p>
      <button className="path path--left path--map" onClick={() => openPanel('map')} title="世界地図をひらく">
        <span className="path__glow" aria-hidden />
        <span className="path__icon" aria-hidden>
          🗺️
        </span>
        <span className="path__text">
          <small>ほかのエリアへ</small>
          世界地図をひらく
        </span>
      </button>
      <button
        className="path path--right path--nagori"
        onClick={() => dispatch({ type: 'travel', world: 'nagori', at: Date.now() })}
        disabled={!canTravel}
        title={canTravel ? `${WORLDS.nagori.name}へ` : '移動はホストが案内します'}
      >
        <span className="path__glow" aria-hidden />
        <span className="path__icon" aria-hidden>
          🌳
        </span>
        <span className="path__text">
          {WORLDS.nagori.host && <small>{WORLDS.nagori.host}</small>}
          {WORLDS.nagori.name}へ
        </span>
      </button>
    </WorldLayers>
  );
}
