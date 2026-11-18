import { useState } from 'react';
import { TOPICS, TOPIC_TAGS } from '../data/topics';
import { pick } from '../state/util';
import { Modal } from './Modal';

/**
 * 困ったときのお題。ホストの画面にだけ出て、ほかの人には見えない（何も送らない）。
 * 話が止まったときに、ここから選んで声で投げかける。
 */
export function TopicPicker({ onClose }: { onClose: () => void }) {
  const [tag, setTag] = useState<string | null>(null);
  const [current, setCurrent] = useState(() => pick(TOPICS));
  const list = tag ? TOPICS.filter((t) => t.tag === tag) : TOPICS;

  return (
    <Modal title="困ったときのお題" onClose={onClose} wide>
      <p className="muted">ホストの画面にだけ出ています。参加者には見えません。</p>
      <div className="host-topic">
        <p className="host-topic__text" key={current.id}>
          {current.text}
        </p>
        <button className="btn btn--primary btn--small" onClick={() => setCurrent(pick(TOPICS.filter((t) => t.id !== current.id)))}>
          別のお題
        </button>
      </div>
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
            <button className={t.id === current.id ? 'is-used' : ''} onClick={() => setCurrent(t)}>
              <small>{t.tag}</small>
              {t.text}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
