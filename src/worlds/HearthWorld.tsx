import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sound } from '../audio/sound';
import { assetUrl, worldAssets } from '../config/assets';
import { REACTION_BY_ID } from '../data/reactions';
import { SEATS, displayName } from '../data/seats';
import { useActionEffect, useDispatch, useMe, useOnline, useSession } from '../state/RoomContext';
import type { ReactionEvent, SeatId } from '../state/types';
import { pick } from '../state/util';
import { Avatar } from '../ui/Avatar';
import { ReactionIcon } from '../ui/ReactionIcon';
import { useVoice } from '../voice/VoiceContext';
import { CoverStage } from './CoverStage';
import { HEARTH_ASPECT, HearthScene } from './HearthScene';

const IMG = worldAssets.campfire.scenes ?? {};

/** 焚き火を囲む席（絵の中の位置 %）。左側の子は火のほうを向くように左右反転 */
type Pos = { u: number; v: number; flip?: boolean };
const SEAT_POS: Record<SeatId, Pos> = {
  host1: { u: 36, v: 69, flip: true },
  host2: { u: 67, v: 69 },
  guest1: { u: 41.5, v: 81, flip: true },
  guest2: { u: 61.5, v: 81 },
};
/** 縦長の画面では絵の左右が切れるので、焚き火のそばに寄せる */
const SEAT_POS_NARROW: Record<SeatId, Pos> = {
  host1: { u: 43.5, v: 66, flip: true },
  host2: { u: 59.5, v: 66 },
  guest1: { u: 45, v: 80, flip: true },
  guest2: { u: 58, v: 80 },
};
const NPC_POS = { sleep: { u: 86, v: 78 }, peek: { u: 9, v: 62 } };
const NPC_POS_NARROW = { sleep: { u: 60, v: 92 }, peek: { u: 40, v: 58 } };

