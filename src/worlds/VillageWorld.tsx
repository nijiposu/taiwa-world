import { useEffect, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { worldAssets } from '../config/assets';
import { displayName } from '../data/seats';
import { keepsake } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession } from '../state/RoomContext';
import { pick } from '../state/util';
import { WordPrompt } from '../ui/WordPrompt';
import { CoverStage } from './CoverStage';
import { FIRE, SPOTS, VILLAGE_ASPECT, VillageScene, type SpotName } from './VillageScene';
import { useReactionEffects } from './useReactionEffects';

const IMG = worldAssets.nagori.scenes ?? {};
const AMBIENT = ['gust', 'lanterns', 'gust', 'library', 'stump'] as const;
const SPOT_LABEL: Record<SpotName, string> = { stump: '切り株の芽', door: '樹の扉', cellar: '地下への入口', library: '書庫', cottage: '小屋', moon: '月' };

/**
 * ナゴリの樹・根もとの村。樹の家、小屋、図書館、焚き火と、地下へ続く入口。
 * 触れると何かが起き、対話があたたまるほど樹の窓が一つずつ灯っていく。
 * 言葉の葉は、樹の枝に葉として残る。
 */
export function VillageWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<VillageScene | null>(null);
  useReactionEffects('nagori', scene);
  const dispatch = useDispatch();
  const me = useMe();
  const leaves = useSession((s) => s.leaves);
  const reactions = useSession((s) => s.reactionCount.nagori);
  const participants = useSession((s) => s.participants);
  const [asking, setAsking] = useState(false);
  const [openLeaf, setOpenLeaf] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = new VillageScene(canvas);
    s.start();
    setScene(s);
    return () => s.destroy();
  }, []);

  // 場があたたまるほど、樹の窓が一つずつ灯る
  useEffect(() => {
    scene?.setLight(2 + Math.floor(reactions / 2) + leaves.length);
  }, [scene, reactions, leaves.length]);

  // ぼんやり眺めていても、ときどき何かが起きる
  useEffect(() => {
    if (!scene) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        const ev = pick(AMBIENT);
        if (ev === 'gust') scene.gust();
        if (ev === 'lanterns') for (let i = 0; i < 10; i++) window.setTimeout(() => scene.lantern(i), i * 110);
        if (ev === 'library') scene.touch('library');
        if (ev === 'stump') scene.touch('stump');
        next();
      }, 8000 + Math.random() * 9000);
    };
    next();
    return () => window.clearTimeout(timer);
  }, [scene]);

  useActionEffect((action) => {
    if (!scene || action.type !== 'fx' || action.world !== 'nagori') return;
    if (action.fx === 'fire') {
      scene.poke();
      sound.sample('campfire', 'fire', 0.5) || sound.pop(0.7);
    } else if (action.fx === 'lantern') {
      scene.lantern(action.value ?? 0);
      sound.chime((action.value ?? 0) % 4, undefined, 0.45);
    } else if (action.fx.startsWith('spot:')) {
      const spot = action.fx.slice(5) as 'stump' | 'door' | 'cellar' | 'library' | 'cottage' | 'moon';
      scene.touch(spot);
      if (spot === 'library') sound.sample('campfire', 'page', 0.8) || sound.bell();
      else if (spot === 'cellar') sound.sample('campfire', 'open', 0.6) || sound.whoosh();
      else sound.chime(spot === 'moon' ? 3 : 1, undefined, 0.45);
    } else if (action.fx === 'gust') {
      scene.gust();
    }
  });

  const onPointer = (e: React.PointerEvent, kind: 'move' | 'down') => {
    const root = rootRef.current;
    if (!scene || !root) return;
    const r = root.getBoundingClientRect();
    const hit = scene.pointer(e.clientX - r.left, e.clientY - r.top, kind);
    if (kind !== 'down' || !hit) return;
    if (hit === 'fire') dispatch({ type: 'fx', world: 'nagori', fx: 'fire' });
    else if (hit.startsWith('lantern:')) dispatch({ type: 'fx', world: 'nagori', fx: 'lantern', value: Number(hit.split(':')[1]) });
    else if (hit.startsWith('spot:')) dispatch({ type: 'fx', world: 'nagori', fx: hit });
    else if (hit === 'canopy') dispatch({ type: 'fx', world: 'nagori', fx: 'gust' });
    else sound.sample('campfire', 'tap', 0.35);
  };

  return (
    <div
      ref={rootRef}
      className="world world--nagori village"
      onPointerMove={(e) => onPointer(e, 'move')}
      onPointerDown={(e) => onPointer(e, 'down')}
    >
      <CoverStage src={IMG.village} aspect={VILLAGE_ASPECT} fallback="linear-gradient(#3a2a52, #6a4a3a 45%, #2a2016)" className="village__stage">
        {/* 触れられる場所の目印（ほのかに光る輪） */}
        {[['fire', FIRE.u, FIRE.v - 0.02, '焚き火'] as const, ...(Object.keys(SPOTS) as SpotName[]).map((k) => [k, SPOTS[k].u, SPOTS[k].v, SPOT_LABEL[k]] as const)].map(
          ([key, u, v, label], i) => (
            <span key={key} className="touch-hint" style={{ left: `${u * 100}%`, top: `${v * 100}%`, animationDelay: `${i * 0.7}s` }} aria-hidden>
              <i />
              <b>{label}</b>
            </span>
          ),
        )}
        {/* 言葉の葉は、樹の枝にとまる */}
        {leaves.map((leaf) => {
          const fresh = Date.now() - leaf.at < 3000;
          return (
            <button
              key={leaf.id}
              className={`word-leaf ${openLeaf === leaf.id ? 'is-open' : ''} ${fresh ? 'is-fresh' : ''}`}
              style={{ left: `${12 + leaf.x * 76}%`, top: `${5 + leaf.y * 20}%`, ['--tilt' as string]: `${(leaf.x - 0.5) * 70}deg` }}
              onPointerDown={(e) => e.stopPropagation()}
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
      </CoverStage>
      <canvas ref={canvasRef} className="world__canvas world__canvas--fx" />
      <div className="world__overlay">
        <button className="world-action world-action--leaf" onPointerDown={(e) => e.stopPropagation()} onClick={() => setAsking(true)}>
          <span aria-hidden>🍃</span> 葉にことばを残す
        </button>
      </div>
      {asking && (
        <div onPointerDown={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  );
}
