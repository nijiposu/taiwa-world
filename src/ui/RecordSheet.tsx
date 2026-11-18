import { useMemo, useState } from 'react';
import { APP_TITLE } from '../config/app';
import { SEATS, displayName } from '../data/seats';
import { WORLDS } from '../data/worlds';
import { EMPTY_RECORD } from '../state/reducer';
import { useDispatch, useMe, useSession } from '../state/RoomContext';
import type { PersonalRecord, SeatId, SessionState } from '../state/types';
import { Avatar } from './Avatar';
import { Modal } from './Modal';

const FIELDS: { key: keyof PersonalRecord; label: string; placeholder: string; hostOnly?: boolean }[] = [
  { key: 'works', label: '持ち寄った作品', placeholder: '今日話した作品・キャラクター・曲など' },
  { key: 'feelings', label: '話して感じたこと', placeholder: '話してみて、聞いてみて、心が動いたこと' },
  { key: 'insights', label: '価値観についての気づき', placeholder: '「だから好きなんだ」と腑に落ちたこと' },
  { key: 'feedback', label: 'ファシリテーターからのひとこと', placeholder: 'ホストが書き添えます', hostOnly: true },
];

function dateLabel(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function recordText(state: SessionState, seat: SeatId): string {
  const p = state.participants[seat];
  const rec = state.records[seat] ?? EMPTY_RECORD;
  const worlds = [...new Set(state.visited.map((v) => WORLDS[v.world].name))];
  const topics = [...new Set(state.history.map((h) => h.topic.text))];
  const words = [...state.leaves, ...state.lanterns].filter((k) => k.seat === seat && k.text).map((k) => k.text);
  const lines = [
    `■ 今日の記録 ─ ${APP_TITLE}`,
    `${dateLabel(state.startedAt ?? Date.now())}　${displayName(p?.name, seat)}さん`,
    '',
    `今日のテーマ：${state.theme || '（自由なテーマ）'}`,
    `訪れたワールド：${worlds.join(' → ') || '焚き火の広場'}`,
    '',
    '話した問い：',
    ...(topics.length ? topics.map((t) => `・${t}`) : ['・（なし）']),
    ...(words.length ? ['', '残したことば：', ...words.map((w) => `・${w}`)] : []),
    '',
    ...FIELDS.flatMap((f) => [`【${f.label}】`, rec[f.key] || '', '']),
  ];
  return lines.join('\n');
}

export function RecordSheet({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const state = useSession((s) => s);
  const dispatch = useDispatch();
  const guests = SEATS.filter((s) => s.role === 'guest' && state.participants[s.seat]);
  const defaultSeat: SeatId = me.role === 'guest' ? me.seat : (guests[0]?.seat ?? me.seat);
  const [seat, setSeat] = useState<SeatId>(defaultSeat);
  const [copied, setCopied] = useState(false);
  const rec = state.records[seat] ?? EMPTY_RECORD;
  const isHost = me.role === 'host';
  const canEdit = (hostOnly?: boolean) => (hostOnly ? isHost : isHost || seat === me.seat);

  const worlds = useMemo(() => [...new Set(state.visited.map((v) => v.world))], [state.visited]);
  const topics = useMemo(() => [...new Set(state.history.map((h) => h.topic.text))], [state.history]);
  const words = [...state.leaves, ...state.lanterns].filter((k) => k.seat === seat && k.text);

  const text = () => recordText(state, seat);
  const save = () => {
    const blob = new Blob([text()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `今日の記録_${displayName(state.participants[seat]?.name, seat)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Modal title="今日の記録" onClose={onClose} wide className="record">
      {isHost && (
        <div className="chips">
          {SEATS.filter((s) => state.participants[s.seat]).map((s) => (
            <button key={s.seat} className={`chip ${seat === s.seat ? 'is-on' : ''}`} onClick={() => setSeat(s.seat)}>
              <Avatar value={state.participants[s.seat]?.avatar} className="chip__face" /> {displayName(state.participants[s.seat]?.name, s.seat)}
            </button>
          ))}
        </div>
      )}
      <article className="record__paper">
        <header>
          <small>{dateLabel(state.startedAt ?? Date.now())}</small>
          <h3>{displayName(state.participants[seat]?.name, seat)}さんの、今日の記録</h3>
        </header>
        <dl className="record__auto">
          <dt>今日のテーマ</dt>
          <dd>{state.theme || '自由なテーマ'}</dd>
          <dt>訪れたワールド</dt>
          <dd className="record__worlds">
            {(worlds.length ? worlds : (['campfire'] as const)).map((w) => (
              <span key={w} className={`stamp stamp--${w}`}>
                {WORLDS[w].name}
              </span>
            ))}
          </dd>
          {topics.length > 0 && (
            <>
              <dt>話した問い</dt>
              <dd>
                <ul>
                  {topics.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          {words.length > 0 && (
            <>
              <dt>残したことば</dt>
              <dd>
                <ul>
                  {words.map((w) => (
                    <li key={w.id}>{w.text}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
        {FIELDS.map((f) => (
          <label key={f.key} className="record__field">
            <span>{f.label}</span>
            <textarea
              value={rec[f.key]}
              placeholder={f.placeholder}
              readOnly={!canEdit(f.hostOnly)}
              rows={f.key === 'works' ? 2 : 3}
              onChange={(e) => dispatch({ type: 'updateRecord', seat, patch: { [f.key]: e.target.value } })}
            />
          </label>
        ))}
      </article>
      <div className="form-row record__actions">
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text());
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              save();
            }
          }}
        >
          {copied ? 'コピーしました' : 'テキストをコピー'}
        </button>
        <button className="btn" onClick={save}>
          ファイルで保存
        </button>
        <button className="btn btn--primary" onClick={() => window.print()}>
          印刷 / PDF
        </button>
      </div>
    </Modal>
  );
}
