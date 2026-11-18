import { useEffect, useState } from 'react';
import { sound } from '../audio/sound';
import { displayName } from '../data/seats';
import { drawTopic } from '../state/actions';
import { useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import type { TopicSource } from '../state/types';

const SOURCE_LABEL: Record<TopicSource, string> = {
  deck: 'お題カード',
  pick: 'ホストが選んだ問い',
  furin: '風鈴が運んだ問い',
  omikuji: 'おみくじの問い',
  tree: 'ナゴリの樹の問い',
  letter: '水底から届いた問い',
  bbq: 'BBQ広場で焼けた問い',
  clock: '時計塔が運んできた問い',
};

export function TopicCard({ onPick }: { onPick: () => void }) {
  const current = useSession((s) => s.current);
  const participants = useSession((s) => s.participants);
  const count = useSession((s) => s.history.length);
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const [folded, setFolded] = useState(false);
  const [flip, setFlip] = useState(0);
  const isHost = me.role === 'host';

  useEffect(() => {
    if (!current) return;
    setFolded(false);
    setFlip((f) => f + 1);
    sound.bell();
  }, [current?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = () => dispatch(drawTopic(store.getState(), me.seat, 'deck'));

  if (!current) {
    if (!isHost) return null;
    return (
      <div className="topic topic--empty">
        <button className="topic__draw" onClick={draw}>
          <span className="topic__deck" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          お題カードを引く
        </button>
        <button className="btn btn--ghost btn--small" onClick={onPick}>
          一覧から選ぶ
        </button>
      </div>
    );
  }

  return (
    <section className={`topic ${folded ? 'is-folded' : ''}`} aria-live="polite">
      <div className="topic__card" key={flip}>
        <header className="topic__meta">
          <span>
            {SOURCE_LABEL[current.source]}
            {current.source === 'omikuji' && current.extra ? `・${current.extra}` : ''}
          </span>
          <span className="topic__by">
            {displayName(participants[current.by]?.name, current.by)}さん ・ {count}枚目
          </span>
        </header>
        <p className="topic__text">{current.topic.text}</p>
        {isHost && (
          <footer className="topic__actions">
            <button className="btn btn--primary btn--small" onClick={draw}>
              次の問いへ
            </button>
            <button className="btn btn--ghost btn--small" onClick={onPick}>
              選ぶ
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => dispatch({ type: 'clearTopic' })}>
              しまう
            </button>
          </footer>
        )}
      </div>
      <button className="topic__fold" onClick={() => setFolded(!folded)} aria-label={folded ? 'お題をひらく' : 'お題をたたむ'}>
        {folded ? `問い：${current.topic.text}` : '︿'}
      </button>
    </section>
  );
}
