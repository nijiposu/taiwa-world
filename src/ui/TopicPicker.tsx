import { useState } from 'react';
import { TOPICS, TOPIC_TAGS } from '../data/topics';
import { drawTopic } from '../state/actions';
import { useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import { Modal } from './Modal';

export function TopicPicker({ onClose }: { onClose: () => void }) {
  const [tag, setTag] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const used = useSession((s) => s.deckUsed);
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const list = tag ? TOPICS.filter((t) => t.tag === tag) : TOPICS;

  const choose = (text: string, id: string, t: string) => {
    dispatch(drawTopic(store.getState(), me.seat, 'pick', { id, text, tag: t }));
    onClose();
  };

  return (
    <Modal title="問いを選ぶ" onClose={onClose} wide>
      <div className="chips">
        <button className={`chip ${tag === null ? 'is-on' : ''}`} onClick={() => setTag(null)}>
          すべて
        </button>
        {TOPIC_TAGS.map((t) => (
          <button key={t} className={`chip ${tag === t ? 'is-on' : ''}`} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>
      <ul className="topic-list">
        {list.map((t) => (
          <li key={t.id}>
            <button className={used.includes(t.id) ? 'is-used' : ''} onClick={() => choose(t.text, t.id, t.tag)}>
              <small>{t.tag}</small>
              {t.text}
              {used.includes(t.id) && <em>話した</em>}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) choose(custom.trim(), `custom-${Date.now()}`, 'その場の問い');
        }}
      >
        <input className="field" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="その場で問いを書く" maxLength={60} />
        <button className="btn btn--primary" disabled={!custom.trim()}>
          この問いにする
        </button>
      </form>
    </Modal>
  );
}
