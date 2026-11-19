import { useEffect, useState } from 'react';
import { REACTION_BY_ID } from '../data/reactions';
import { SEATS, displayName } from '../data/seats';
import { useMe, useOnline, useSession } from '../state/RoomContext';
import { Avatar } from './Avatar';
import { ReactionIcon } from './ReactionIcon';
import { useVoice } from '../voice/VoiceContext';

const BUBBLE_MS = 4500;

/** ホスト2名・ゲスト2名。顔出しなしなので、アイコンとリアクションで気配を伝える */
export function Participants() {
  const participants = useSession((s) => s.participants);
  const reactions = useSession((s) => s.reactions);
  const queue = useSession((s) => s.speakQueue);
  const online = useOnline();
  const { speaking } = useVoice();
  const me = useMe();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside className="people" aria-label="参加者">
      {SEATS.map((seat) => {
        const p = participants[seat.seat];
        const isOnline = online.includes(seat.seat);
        const last = [...reactions].reverse().find((r) => r.seat === seat.seat);
        const bubble = last && now - last.at < BUBBLE_MS ? REACTION_BY_ID[last.reaction] : null;
        const waiting = queue.findIndex((q) => q.seat === seat.seat);
        return (
          <div
            key={seat.seat}
            className={`person ${speaking.includes(seat.seat) ? 'is-speaking' : ''} ${isOnline ? 'is-online' : ''} ${!p ? 'is-empty' : ''} ${waiting >= 0 ? 'is-waiting' : ''}`}
          >
            <span className="person__avatar" aria-hidden>
              <Avatar value={p?.avatar} />
            </span>
            <span className="person__meta">
              <span className="person__name">
                {p ? displayName(p.name, seat.seat) : '空席'}
                {seat.seat === me.seat && <em>あなた</em>}
              </span>
              <small>
                {seat.label}
                {p && !isOnline && '・離席中'}
              </small>
            </span>
            {waiting >= 0 && (
              <span className="person__hand" title="話したい">
                ✋{waiting + 1}
              </span>
            )}
            {bubble && (
              <span key={last!.id} className="person__bubble" style={{ ['--c' as string]: bubble.color }}>
                <ReactionIcon reaction={last!.reaction} world={last!.world} />
              </span>
            )}
          </div>
        );
      })}
    </aside>
  );
}
