import { useState } from 'react';
import { REACTION_BY_ID } from '../data/reactions';
import { displayName } from '../data/seats';
import { useActionEffect, useSession } from '../state/RoomContext';
import type { ReactionEvent } from '../state/types';

/** リアクションが画面にふわっと浮かぶ。誰の気持ちかがわかるように名前を添える */
export function ReactionFloat() {
  const [items, setItems] = useState<(ReactionEvent & { x: number })[]>([]);
  const participants = useSession((s) => s.participants);

  useActionEffect((action) => {
    if (action.type !== 'react') return;
    const item = { ...action.event, x: 18 + Math.random() * 64 };
    setItems((list) => [...list.slice(-12), item]);
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== item.id)), 3200);
  });

  return (
    <div className="floats" aria-hidden>
      {items.map((i) => {
        const r = REACTION_BY_ID[i.reaction];
        return (
          <div key={i.id} className={`float float--${i.reaction}`} style={{ left: `${i.x}%`, ['--c' as string]: r.color }}>
            <span className="float__emoji">{r.emoji}</span>
            <span className="float__name">
              {displayName(participants[i.seat]?.name, i.seat)}・{r.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