function useNarrow() {
  const query = '(max-aspect-ratio: 1/1)';
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

const COMBO_MS = 1400;
const AMBIENT_EVENTS = ['walker', 'pop', 'gust', 'swarm', 'star', 'lanterns', 'peek', 'pop', 'swarm'] as const;

/**
 * 樹の下の焚き火（集合場所）。ナゴリの樹の「森の広場」の絵に、炎・火の粉・ほたる・芽の子たちを重ねる。
 * 説明は置かず、触れたところで何かが起きるようにする。
 */
export function HearthWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HearthScene | null>(null);
  const dispatch = useDispatch();
  const me = useMe();
  const participants = useSession((s) => s.participants);
  const reactions = useSession((s) => s.reactions);
  const queue = useSession((s) => s.speakQueue);
  const online = useOnline();
  const { speaking } = useVoice();
  const combo = useRef({ n: 0, at: 0 });
  const [walker, setWalker] = useState<{ key: number; dir: 1 | -1 } | null>(null);
  const [peek, setPeek] = useState(0);
  const [sleeperAwake, setSleeperAwake] = useState(false);
  const [hops, setHops] = useState<Partial<Record<SeatId, number>>>({});
  const [now, setNow] = useState(Date.now());
  const narrow = useNarrow();
  const seats = narrow ? SEAT_POS_NARROW : SEAT_POS;
  const npc = narrow ? NPC_POS_NARROW : NPC_POS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = new HearthScene(canvas);
    s.start();
    sceneRef.current = s;
    return () => s.destroy();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ぼんやり眺めているだけでも、ときどき何かが起きる
  useEffect(() => {
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        const scene = sceneRef.current;
        const ev = pick(AMBIENT_EVENTS);
        if (ev === 'walker') setWalker({ key: Date.now(), dir: Math.random() > 0.5 ? 1 : -1 });
        if (ev === 'peek') setPeek((p) => p + 1);
        if (ev === 'pop') {
          scene?.pop();
          sound.sample('campfire', 'fire', 0.35);
        }
        if (ev === 'gust') scene?.gust();
        if (ev === 'swarm') scene?.swarmAt();
        if (ev === 'star') scene?.shootingStar();
        if (ev === 'lanterns') scene?.lanternWave();
        next();
      }, 7000 + Math.random() * 9000);
    };
    next();
    return () => window.clearTimeout(timer);
  }, []);

  // みんなの画面で同じ演出を起こす
  useActionEffect((action) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (action.type === 'fx' && action.world === 'campfire') {
      if (action.fx === 'poke') {
        scene.poke(action.value ?? 0);
        sound.sample('campfire', 'fire', Math.min(1, 0.5 + (action.value ?? 0) * 0.1)) || sound.pop(0.7);
      }
      if (action.fx.startsWith('lantern')) {
        scene.lantern(action.value ?? 0);
        sound.chime((action.value ?? 0) % 4, undefined, 0.5);
      }
    }
    if (action.type === 'drawTopic' && action.drawn.world === 'campfire') {
      scene.spiral();
      sound.sample('campfire', 'insight', 0.6) || sound.bell();
    }
    if (action.type === 'react' && action.event.world === 'campfire') {
      const r = action.event.reaction;
      scene.reaction(r);
      setHops((h) => ({ ...h, [action.event.seat]: Date.now() }));
      const played =
        r === 'empathy' ? sound.sample('campfire', 'bond', 0.6)
        : r === 'more' ? sound.sample('campfire', 'insight', 0.5)
        : r === 'other' ? sound.sample('campfire', 'fog', 0.6)
        : sound.sample('campfire', 'fire', 0.7);
      if (!played) sound.pop(r === 'speak' ? 1.3 : 1);
    }
  });

  const onPointer = (e: React.PointerEvent, kind: 'move' | 'down') => {
    const scene = sceneRef.current;
    const root = rootRef.current;
    if (!scene || !root) return;
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = scene.pointer(x, y, kind);
    if (kind !== 'down' || !hit) return;
    if (hit === 'fire') {
      const t = Date.now();
      combo.current.n = t - combo.current.at < COMBO_MS ? combo.current.n + 1 : 0;
      combo.current.at = t;
      dispatch({ type: 'fx', world: 'campfire', fx: 'poke', value: Math.min(combo.current.n, 6) });
    } else if (hit.startsWith('lantern:')) {
      dispatch({ type: 'fx', world: 'campfire', fx: 'lantern', value: Number(hit.split(':')[1]) });
    } else if (hit === 'sky') {
      scene.shootingStar(x, y);
      sound.chime(3, undefined, 0.3);
    } else {
      scene.ripple(x, y);
      sound.sample('campfire', 'tap', 0.4);
    }
  };

  const lastOf = (seat: SeatId): ReactionEvent | undefined => {
    for (let i = reactions.length - 1; i >= 0; i--) if (reactions[i].seat === seat) return reactions[i];
    return undefined;
  };

  return (
    <div
      ref={rootRef}
      className="world world--campfire hearth"
      onPointerMove={(e) => onPointer(e, 'move')}
      onPointerDown={(e) => onPointer(e, 'down')}
    >
      <CoverStage src={IMG.hiroba} aspect={HEARTH_ASPECT} fallback="radial-gradient(circle at 50% 65%, #6b4020, #1a1424 55%, #07060c)" className="hearth__stage">
        {/* 焚き火を囲む、みんなの芽の子 */}
        {SEATS.filter((s) => participants[s.seat]).map((s) => {
          const p = participants[s.seat]!;
          const pos = seats[s.seat];
          const last = lastOf(s.seat);
          const bubble = last && now - last.at < 4500 ? REACTION_BY_ID[last.reaction] : null;
          const waiting = queue.some((q) => q.seat === s.seat);
          return (
            <button
              key={s.seat}
              className={`sprout-seat ${speaking.includes(s.seat) ? 'is-speaking' : ''} ${narrow ? 'is-narrow' : ''} ${online.includes(s.seat) ? '' : 'is-away'} ${waiting ? 'is-waiting' : ''} ${s.seat === me.seat ? 'is-me' : ''}`}
              style={{ left: `${pos.u}%`, top: `${pos.v}%` } as CSSProperties}
              onPointerDown={(e) => {
                e.stopPropagation();
                setHops((h) => ({ ...h, [s.seat]: Date.now() }));
                sound.sample('campfire', 'tap', 0.5);
              }}
              aria-label={displayName(p.name, s.seat)}
            >
              <span className="sprout-seat__body" key={hops[s.seat] ?? 0}>
                {IMG.sit ? <img src={assetUrl(IMG.sit)} alt="" draggable={false} style={{ transform: pos.flip ? 'scaleX(-1)' : undefined }} /> : <i>🌱</i>}
              </span>
              <span className="sprout-seat__name">
                <Avatar value={p.avatar} className="sprout-seat__face" />
                {displayName(p.name, s.seat)}
              </span>
              {waiting && <span className="sprout-seat__hand">✋</span>}
              {bubble && (
                <span key={last!.id} className="sprout-seat__bubble" style={{ ['--c' as string]: bubble.color }}>
                  <ReactionIcon reaction={last!.reaction} world="campfire" />
                </span>
              )}
            </button>
          );
        })}

        {/* 根もとで眠る子 */}
        {IMG.sleep && (
          <button
            className={`sprout-npc sprout-npc--sleep ${sleeperAwake ? 'is-awake' : ''}`}
            style={{ left: `${npc.sleep.u}%`, top: `${npc.sleep.v}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSleeperAwake(true);
              sound.sample('campfire', 'tap', 0.5);
              window.setTimeout(() => setSleeperAwake(false), 2600);
            }}
            aria-label="眠っている芽の子"
          >
            <img src={assetUrl(sleeperAwake && IMG.peek ? IMG.peek : IMG.sleep)} alt="" draggable={false} />
            {!sleeperAwake && (
              <span className="zzz" aria-hidden>
                <i>z</i>
                <i>z</i>
                <i>Z</i>
              </span>
            )}
            {sleeperAwake && <span className="sprout-npc__mark">!</span>}
          </button>
        )}

        {/* 木の陰からのぞく子 */}
        {IMG.peek && (
          <button
            key={peek}
            className="sprout-npc sprout-npc--peek"
            style={{ left: `${npc.peek.u}%`, top: `${npc.peek.v}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setPeek((p) => p + 1);
              sound.pop(1.6);
            }}
            aria-label="木の陰の芽の子"
          >
            <img src={assetUrl(IMG.peek)} alt="" draggable={false} />
          </button>
        )}

        {/* ときどき通りかかる子 */}
        {walker && IMG.walk && (
          <span
            key={walker.key}
            className={`sprout-walker ${walker.dir < 0 ? 'is-left' : ''}`}
            style={{ top: '87%' }}
            onAnimationEnd={() => setWalker(null)}
            aria-hidden
          >
            <img src={assetUrl(IMG.walk)} alt="" draggable={false} />
          </span>
        )}
      </CoverStage>
      <canvas ref={canvasRef} className="world__canvas world__canvas--fx" />
    </div>
  );
}
