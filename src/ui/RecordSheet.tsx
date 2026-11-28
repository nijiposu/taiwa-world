import { useMemo, useState } from 'react';
import { APP_TITLE } from '../config/app';
import { SEATS, displayName } from '../data/seats';
import { WORLDS } from '../data/worlds';
import { EMPTY_RECORD } from '../state/reducer';
import { useDispatch, useMe, useSession } from '../state/RoomContext';
import { assetUrl } from '../config/assets';
import { ReactionIcon } from './ReactionIcon';
import { recordSummary, renderRecordCard, worldPicture } from './recordCard';
import type { PersonalRecord, SeatId, SessionState } from '../state/types';
import { track } from '../analytics';
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
  const [saving, setSaving] = useState(false);
  const rec = state.records[seat] ?? EMPTY_RECORD;
  const isHost = me.role === 'host';
  const canEdit = (hostOnly?: boolean) => (hostOnly ? isHost : isHost || seat === me.seat);
  const sum = useMemo(() => recordSummary(state, seat), [state, seat]);

  const text = () => recordText(state, seat);
  const download = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const saveImage = async () => {
    setSaving(true);
    const blob = await renderRecordCard(state, seat);
    setSaving(false);
    if (blob) download(blob, `今日の記録_${sum.name}.png`);
    track('record');
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
      <article className="keepsake">
        <div className="keepsake__worlds">
          {sum.worlds.map((w, i) => (
            <figure key={w} className="keepsake__world" style={{ animationDelay: `${i * 0.12}s` }}>
              {worldPicture(w) ? <img src={assetUrl(worldPicture(w)!)} alt="" /> : <span />}
              <figcaption>{WORLDS[w].name}</figcaption>
            </figure>
          ))}
        </div>
        <header className="keepsake__head">
          <Avatar value={sum.avatar} className="keepsake__face" />
          <div>
            <small>
              {sum.date}
              {sum.theme ? `　テーマ：${sum.theme}` : ''}
            </small>
            <h3>{sum.name}さんの、今日の記録</h3>
          </div>
        </header>

        {sum.words.length > 0 && (
          <section className="keepsake__words">
            <span className="keepsake__label">残したことば</span>
            <div>
              {sum.words.map((w, i) => (
                <span key={i} className="keepsake__leaf">
                  {w}
                </span>
              ))}
            </div>
          </section>
        )}
        {sum.sent.length > 0 && (
          <section className="keepsake__sent">
            <span className="keepsake__label">みんなに届けたもの</span>
            <div>
              {sum.sent.map((r) => (
                <span key={r.id} className="keepsake__reaction">
                  <ReactionIcon reaction={r.id} world={state.world} /> {r.label}
                  <b>×{r.count}</b>
                </span>
              ))}
            </div>
          </section>
        )}

        {FIELDS.map((f) => (
          <label key={f.key} className={`keepsake__field ${f.hostOnly ? 'keepsake__field--note' : ''}`}>
            <span className="keepsake__label">{f.label}</span>
            <textarea
              value={rec[f.key]}
              placeholder={canEdit(f.hostOnly) ? f.placeholder : f.hostOnly ? 'ホストが書き添えます' : ''}
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
              download(new Blob([text()], { type: 'text/plain;charset=utf-8' }), `今日の記録_${sum.name}.txt`);
            }
          }}
        >
          {copied ? 'コピーしました' : 'テキストをコピー'}
        </button>
        <button className="btn" onClick={() => window.print()}>
          印刷 / PDF
        </button>
        <button className="btn btn--primary" onClick={() => void saveImage()} disabled={saving}>
          {saving ? 'つくっています…' : '記録カードを画像で保存'}
        </button>
      </div>
    </Modal>
  );
}
