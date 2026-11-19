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
  const [toast, setToast] = useState(0);
  const playCool = useRef(0);
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
      // 焚き火あそび（だれの芽の子がするかは value に席の番号）
      const seat = SEATS[action.value ?? 0]?.seat;
      if (seat && (action.fx === 'marshmallow' || action.fx === 'marshmallow-burn' || action.fx === 'sparkler')) {
        const pos = seats[seat];
        const hu = (pos.u + (pos.flip ? 2.2 : -2.2)) / 100;
        const hv = (pos.v - 4) / 100;
        if (action.fx === 'sparkler') {
          scene.sparkler(hu, hv - 0.02);
          sound.sample('campfire', 'fire', 0.3);
        } else {
          scene.marshmallow(hu, hv, action.fx === 'marshmallow-burn');
          sound.sample('campfire', 'tap', 0.4);
        }
        setHops((h) => ({ ...h, [seat]: Date.now() }));
      }
      if (action.fx === 'toast') {
        setToast(Date.now());
        sound.chime(2, undefined, 0.6);
        window.setTimeout(() => sound.chime(3, undefined, 0.5), 700);
        window.setTimeout(() => sound.chime(1, undefined, 0.4), 760);
        scene.pop();
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
      sound.reaction(r);
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

        {/* 乾杯：みんなの芽の子がマグを掲げる */}
        {toast > 0 &&
          SEATS.filter((s) => participants[s.seat]).map((s) => {
            const pos = seats[s.seat];
            return (
              <span key={`${s.seat}-${toast}`} className={`toast-mug ${pos.flip ? 'is-left' : 'is-right'}`} style={{ left: `${pos.u + (pos.flip ? 2.5 : -2.5)}%`, top: `${pos.v - 15}%` }} aria-hidden>
                <MugIcon />
                <i className="toast-mug__fizz" />
              </span>
            );
          })}
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
      {/* 焚き火あそび：文字ではなく、道具の絵だけ */}
      <div className="campfire-play" onPointerDown={(e) => e.stopPropagation()}>
        {(
          [
            ['marshmallow', 'マシュマロを焼く', <MarshmallowIcon key="m" />],
            ['sparkler', '手持ち花火', <SparklerIcon key="s" />],
            ['toast', 'みんなで乾杯', <MugIcon key="t" />],
          ] as const
        ).map(([kind, label, icon]) => (
          <button
            key={kind}
            className="campfire-play__item"
            aria-label={label}
            title={label}
            onClick={() => {
              const now = Date.now();
              if (now - playCool.current < 1500) return;
              playCool.current = now;
              const seatNo = SEATS.findIndex((s) => s.seat === me.seat);
              if (kind === 'marshmallow') dispatch({ type: 'fx', world: 'campfire', fx: Math.random() < 0.3 ? 'marshmallow-burn' : 'marshmallow', value: seatNo });
              else if (kind === 'sparkler') dispatch({ type: 'fx', world: 'campfire', fx: 'sparkler', value: seatNo });
              else dispatch({ type: 'fx', world: 'campfire', fx: 'toast' });
            }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarshmallowIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden>
      <line x1="6" y1="34" x2="26" y2="14" stroke="#8a5a32" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="20" y="5" width="14" height="13" rx="4" transform="rotate(-45 27 11.5)" fill="#fff6e6" stroke="#e8c79a" strokeWidth="1.2" />
      <rect x="26" y="9" width="5" height="4" rx="1.5" transform="rotate(-45 27 11.5)" fill="#f2c27a" opacity=".8" />
    </svg>
  );
}

function SparklerIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden>
      <line x1="10" y1="36" x2="22" y2="16" stroke="#8a8080" strokeWidth="2" strokeLinecap="round" />
      <g stroke="#ffd98a" strokeWidth="1.6" strokeLinecap="round">
        <line x1="23" y1="14" x2="33" y2="6" />
        <line x1="23" y1="14" x2="35" y2="16" />
        <line x1="23" y1="14" x2="27" y2="3" />
        <line x1="23" y1="14" x2="15" y2="6" />
        <line x1="23" y1="14" x2="31" y2="24" />
      </g>
      <circle cx="23" cy="14" r="3.2" fill="#fff4cf" />
    </svg>
  );
}

function MugIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden>
      <path d="M9 12 h18 v18 a4 4 0 0 1 -4 4 h-10 a4 4 0 0 1 -4 -4 z" fill="#c98a3c" stroke="#7a4a1c" strokeWidth="1.4" />
      <path d="M27 16 h4 a4 4 0 0 1 0 8 h-4" fill="none" stroke="#7a4a1c" strokeWidth="2.4" />
      <path d="M8 13 q3 -6 7 -3 q3 -5 7 -1 q4 -3 6 3 z" fill="#fffaf0" />
      <rect x="12" y="17" width="3" height="12" rx="1.5" fill="#f2c27a" opacity=".7" />
    </svg>
  );
}
