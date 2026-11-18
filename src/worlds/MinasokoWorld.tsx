import { useState } from 'react';
import { sound } from '../audio/sound';
import { worldAssets } from '../config/assets';
import { displayName } from '../data/seats';
import { CARRIER_LINES } from '../data/worldTopics';
import { drawTopic, keepsake } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import type { DrawnTopic } from '../state/types';
import { useSpeech } from '../ui/Speech';
import { WordPrompt } from '../ui/WordPrompt';
import { ImageWorld } from './ImageWorld';

const SCENES = worldAssets.minasoko.scenes ?? {};

const ENVELOPES = [
  { u: 0.36, v: 0.6, tilt: -12, seal: '#c0504d' },
  { u: 0.47, v: 0.63, tilt: 4, seal: '#4d7fc0' },
  { u: 0.58, v: 0.6, tilt: 14, seal: '#5aa06b' },
];

/** 水底郵便局：海の底の小さな郵便局。封筒を選ぶと、手紙のかたちの問いが届く */
export function MinasokoWorld() {
  const scene = useSession((s) => s.scenes.minasoko ?? 'entrance');
  const bottles = useSession((s) => s.bottles);
  const participants = useSession((s) => s.participants);
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const [letter, setLetter] = useState<DrawnTopic | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const carrier = useSpeech(CARRIER_LINES);
  const inside = scene === 'counter';

  useActionEffect((action) => {
    if (action.type === 'drawTopic' && action.drawn.source === 'letter') {
      setOpening(Number(action.drawn.extra ?? 0));
      sound.chime(1, undefined, 0.6);
      window.setTimeout(() => {
        setLetter(action.drawn);
        setOpening(null);
      }, 900);
    }
    if (action.type === 'setScene' && action.world === 'minasoko') sound.whoosh();
  });

  const go = (next: string) => dispatch({ type: 'setScene', world: 'minasoko', scene: next });

  const stage = inside ? (
    <>
      {ENVELOPES.map((e, i) => (
        <button
          key={i}
          className={`envelope ${opening === i ? 'is-opening' : ''}`}
          style={{ left: `${e.u * 100}%`, top: `${e.v * 100}%`, ['--tilt' as string]: `${e.tilt}deg`, ['--seal' as string]: e.seal, animationDelay: `${-i * 1.1}s` }}
          onClick={() => dispatch(drawTopic(store.getState(), me.seat, 'letter', undefined, String(i)))}
          aria-label={`${i + 1}通目の封筒をひらく`}
        >
          <span className="envelope__flap" />
          <span className="envelope__seal" />
        </button>
      ))}
      <button className="hotspot" style={{ left: '66%', top: '47%', width: '12%', height: '22%' }} onClick={carrier.say} aria-label="芽配達員に話しかける" />
      <button className="hotspot hotspot--hint" style={{ left: '6%', top: '42%', width: '10%', height: '40%' }} onClick={() => go('entrance')} aria-label="入口へ戻る">
        <span>入口へ</span>
      </button>
    </>
  ) : (
    <>
      <button className="hotspot hotspot--door" style={{ left: '60%', top: '50%', width: '18%', height: '36%' }} onClick={() => go('counter')} aria-label="郵便局に入る">
        <span>中へ入る</span>
      </button>
      <button className="hotspot" style={{ left: '44%', top: '74%', width: '14%', height: '30%' }} onClick={carrier.say} aria-label="芽配達員に話しかける" />
      <button className="hotspot" style={{ left: '84%', top: '74%', width: '10%', height: '26%' }} onClick={() => setAsking(true)} aria-label="ポストに手紙を預ける" />
    </>
  );

  return (
    <ImageWorld
      world="minasoko"
      kind="sea"
      key={scene}
      src={inside ? SCENES.counter : SCENES.entrance}
      aspect={inside ? 1536 / 1024 : 1402 / 1122}
      fallback="radial-gradient(circle at 60% 40%, #3b3a8a, #141238 55%, #060818)"
      stage={stage}
    >
      {carrier.line && (
        <p key={carrier.lineKey} className="npc-line npc-line--sea">
          <small>芽配達員</small>
          {carrier.line}
        </p>
      )}
      {letter && (
        <button className="letter" onClick={() => setLetter(null)} aria-label="手紙を閉じる">
          <small>水底から届いた問い</small>
          <span className="letter__text">{letter.topic.text}</span>
          <span className="letter__from">— {displayName(participants[letter.by]?.name, letter.by)}さんが選んだ封筒より</span>
        </button>
      )}
      {bottles.length > 0 && (
        <ul className="bottle-shelf" aria-label="預けられた手紙">
          {bottles.slice(-6).map((b) => (
            <li key={b.id} title={b.text || '（ことばのない手紙）'}>
              <span aria-hidden>🫙</span>
              <small>{b.text || '…'}</small>
            </li>
          ))}
        </ul>
      )}
      <p className={`world-hint ${letter ? 'is-hidden' : ''}`}>{inside ? '封筒を選ぶと、次の問いが届きます。' : '扉に触れると、郵便局の中へ。配達員さんにも話しかけてみて。'}</p>
      <button className="world-action world-action--sea" onClick={() => setAsking(true)}>
        <span aria-hidden>✉️</span> ことばを預ける
      </button>
      {asking && (
        <WordPrompt
          title="水底郵便局に、ことばを預ける"
          placeholder="今日の対話で残しておきたいひとこと"
          submitLabel="瓶に入れて預ける"
          allowEmpty
          onCancel={() => setAsking(false)}
          onSubmit={(text) => {
            dispatch({ type: 'keepBottle', bottle: keepsake(me.seat, text) });
            sound.chime(2, undefined, 0.5);
            setAsking(false);
          }}
        />
      )}
    </ImageWorld>
  );
}
