import { useEffect, useState } from 'react';
import { assetUrl, worldAssets } from '../config/assets';
import { SEATS, displayName } from '../data/seats';
import { useMe, useSession } from '../state/RoomContext';
import type { SeatId } from '../state/types';
import { Avatar } from '../ui/Avatar';

const WALK = worldAssets.campfire.scenes?.walk;

/** 飛び石（絵の中の位置 %、手前から鳥居へ）と、その石の上での大きさ */
const STONES: [number, number, number][] = [
  [21.5, 83, 4.6], [22.5, 74.5, 3.8], [28.5, 68.6, 3.1], [32.5, 64.6, 2.6], [35.6, 62.4, 2.2],
  [38.6, 60.9, 1.9], [41.6, 59.9, 1.6], [44.4, 59.2, 1.4], [47.2, 58.6, 1.2],
];
const STEP_MS = 3200;

/** 行きつ戻りつ：0,1,…,8,7,…,1,0,… */
function stoneAt(step: number) {
  const n = STONES.length - 1;
  const k = step % (n * 2);
  return k <= n ? k : n * 2 - k;
}

const SEAT_OFFSET: Record<SeatId, number> = { host1: 0, host2: 5, guest1: 10, guest2: 14 };

/**
 * 灯籠祭の飛び石を、部屋にいるみんなの芽の妖精が歩く。
 * 一歩ずつぴょんと跳んで鳥居まで行き、また手前へもどってくる。
 * 時計で決めるので、全員の画面で同じ石の上にいる。
 */
export function StoneWalkers() {
  const participants = useSession((s) => s.participants);
  const me = useMe();
  const [step, setStep] = useState(() => Math.floor(Date.now() / STEP_MS));

  useEffect(() => {
    const tick = () => setStep(Math.floor(Date.now() / STEP_MS));
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  if (!WALK) return null;
  return (
    <>
      {SEATS.filter((s) => participants[s.seat]).map((s) => {
        const p = participants[s.seat]!;
        const i = stoneAt(step + SEAT_OFFSET[s.seat]);
        const prev = stoneAt(step + SEAT_OFFSET[s.seat] - 1);
        const [u, v, size] = STONES[i];
        const away = i > prev;
        return (
          <span
            key={s.seat}
            className={`stone-walker ${away ? 'is-away' : 'is-back'} ${s.seat === me.seat ? 'is-me' : ''}`}
            style={{ left: `${u}%`, top: `${v}%`, width: `${size}%`, zIndex: 20 - i }}
            aria-hidden
          >
            <span className="stone-walker__body" key={step}>
              <img src={assetUrl(WALK)} alt="" draggable={false} />
            </span>
            {size > 1.8 && (
              <span className="stone-walker__name">
                <Avatar value={p.avatar} className="stone-walker__face" />
                {displayName(p.name, s.seat)}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
