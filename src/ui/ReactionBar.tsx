import { useState } from 'react';
import { REACTIONS } from '../data/reactions';
import { react } from '../state/actions';
import { useDispatch, useMe, useSession, useStore } from '../state/RoomContext';
import type { ReactionId } from '../state/types';

const COOLDOWN = 900;

export function ReactionBar() {
  const store = useStore();
  const dispatch = useDispatch();
  const me = useMe();
  const queued = useSession((s) => s.speakQueue.some((q) => q.seat === me.seat));
  const [pressed, setPressed] = useState<ReactionId | null>(null);

  const send = (id: ReactionId) => {
    if (pressed) return;
    dispatch(react(store.getState(), me.seat, id));
    navigator.vibrate?.(12);
    setPressed(id);
    window.setTimeout(() => setPressed(null), COOLDOWN);
  };

  return (
    <nav className="reactions" aria-label="リアクション">
      {REACTIONS.map((r) => {
        const waiting = r.id === 'speak' && queued;
        return (
          <button
            key={r.id}
            className={`reaction ${pressed === r.id ? 'is-pressed' : ''} ${waiting ? 'is-waiting' : ''}`}
            style={{ ['--c' as string]: r.color }}
            onClick={() => (waiting ? dispatch({ type: 'speakDone', seat: me.seat }) : send(r.id))}
            title={waiting ? 'もう一度押すと取り下げます' : r.label}
          >
            <span className="reaction__emoji" aria-hidden>
              {r.emoji}
            </span>
            <span className="reaction__label">{waiting ? '順番待ち中' : r.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
