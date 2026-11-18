import { useEffect, useState } from 'react';
import { SESSION_MINUTES } from '../config/app';
import { useSession } from '../state/RoomContext';

const pad = (n: number) => String(n).padStart(2, '0');

export function Timer() {
  const startedAt = useSession((s) => s.startedAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!startedAt) return null;
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const min = Math.floor(sec / 60);
  const ratio = Math.min(1, sec / (SESSION_MINUTES * 60));
  const phase = min >= SESSION_MINUTES ? 'over' : min >= SESSION_MINUTES - 10 ? 'late' : '';
  return (
    <div className={`timer ${phase ? `timer--${phase}` : ''}`} title={phase === 'late' ? 'そろそろ焚き火の広場で振り返りを' : '経過時間'}>
      <svg viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r="15" className="timer__track" />
        <circle cx="18" cy="18" r="15" className="timer__bar" style={{ strokeDasharray: `${ratio * 94.2} 94.2` }} />
      </svg>
      <span>
        {pad(min)}:{pad(sec % 60)}
        <small> / {SESSION_MINUTES}分</small>
      </span>
    </div>
  );
}
