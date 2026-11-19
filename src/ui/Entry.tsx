import { useState } from 'react';
import { APP_SUBTITLE, APP_TITLE } from '../config/app';
import { AVATARS, SEATS, SEAT_BY_ID } from '../data/seats';
import { Avatar } from './Avatar';
import type { Participant, SeatId, SessionState } from '../state/types';

export function Entry({
  roomId,
  state,
  online,
  initial,
  onEnter,
}: {
  roomId: string;
  state: SessionState;
  online: SeatId[];
  initial: Participant | null;
  onEnter: (p: Participant) => void;
}) {
  const firstFree = SEATS.find((s) => !online.includes(s.seat))?.seat ?? 'guest1';
  const [seat, setSeat] = useState<SeatId>(initial?.seat ?? firstFree);
  const info = SEAT_BY_ID[seat];
  const [name, setName] = useState(initial?.name ?? state.participants[seat]?.name ?? info.defaultName);
  const [avatar, setAvatar] = useState(initial?.avatar ?? info.defaultAvatar);
  const [copied, setCopied] = useState(false);

  const chooseSeat = (s: SeatId) => {
    setSeat(s);
    const prev = state.participants[s];
    setName(prev?.name ?? SEAT_BY_ID[s].defaultName);
    setAvatar(prev?.avatar ?? SEAT_BY_ID[s].defaultAvatar);
  };

  const invite = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;

  return (
    <div className="entry">
      <form
        className="entry__panel"
        onSubmit={(e) => {
          e.preventDefault();
          onEnter({ seat, name: name.trim(), avatar, role: info.role });
        }}
      >
        <p className="entry__kicker">ようこそ</p>
        <h1>{APP_TITLE}</h1>
        <p className="entry__lead">{APP_SUBTITLE}</p>

        <fieldset className="entry__seats">
          <legend className="label">席をえらぶ</legend>
          {SEATS.map((s) => {
            const taken = online.includes(s.seat);
            const p = state.participants[s.seat];
            return (
              <button
                type="button"
                key={s.seat}
                className={`seat ${seat === s.seat ? 'is-on' : ''}`}
                onClick={() => chooseSeat(s.seat)}
                disabled={taken && initial?.seat !== s.seat}
              >
                <Avatar value={p?.avatar ?? s.defaultAvatar} className="seat__face" />
                <strong>{p?.name || s.defaultName || (s.seat === 'guest1' ? 'ゲストA' : 'ゲストB')}</strong>
                <small>{taken ? '入室中' : s.label}</small>
              </button>
            );
          })}
        </fieldset>

        <label className="label" htmlFor="entry-name">
          呼ばれたい名前
        </label>
        <input
          id="entry-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ニックネームでどうぞ"
          maxLength={12}
        />

        <span className="label">アイコン</span>
        <div className="entry__avatars">
          {AVATARS.map((a) => (
            <button type="button" key={a} className={`avatar ${avatar === a ? 'is-on' : ''}`} onClick={() => setAvatar(a)} aria-label={`アイコン ${a}`}>
              <Avatar value={a} />
            </button>
          ))}
        </div>

        <button className="btn btn--primary btn--large">焚き火の広場へ</button>
        <p className="entry__note">
          入ったあと、右上の「声で参加」で話せます。顔出しは不要です。
          <br />
          ひとりで試すときは、ホストの席がおすすめです。
        </p>
        <div className="entry__room">
          <span>ルーム：{roomId}</span>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite);
                setCopied(true);
              } catch {
                window.prompt('招待リンク', invite);
              }
            }}
          >
            {copied ? 'コピーしました' : '招待リンクをコピー'}
          </button>
        </div>
      </form>
    </div>
  );
}
