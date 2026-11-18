import { useEffect, useState } from 'react';
import { sound } from '../audio/sound';
import { useScene } from '../engine/useScene';
import { drawTopic, keepsake } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import type { DrawnTopic } from '../state/types';
import { WordPrompt } from '../ui/WordPrompt';
import { LanternScene } from './LanternScene';
import { WorldLayers, drawsBackdrop } from './WorldLayers';
import { useReactionEffects } from './useReactionEffects';

const FURIN = [
  { glass: '#7fd4ff', paper: '#ffe2a8', pattern: '金魚' },
  { glass: '#ff9db8', paper: '#cfe9ff', pattern: '朝顔' },
  { glass: '#b7f0c8', paper: '#ffd0d0', pattern: '花火' },
];

const CHOCHIN = 11;

export function LanternWorld() {
  const { canvasRef, scene } = useScene((c) => new LanternScene(c), { backdrop: drawsBackdrop('lantern') });
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
    scene?.syncLanterns(lanterns);
  }, [scene, lanterns]);

  // 誰かが風鈴・おみくじを鳴らしたら、全員の画面で揺らす
  useActionEffect((action) => {
    if (action.type !== 'drawTopic' || action.drawn.world !== 'lantern') return;
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
  });

  const ring = (i: number) => {
    const state = store.getState();
    dispatch(drawTopic(state, me.seat, 'furin', undefined, String(i)));
  };

  return (
    <WorldLayers world="lantern" canvasRef={canvasRef}>
      <svg className="chochin" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
        <path d="M-10 18 Q 500 110 1010 18" fill="none" stroke="rgba(30,15,20,.9)" strokeWidth="2" />
      </svg>
      <div className="chochin-row" aria-hidden>
        {Array.from({ length: CHOCHIN }, (_, i) => {
          const x = (i + 0.5) / CHOCHIN;
          const sag = Math.sin(x * Math.PI) * 76;
          return (
            <span
              key={i}
              className="chochin__lamp"
              style={{ left: `${x * 100}%`, top: `${8 + sag * 0.9}px`, animationDelay: `${-i * 0.37}s` }}
            />
          );
        })}
      </div>

      <div className="furin-eave">
        {FURIN.map((f, i) => (
          <button
            key={i}
            className={`furin ${ringing === i ? 'is-ringing' : ''}`}
            style={{ ['--glass' as string]: f.glass, ['--paper' as string]: f.paper, animationDelay: `${-i * 1.3}s` }}
            onClick={() => ring(i)}
            aria-label={`風鈴（${f.pattern}）を鳴らしてお題を引く`}
          >
            <span className="furin__string" />
            <span className="furin__bell" />
            <span className="furin__tanzaku">{f.pattern}</span>
          </button>
        ))}
        <p className="furin-eave__label">風鈴を鳴らすと、お題が届きます</p>
      </div>

      <div className="omikuji">
        <button
          className={`omikuji__box ${shaking ? 'is-shaking' : ''}`}
          onClick={() => dispatch(drawTopic(store.getState(), me.seat, 'omikuji'))}
          disabled={shaking}
          aria-label="おみくじを引く"
        >
          <span className="omikuji__stick" />
          <span className="omikuji__label">おみくじ</span>
        </button>
        {slip && (
          <button className="omikuji__slip" onClick={() => setSlip(null)} aria-label="おみくじを閉じる">
            <span className="omikuji__fortune">{slip.extra}</span>
            <span className="omikuji__q">{slip.topic.text}</span>
            <small>このお題で話す（閉じる）</small>
          </button>
        )}
      </div>

      <button className="world-action world-action--lantern" onClick={() => setAsking(true)}>
        <span aria-hidden>🏮</span> 灯籠を流す
      </button>
      {asking && (
        <WordPrompt
          title="灯籠に、ひとことを"
          placeholder="今日持ってきた作品・いま感じていること（なくても流せます）"
          submitLabel="そっと流す"
          allowEmpty
          onCancel={() => setAsking(false)}
          onSubmit={(text) => {
            dispatch({ type: 'floatLantern', lantern: keepsake(me.seat, text) });
            sound.chime(0, undefined, 0.5);
            setAsking(false);
          }}
        />
      )}
      <p className="world-hint world-hint--top">夜空に触れると、花火が上がります</p>
    </WorldLayers>
  );
}
