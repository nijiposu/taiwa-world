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
  only,
  onEnter,
}: {
  roomId: string;
  state: SessionState;
  online: SeatId[];
  initial: Participant | null;
  /** リンクで席を絞る：'host1' | 'host2' | 'guest'（ゲストはゲスト席だけ） */
  only?: 'host1' | 'host2' | 'guest' | 'try' | null;
  onEnter: (p: Participant) => void;
}) {
  const trial = only === 'try';
  const seats =
    only === 'guest' ? SEATS.filter((s) => s.role === 'guest') : trial ? SEATS.filter((s) => s.seat === 'host1') : only ? SEATS.filter((s) => s.seat === only) : SEATS;
  const firstFree = seats.find((s) => !online.includes(s.seat))?.seat ?? seats[0].seat;
  const [seat, setSeat] = useState<SeatId>(initial && seats.some((s) => s.seat === initial.seat) ? initial.seat : firstFree);
  const info = SEAT_BY_ID[seat];
  const [name, setName] = useState(initial?.name ?? (only === 'guest' || trial ? '' : state.participants[seat]?.name) ?? info.defaultName);
  const [avatar, setAvatar] = useState(initial?.avatar ?? info.defaultAvatar);
  const [copied, setCopied] = useState(false);

  const chooseSeat = (s: SeatId) => {
    setSeat(s);
    const prev = state.participants[s];
    setName(prev?.name ?? SEAT_BY_ID[s].defaultName);
    setAvatar(prev?.avatar ?? SEAT_BY_ID[s].defaultAvatar);
  };

  // 招待リンクは、みんな用（ゲスト席だけが出る）のものをコピーする
  const invite = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}&seat=guest`;

  return (
    <div className="entry">
      <form
        className="entry__panel"
        onSubmit={(e) => {
          e.preventDefault();
          onEnter({ seat, name: name.trim() || (trial ? 'あなた' : ''), avatar, role: info.role });
        }}
      >
        <p className="entry__kicker">{trial ? 'おためし' : 'ようこそ'}</p>
        {trial && (
          <p className="entry__trial">
            あなただけの部屋で、焚き火・ナゴリの樹・灯籠祭を自由に歩けます。
            <br />
            右上の地図から、ほかの世界へ行ってみてください。
          </p>
        )}
        <h1>{APP_TITLE}</h1>
        <p className="entry__lead">{APP_SUBTITLE}</p>

        <fieldset className="entry__seats">
          <legend className="label">席をえらぶ</legend>
          {seats.map((s) => {
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
                <strong>{trial ? 'あなた' : p?.name || s.defaultName || (s.seat === 'guest1' ? 'ゲストA' : 'ゲストB')}</strong>
                <small>{trial ? 'おためし' : taken ? '入室中' : s.label}</small>
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
        {trial ? (
          <p className="entry__note">本番の会では、4人で焚き火を囲んで、声で話します。顔出しは不要です。</p>
        ) : (
          <p className="entry__note">
            入ったあと、右上の「声で参加」で話せます。顔出しは不要です。
            <br />
            ひとりで試すときは、ホストの席がおすすめです。
          </p>
        )}
        {!trial && (
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
        )}
      </form>
    </div>
  );
}
