import { useEffect, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { worldAssets } from '../config/assets';
import { coverPoint, coverUV } from '../engine/cover';
import { drawTopic, keepsake } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import type { DrawnTopic } from '../state/types';
import { WordPrompt } from '../ui/WordPrompt';
import { CoverStage } from './CoverStage';
import { FESTIVAL_ASPECT, FestivalScene } from './FestivalScene';
import { useReactionEffects } from './useReactionEffects';

const IMG = worldAssets.lantern.scenes ?? {};

const FURIN = [
  { glass: '#7fd4ff', paper: '#ffe2a8', pattern: '金魚' },
  { glass: '#ff9db8', paper: '#cfe9ff', pattern: '朝顔' },
  { glass: '#b7f0c8', paper: '#ffd0d0', pattern: '花火' },
];

/**
 * 灯籠祭 −心の旅路−（ちえさんの世界）。湖と鳥居の絵が舞台。
 * 空に触れると花火、水面の灯籠に触れると空へ昇り、鳥居に触れると灯籠が順に灯る。
 */
export function FestivalWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<FestivalScene | null>(null);
  useReactionEffects('lantern', scene);
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const lanterns = useSession((s) => s.lanterns);
  const [ringing, setRinging] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [slip, setSlip] = useState<DrawnTopic | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = new FestivalScene(canvas);
    s.start();
    setScene(s);
    return () => s.destroy();
  }, []);

  useEffect(() => {
    scene?.syncLanterns(lanterns);
  }, [scene, lanterns]);

  useActionEffect((action) => {
    if (!scene) return;
    if (action.type === 'fx' && action.world === 'lantern') {
      const root = rootRef.current;
      if (action.fx === 'torii') {
        scene.torii();
        sound.chime(0, undefined, 0.7);
        window.setTimeout(() => sound.chime(2, undefined, 0.5), 260);
      }
      if (action.fx === 'release') {
        scene.release(action.value ?? 0);
        sound.chime((action.value ?? 0) % 4, undefined, 0.45);
      }
      if (action.fx === 'firework' && root && action.u !== undefined && action.v !== undefined) {
        const q = coverPoint(root.clientWidth, root.clientHeight, FESTIVAL_ASPECT, action.u, action.v);
        scene.launch(q.x, q.y);
        sound.boom();
      }
      if (action.fx === 'ripple' && root && action.u !== undefined && action.v !== undefined) {
        const q = coverPoint(root.clientWidth, root.clientHeight, FESTIVAL_ASPECT, action.u, action.v);
        scene.ripple(q.x, q.y);
      }
    }
    if (action.type === 'drawTopic' && action.drawn.world === 'lantern') {
      if (action.drawn.source === 'furin') {
        const i = Number(action.drawn.extra ?? 0) % FURIN.length;
        setRinging(i);
        sound.chime(i);
        window.setTimeout(() => setRinging((r) => (r === i ? null : r)), 2600);
      }
      if (action.drawn.source === 'omikuji') {
        setShaking(true);
        setSlip(null);
        window.setTimeout(() => {
          setShaking(false);
          setSlip(action.drawn);
          sound.chime(3, undefined, 0.6);
        }, 1100);
      }
      scene.flock(6);
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
    else if (hit.startsWith('lantern:')) dispatch({ type: 'fx', world: 'lantern', fx: 'release', value: Number(hit.split(':')[1]) });
    else if (hit === 'sky') dispatch({ type: 'fx', world: 'lantern', fx: 'firework', u, v });
    else dispatch({ type: 'fx', world: 'lantern', fx: 'ripple', u, v });
  };

  return (
    <div ref={rootRef} className="world world--lantern festival" onPointerDown={onDown}>
      <CoverStage src={IMG.festival} aspect={FESTIVAL_ASPECT} fallback="linear-gradient(#0a0a2a, #4a2250 52%, #2a1838 56%, #05040f)" className="festival__stage">
        <div className="omikuji omikuji--stone" style={{ left: '22%', top: '79%' }} onPointerDown={(e) => e.stopPropagation()}>
          <button
            className={`omikuji__box ${shaking ? 'is-shaking' : ''}`}
            onClick={() => dispatch(drawTopic(store.getState(), me.seat, 'omikuji'))}
            disabled={shaking}
            aria-label="おみくじを引く"
          >
            <span className="omikuji__stick" />
            <span className="omikuji__label">おみくじ</span>
          </button>
        </div>
      </CoverStage>
      <canvas ref={canvasRef} className="world__canvas world__canvas--fx" />
      <div className="world__overlay">
        <div className="furin-eave furin-eave--corner" onPointerDown={(e) => e.stopPropagation()}>
          {FURIN.map((f, i) => (
            <button
              key={i}
              className={`furin ${ringing === i ? 'is-ringing' : ''}`}
              style={{ ['--glass' as string]: f.glass, ['--paper' as string]: f.paper, animationDelay: `${-i * 1.3}s` }}
              onClick={() => dispatch(drawTopic(store.getState(), me.seat, 'furin', undefined, String(i)))}
              aria-label={`風鈴（${f.pattern}）`}
            >
              <span className="furin__string" />
              <span className="furin__bell" />
              <span className="furin__tanzaku">{f.pattern}</span>
            </button>
          ))}
        </div>
        {slip && (
          <button className="omikuji__slip omikuji__slip--float" onPointerDown={(e) => e.stopPropagation()} onClick={() => setSlip(null)} aria-label="おみくじを閉じる">
            <span className="omikuji__fortune">{slip.extra}</span>
            <span className="omikuji__q">{slip.topic.text}</span>
          </button>
        )}
        <button className="world-action world-action--lantern" onPointerDown={(e) => e.stopPropagation()} onClick={() => setAsking(true)}>
          <span aria-hidden>🏮</span> 灯籠を流す
        </button>
      </div>
      {asking && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <WordPrompt
            title="灯籠に、ひとことを"
            placeholder="今日持ってきた好きなもの・いま感じていること（なくても流せます）"
            submitLabel="そっと流す"
            allowEmpty
            onCancel={() => setAsking(false)}
            onSubmit={(text) => {
              dispatch({ type: 'floatLantern', lantern: keepsake(me.seat, text) });
              sound.chime(0, undefined, 0.5);
              setAsking(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
