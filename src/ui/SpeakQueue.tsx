import { useEffect, useState } from 'react';
import { displayName } from '../data/seats';
import { useDispatch, useMe, useSession } from '../state/RoomContext';

function ago(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}秒前` : `${Math.floor(s / 60)}分前`;
}

/** 「私も話したい」の順番待ち。ファシリテーターが見落とさないよう、ホストには目立つ形で出す */
export function SpeakQueue() {
  const queue = useSession((s) => s.speakQueue);
  const participants = useSession((s) => s.participants);
  const me = useMe();
  const dispatch = useDispatch();
  const [now, setNow] = useState(Date.now());
  const isHost = me.role === 'host';

  useEffect(() => {
    if (queue.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [queue.length]);

  if (queue.length === 0) return null;

  return (
    <section className={`queue ${isHost ? 'queue--host' : ''}`} aria-live="assertive">
      <h3>
        <span aria-hidden>✋</span> 話したい人がいます
      </h3>
      <ol>
        {queue.map((q, i) => (
          <li key={q.seat} className={q.seat === me.seat ? 'is-me' : ''}>
            <span className="queue__no">{i + 1}</span>
            <span className="queue__name">
              {displayName(participants[q.seat]?.name, q.seat)}
              {q.seat === me.seat && '（あなた）'}
            </span>
            <small>{ago(now - q.at)}</small>
            {(isHost || q.seat === me.seat) && (
              <button className="btn btn--small btn--primary" onClick={() => dispatch({ type: 'speakDone', seat: q.seat })}>
                {isHost ? 'どうぞ' : '取り下げ'}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
