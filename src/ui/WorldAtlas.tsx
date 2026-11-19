import { useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { assetUrl, worldAssets } from '../config/assets';
import { workLink } from '../config/links';
import { ATLAS, MAP_IMAGE, MAP_LABELS, MAP_SPOTS, SPOT_OFFSET, type AtlasRegion } from '../data/atlas';
import { WORLDS } from '../data/worlds';
import { seeded } from '../engine/Scene';
import { useDispatch, useMe, useSession } from '../state/RoomContext';
import { Avatar } from './Avatar';
import type { WorldId } from '../state/types';

const W = 1600;
const H = 1000;
const HUB = ATLAS[0];

/** ふちが揺らいだ島のかたち */
function islandPath(r: AtlasRegion, seed: number) {
  const rnd = seeded(seed);
  const n = 14;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.82 + rnd() * 0.3;
    return [r.x + Math.cos(a) * r.r * k * 1.15, r.y + Math.sin(a) * r.r * k * 0.72] as const;
  });
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    const mx = (x + nx) / 2;
    const my = (y + ny) / 2;
    d += i === 0 ? `M${(pts[n - 1][0] + x) / 2},${(pts[n - 1][1] + y) / 2} ` : '';
    d += `Q${x},${y} ${mx},${my} `;
  }
  return d + 'Z';
}

function spotOf(region: AtlasRegion, world: WorldId, painted = false) {
  const onMap = painted ? MAP_SPOTS[world] : undefined;
  if (onMap) return { x: onMap[0], y: onMap[1] };
  const [dx, dy] = SPOT_OFFSET[world] ?? [0, 0];
  return { x: region.x + dx, y: region.y + dy };
}

