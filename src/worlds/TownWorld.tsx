import { useState } from 'react';
import { sound } from '../audio/sound';
import { worldAssets } from '../config/assets';
import { displayName } from '../data/seats';
import { drawTopic, keepsake } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import { WordPrompt } from '../ui/WordPrompt';
import type { AmbientScene } from './AmbientScene';
import { ImageWorld } from './ImageWorld';

const SCENES = worldAssets.town.scenes ?? {};
/** これだけ「好き」が集まると、町の色がすっかり戻る */
const FULL = 10;

/** やりたいことが消えた町：対話で出た「好き」とリアクションで、灰色の町に色が戻っていく（演出だけ。問いは共通の山札） */
export function TownWorld() {
  const scraps = useSession((s) => s.scraps);
  const reactions = useSession((s) => s.reactionCount.town);
  const participants = useSession((s) => s.participants);
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const [rewinding, setRewinding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [openScrap, setOpenScrap] = useState<string | null>(null);
  const [scene, setScene] = useState<AmbientScene | null>(null);

  const color = Math.min(1, (scraps.length * 2 + reactions) / FULL);

  useActionEffect((action) => {
    if (action.type === 'drawTopic' && action.drawn.source === 'clock') {
      setRewinding(true);
      sound.whoosh();
      window.setTimeout(() => setRewinding(false), 2200);
    }
    if (action.type === 'addScrap') {
      scene?.burst(action.scrap.x * 0.8 + 0.1, 0.62 + action.scrap.y * 0.25, 45, 50);
      sound.chime(3, undefined, 0.6);
    }
  });

  const stage = (
    <>
      <button
        className={`clock-face ${rewinding ? 'is-rewinding' : ''}`}
        style={{ left: '42%', top: '20%' }}
        onClick={() => dispatch(drawTopic(store.getState(), me.seat, 'clock'))}
        aria-label="時計塔に触れて、次の問いを引く"
      >
        <span className="clock-face__hand clock-face__hand--long" />
        <span className="clock-face__hand clock-face__hand--short" />
      </button>
      {scraps.map((s) => (
        <button
          key={s.id}
          className={`scrap ${openScrap === s.id ? 'is-open' : ''}`}
          style={{ left: `${10 + s.x * 80}%`, top: `${62 + s.y * 25}%`, ['--tilt' as string]: `${(s.x - 0.5) * 30}deg` }}
          onClick={() => setOpenScrap(openScrap === s.id ? null : s.id)}
          aria-label={`持ち寄った好き：${s.text}`}
        >
          <span className="scrap__tag" aria-hidden />
          <span className="scrap__text">
            {s.text}
            <small>— {displayName(participants[s.seat]?.name, s.seat)}</small>
          </span>
        </button>
      ))}
    </>
  );

  return (
    <ImageWorld
      world="town"
      kind="town"
      src={SCENES.plaza}
      aspect={1672 / 941}
      fallback="radial-gradient(circle at 42% 30%, #6a5a9a, #2a2244 55%, #0e0a1c)"
      stageClass="town-stage"
      stage={stage}
      onScene={setScene}
    >
      <style>{`.town-stage .cover__img{filter:saturate(${0.15 + color * 0.95}) brightness(${0.72 + color * 0.3}) contrast(${0.9 + color * 0.1})}`}</style>
      <p className={`town-banner ${color >= 1 ? 'is-restored' : ''}`}>
        {color >= 1 ? '町に、色が戻ってきた。' : 'この町は、まだ色をなくしている。'}
        <span className="town-banner__meter" style={{ width: `${color * 100}%` }} />
      </p>
      <p className="world-hint">時計塔に触れると次の問いが。「好き」やリアクションが集まるほど、町に色が戻ります。</p>
      <button className="world-action world-action--town" onClick={() => setAsking(true)}>
        <span aria-hidden>📜</span> 「好き」を持ち寄る
      </button>
      {asking && (
        <WordPrompt
          title="町に「好き」を置く"
          placeholder="今日持ってきた好きなもの（作品・キャラ・曲など）"
          submitLabel="町に置く"
          onCancel={() => setAsking(false)}
          onSubmit={(text) => {
            dispatch({ type: 'addScrap', scrap: keepsake(me.seat, text) });
            setAsking(false);
          }}
        />
      )}
    </ImageWorld>
  );
}
