import { useMemo, useState } from 'react';
import { sound } from '../audio/sound';
import { assetUrl, worldAssets } from '../config/assets';
import { BBQ_GUIDE_LINES } from '../data/worldTopics';
import { drawTopic } from '../state/actions';
import { useActionEffect, useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import { useSpeech } from '../ui/Speech';
import type { AmbientScene } from './AmbientScene';
import { ImageWorld } from './ImageWorld';

const SCENES = worldAssets.bbq.scenes ?? {};
const COALS = 5;

/** 才能BBQの広場：看板に今日のテーマ、リアクションで炭火が灯る（問いは共通の山札） */
export function BbqWorld() {
  const history = useSession((s) => s.history);
  const theme = useSession((s) => s.theme);
  const reactions = useSession((s) => s.reactions);
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const guide = useSpeech(BBQ_GUIDE_LINES);
  const [flip, setFlip] = useState(0);
  const [scene, setScene] = useState<AmbientScene | null>(null);

  const last = useMemo(() => [...history].reverse().find((h) => h.world === 'bbq'), [history]);
  // 共感や「もっと聞きたい」が出るたびに、炭火がひとつ灯る（問いが変わると炭火も新しく）
  const lit = Math.min(
    COALS,
    reactions.filter((r) => r.world === 'bbq' && r.reaction !== 'speak' && (!last || r.at > last.at)).length,
  );

  useActionEffect((action) => {
    if (action.type === 'drawTopic' && action.drawn.source === 'bbq') {
      setFlip((f) => f + 1);
      sound.pop(0.8);
    }
    if (action.type === 'react' && action.event.world === 'bbq' && lit === COALS - 1 && action.event.reaction !== 'speak') {
      // 5つ目の炭火：ちょっとしたお祝い
      scene?.burst(0.585, 0.5, 40, 120, 1.6);
      sound.chime(0);
    }
  });

  const draw = () => dispatch(drawTopic(store.getState(), me.seat, 'bbq'));

  const stage = (
    <>
      <div className="bbq-board bbq-board--person" key={`p${flip}`}>
        <small>本日のテーマ</small>
        <strong>{theme || '好きなもの、持ち寄り'}</strong>
      </div>
      <div className="bbq-board bbq-board--reason">
        <small>本日の炭火</small>
        <strong>
          {lit} / {COALS}
        </strong>
      </div>
      <button className="hotspot" style={{ left: '58.5%', top: '55%', width: '14%', height: '14%' }} onClick={() => scene?.burst(0.585, 0.52, 30, 50)} aria-label="焼き網をあおぐ" />
    </>
  );

  return (
    <ImageWorld
      world="bbq"
      kind="bbq"
      src={SCENES.plaza}
      aspect={1672 / 941}
      fallback="radial-gradient(circle at 58% 60%, #a0522d55, #2a1830 50%, #0f0a16)"
      stage={stage}
      onScene={(s) => {
        s.setSource(0.585, 0.55);
        setScene(s);
      }}
    >
      <div className="coals" aria-label={`炭火 ${lit} / ${COALS}`}>
        {Array.from({ length: COALS }, (_, i) => (
          <span key={i} className={`coal ${i < lit ? 'is-lit' : ''}`} />
        ))}
        <small>{lit >= COALS ? '炭火がそろいました' : '「わかる！」で炭火が灯ります'}</small>
      </div>
      <button className="bbq-guide" onClick={guide.say} aria-label="どんぐりの案内人に話しかける">
        {SCENES.guide ? <img src={assetUrl(SCENES.guide)} alt="" /> : <span aria-hidden>🌰</span>}
      </button>
      {guide.line && (
        <p key={guide.lineKey} className="npc-line npc-line--bbq">
          <small>案内どんぐり</small>
          {guide.line}
        </p>
      )}
      <button className="world-action world-action--bbq" onClick={draw}>
        <span aria-hidden>🔥</span> 次の問いを焼く
      </button>
    </ImageWorld>
  );
}