/** エリアの目印になる小さな絵 */
function Landmark({ id }: { id: string }) {
  switch (id) {
    case 'tree':
      return (
        <g>
          <path d="M-14 40 C-10 10 -12 -10 -6 -30 L6 -30 C12 -10 10 10 14 40 Z" fill="#3a2618" />
          {[[-40, -50, 46], [30, -60, 50], [0, -95, 52], [-55, -90, 36], [55, -100, 34], [0, -40, 40]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? '#2f7a50' : '#4c9a6b'} />
          ))}
          {[[-30, -80], [25, -95], [0, -60], [45, -55], [-50, -50]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#fff3b0" className="atlas-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>
      );
    case 'wa':
      return (
        <g>
          <rect x="-46" y="-56" width="92" height="9" rx="3" fill="#d2453a" />
          <rect x="-38" y="-42" width="76" height="6" fill="#d2453a" />
          <rect x="-34" y="-50" width="8" height="70" fill="#b83a30" />
          <rect x="26" y="-50" width="8" height="70" fill="#b83a30" />
          <ellipse cx="0" cy="22" rx="70" ry="8" fill="rgba(255,200,140,.25)" className="atlas-glow-soft" />
        </g>
      );
    case 'moon':
      return (
        <g>
          <circle cx="0" cy="-30" r="44" fill="#f2efd8" />
          <circle cx="18" cy="-40" r="40" fill="#2a2856" />
          {[[-60, -60], [50, 10], [70, -70]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 1} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 1} Z`} fill="#fff6c8" className="atlas-twinkle" />
          ))}
        </g>
      );
    case 'town':
      return (
        <g>
          <rect x="-16" y="-90" width="32" height="110" fill="#5a4a7a" />
          <path d="M-22 -90 L0 -125 L22 -90 Z" fill="#3e5a6a" />
          <circle cx="0" cy="-62" r="12" fill="#f2e6c8" />
          <line x1="0" y1="-62" x2="0" y2="-71" stroke="#333" strokeWidth="2" className="atlas-hand" />
          <rect x="-60" y="-30" width="34" height="50" fill="#4a3c66" />
          <rect x="30" y="-40" width="38" height="60" fill="#4a3c66" />
          <rect x="-52" y="-18" width="7" height="9" fill="#ffd27a" />
          <rect x="40" y="-28" width="7" height="9" fill="#ffd27a" />
        </g>
      );
    case 'water':
      return (
        <g>
          <path d="M-40 10 L-40 -40 Q0 -80 40 -40 L40 10 Z" fill="#3a3466" />
          <path d="M-14 10 L-14 -22 Q0 -36 14 -22 L14 10 Z" fill="#ffcf7a" />
          <rect x="52" y="-26" width="16" height="36" rx="4" fill="#c0392b" />
          {[[-70, -40], [-56, -70], [70, -70], [60, -100]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4 + (i % 2) * 3} fill="none" stroke="#bfe6ff" className="atlas-bubble" style={{ animationDelay: `${i * 0.7}s` }} />
          ))}
        </g>
      );
    case 'bbq':
      return (
        <g>
          <ellipse cx="0" cy="0" rx="42" ry="14" fill="#2a1a12" />
          <ellipse cx="0" cy="-4" rx="36" ry="10" fill="#ff8a3a" className="atlas-glow" />
          <rect x="-4" y="6" width="8" height="26" fill="#2a1a12" />
          {[-14, 0, 14].map((x, i) => (
            <path key={x} d={`M${x} -20 q 8 -12 0 -24 q -8 -12 0 -24`} stroke="rgba(230,220,240,.5)" fill="none" strokeWidth="4" className="atlas-smoke" style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </g>
      );
  }
  return null;
}

/**
 * メイプルストーリーの地図のような、世界の全体図。
 * エリアに触れると詳しく見られ、ホストは「ここへ行く」で全員を連れて移動できる。
 */
export function WorldAtlas({ onClose }: { onClose: () => void }) {
  const world = useSession((s) => s.world);
  const visited = useSession((s) => s.visited);
  const participants = useSession((s) => s.participants);
  const dispatch = useDispatch();
  const me = useMe();
  const canTravel = me.role === 'host';
  const [selected, setSelected] = useState<WorldId | string | null>(null);
  const paths = useMemo(() => ATLAS.map((r, i) => islandPath(r, i * 7 + 3)), []);
  const partyRef = useRef<HTMLDivElement>(null);

  // 小さな画面では地図がはみ出すので、いまいる場所が見えるようにスクロールしておく
  useEffect(() => {
    partyRef.current?.scrollIntoView({ block: 'center', inline: 'center' });
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const here = ATLAS.find((r) => r.worlds.includes(world)) ?? HUB;
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setPainted(true);
    img.src = assetUrl(MAP_IMAGE);
  }, []);
  const herePos = spotOf(here, world, painted);
  const sel = typeof selected === 'string' && selected in WORLDS ? WORLDS[selected as WorldId] : null;
  const selRegion = ATLAS.find((r) => r.id === selected || (sel && r.worlds.includes(sel.id)));

  const go = (id: WorldId) => {
    dispatch({ type: 'travel', world: id, at: Date.now() });
    onClose();
  };

  return (
    <div className="atlas" role="dialog" aria-modal="true" aria-label="世界地図">
      <header className="atlas__head">
        <h2>世界地図</h2>
        <p>{canTravel ? '行きたい場所に触れて、みんなで出かけよう。' : '気になる場所に触れてみて。移動はホストが案内します。'}</p>
        <button className="icon-btn" onClick={onClose} aria-label="地図を閉じる">
          ×
        </button>
      </header>
      <div className="atlas__scroll">
        <div className={`atlas__map ${painted ? 'is-painted' : ''}`}>
          {painted && (
            <div className="atlas__painting" aria-hidden>
              <img src={assetUrl(MAP_IMAGE)} alt="" draggable={false} />
              <span className="atlas__sparkle" />
            </div>
          )}
          {!painted && <svg viewBox={`0 0 ${W} ${H}`} className="atlas__svg" aria-hidden>
            <defs>
              <radialGradient id="atlas-sea" cx="50%" cy="50%" r="70%">
                <stop offset="0" stopColor="#1b2350" />
                <stop offset="1" stopColor="#070a1c" />
              </radialGradient>
              <pattern id="atlas-wave" width="60" height="30" patternUnits="userSpaceOnUse">
                <path d="M0 15 Q15 5 30 15 T60 15" fill="none" stroke="rgba(160,190,255,.08)" strokeWidth="2" />
              </pattern>
              {ATLAS.map((r) => (
                <radialGradient key={r.id} id={`atlas-g-${r.id}`} cx="45%" cy="35%" r="75%">
                  <stop offset="0" stopColor={r.color[0]} />
                  <stop offset="1" stopColor={r.color[1]} />
                </radialGradient>
              ))}
              <filter id="atlas-fog">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <rect width={W} height={H} fill="url(#atlas-sea)" />
            <rect width={W} height={H} fill="url(#atlas-wave)" className="atlas-waves" />
            {/* 樹のエリアから各地へのびる道 */}
            {ATLAS.slice(1).map((r) => (
              <path
                key={r.id}
                d={`M${HUB.x},${HUB.y} Q${(HUB.x + r.x) / 2 + (r.y - HUB.y) * 0.15},${(HUB.y + r.y) / 2 - (r.x - HUB.x) * 0.1} ${r.x},${r.y}`}
                fill="none"
                stroke={r.comingSoon ? 'rgba(255,255,255,.12)' : 'rgba(255,226,170,.45)'}
                strokeWidth="5"
                strokeDasharray="2 16"
                strokeLinecap="round"
                className="atlas-road"
              />
            ))}
            {ATLAS.map((r, i) => (
              <g key={r.id} className={`atlas-island ${r.comingSoon ? 'is-locked' : ''} ${selRegion?.id === r.id ? 'is-selected' : ''}`}>
                <path d={paths[i]} fill="rgba(0,0,0,.45)" transform="translate(0 18)" />
                <path d={paths[i]} fill={`url(#atlas-g-${r.id})`} stroke="rgba(255,240,210,.35)" strokeWidth="3" />
                <g transform={`translate(${r.x} ${r.y + 6}) scale(1.45)`}>
                  <Landmark id={r.id} />
                </g>
                {r.comingSoon && <path d={paths[i]} fill="rgba(180,180,220,.35)" filter="url(#atlas-fog)" className="atlas-mist" />}
              </g>
            ))}
          </svg>}

          {ATLAS.map((r) => (
            <span
              key={r.id}
              className="atlas__region-name"
              style={
                painted && MAP_LABELS[r.id]
                  ? { left: `${(MAP_LABELS[r.id][0] / W) * 100}%`, top: `${(MAP_LABELS[r.id][1] / H) * 100}%` }
                  : { left: `${(r.x / W) * 100}%`, top: `${((r.y + r.r * 0.72) / H) * 100}%` }
              }
            >
              {r.name}
              <small>{r.note}</small>
            </span>
          ))}

          {ATLAS.flatMap((r) =>
            r.worlds.length === 0
              ? [
                  <button
                    key={r.id}
                    className={`atlas__spot is-locked ${selected === r.id ? 'is-selected' : ''}`}
                    style={{ left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%` }}
                    onClick={() => setSelected(r.id)}
                  >
                    <span className="atlas__pin" aria-hidden>
                      <i>?</i>
                    </span>
                    <span className="atlas__label">準備中</span>
                  </button>,
                ]
              : r.worlds.map((id) => {
                  const p = spotOf(r, id, painted);
                  const been = visited.some((v) => v.world === id);
                  return (
                    <button
                      key={id}
                      className={`atlas__spot ${id === world ? 'is-here' : ''} ${selected === id ? 'is-selected' : ''}`}
                      style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, ['--accent' as string]: WORLDS[id].accent }}
                      onClick={() => {
                        setSelected(id);
                        sound.pop(1.2);
                      }}
                      onDoubleClick={() => canTravel && id !== world && go(id)}
                    >
                      <span className="atlas__pin" aria-hidden>
                        <i>{been ? '✓' : ''}</i>
                      </span>
                      <span className="atlas__label">{WORLDS[id].name}</span>
                    </button>
                  );
                }),
          )}

          <div ref={partyRef} className="atlas__party" style={{ left: `${(herePos.x / W) * 100}%`, top: `${(herePos.y / H) * 100}%` }} aria-label="みんなの現在地">
            <span className="atlas__party-faces">
              {Object.values(participants).map((p) => (
                <Avatar key={p!.seat} value={p!.avatar} />
              ))}
            </span>
            <small>いまここ</small>
          </div>
        </div>
      </div>

      {(sel || selRegion?.comingSoon) && (
        <aside className="atlas__detail" key={String(selected)}>
          {sel ? (
            <>
              {worldAssets[sel.id].thumb && <img src={assetUrl(worldAssets[sel.id].thumb!)} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <small>
                {selRegion?.name}・{selRegion?.note}
              </small>
              <h3>
                {sel.name}
                <span>{sel.subtitle}</span>
              </h3>
              <p>{sel.description}</p>
              {sel.id === world ? (
                <em>いまここにいます</em>
              ) : canTravel ? (
                <button className="btn btn--primary" onClick={() => go(sel.id)}>
                  みんなで行く
                </button>
              ) : (
                <em>行きたいときは、声でホストに伝えてみて</em>
              )}
              {workLink(sel.id) && (
                <a className="work-link" href={workLink(sel.id)!.url} target="_blank" rel="noreferrer">
                  {workLink(sel.id)!.label} ↗
                </a>
              )}
            </>
          ) : (
            <>
              <small>
                {selRegion?.name}・{selRegion?.note}
              </small>
              <h3>霧の向こう</h3>
              <p>{selRegion?.comingSoon}</p>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
