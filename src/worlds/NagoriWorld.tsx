import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { displayName } from '../data/seats';
import { useScene } from '../engine/useScene';
import { drawTopic, keepsake } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import { WordPrompt } from '../ui/WordPrompt';
import { NagoriScene, leafPoint, treeLayout } from './NagoriScene';
import { WorldLayers, drawsBackdrop } from './WorldLayers';
import { useReactionEffects } from './useReactionEffects';

export function NagoriWorld() {
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const leaves = useSession((s) => s.leaves);
  const participants = useSession((s) => s.participants);
  const reactions = useSession((s) => s.reactionCount.nagori);
  const [asking, setAsking] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [openLeaf, setOpenLeaf] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { canvasRef, scene } = useScene((c) => new NagoriScene(c), {
    backdrop: drawsBackdrop('nagori'),
    onHit: (hit) => {
      if (hit === 'trunk') {
        setTouched(true);
        dispatch(drawTopic(store.getState(), me.seat, 'tree'));
      }
      if (hit === 'spirit') sound.pop(1.6);
      if (hit === 'canopy') sound.chime(Math.floor(Math.random() * 4), undefined, 0.25);
    },
  });
  useReactionEffects('nagori', scene);

  // 対話（リアクション）と言葉の葉の数だけ、樹に灯りがともる
  const light = 3 + reactions + leaves.length;
  const first = useRef(true);
  useEffect(() => {
    if (!scene) return;
    if (first.current) scene.setLightImmediate(light);
    else scene.setLightLevel(light);
    first.current = false;
  }, [scene, light]);

  useActionEffect((action, remote) => {
    // 他の人が幹に触れたときも、樹が応える
    if (remote && action.type === 'drawTopic' && action.drawn.source === 'tree') scene?.touchTrunk();
  });

  useLayoutEffect(() => {
    const el = rootRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = treeLayout(size.w, size.h);

  return (
    <WorldLayers world="nagori" canvasRef={canvasRef}>
      <div ref={rootRef} className="leaf-layer">
        {size.w > 0 &&
          leaves.map((leaf) => {
            const p = leafPoint(L, leaf.x, leaf.y);
            const fresh = Date.now() - leaf.at < 3000;
            return (
              <button
                key={leaf.id}
                className={`word-leaf ${openLeaf === leaf.id ? 'is-open' : ''} ${fresh ? 'is-fresh' : ''}`}
                style={{ left: p.x, top: p.y, ['--tilt' as string]: `${(leaf.x - 0.5) * 70}deg` }}
                onClick={() => setOpenLeaf(openLeaf === leaf.id ? null : leaf.id)}
                aria-label={`葉のことば：${leaf.text}`}
              >
                <span className="word-leaf__shape" aria-hidden />
                <span className="word-leaf__text">
                  {leaf.text}
                  <small>— {displayName(participants[leaf.seat]?.name, leaf.seat)}</small>
                </span>
              </button>
            );
          })}
      </div>
      <button
        className="nagori__trunk"
        style={{ left: L.baseX, top: (L.trunkTop + L.baseY) / 2, width: L.rx * 0.36, height: L.baseY - L.trunkTop }}
        aria-label="樹に触れて問いを受け取る"
        onClick={() => {
          scene?.touchTrunk();
          setTouched(true);
          dispatch(drawTopic(store.getState(), me.seat, 'tree'));
        }}
      />
      <p className={`world-hint ${touched ? 'is-hidden' : ''}`}>樹の幹に触れると、問いが芽吹きます。根もとの小さな子たちにも……</p>
      <button className="world-action world-action--leaf" onClick={() => setAsking(true)}>
        <span aria-hidden>🍃</span> 葉にことばを残す
      </button>
      {asking && (
        <WordPrompt
          title="ナゴリの樹に、ことばを"
          placeholder="心に残ったひとこと・好きな理由・今日の気づき"
          submitLabel="葉にする"
          onCancel={() => setAsking(false)}
          onSubmit={(text) => {
            dispatch({ type: 'addLeaf', leaf: keepsake(me.seat, text) });
            sound.chime(2, undefined, 0.5);
            setAsking(false);
          }}
        />
      )}
    </WorldLayers>
  );
}
