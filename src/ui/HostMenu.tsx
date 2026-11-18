import { useState } from 'react';
import { useDispatch, useSession } from '../state/RoomContext';
import { Modal } from './Modal';

export function HostMenu({ onClose, onPick }: { onClose: () => void; onPick: () => void }) {
  const theme = useSession((s) => s.theme);
  const startedAt = useSession((s) => s.startedAt);
  const dispatch = useDispatch();
  const [draft, setDraft] = useState(theme);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Modal title="進行メニュー" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: 'setTheme', theme: draft.trim() });
          onClose();
        }}
      >
        <label className="label" htmlFor="theme">
          今日のテーマ
        </label>
        <div className="form-row">
          <input id="theme" className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="例：何度でも戻ってしまう場所" maxLength={40} />
          <button className="btn btn--primary">決める</button>
        </div>
      </form>
      <div className="stack">
        <span className="label">対話の時間</span>
        <div className="form-row">
          <button
            className="btn"
            onClick={() => {
              dispatch({ type: 'start', at: Date.now() });
              onClose();
            }}
          >
            {startedAt ? '時計を0分に戻す' : 'いま開始する'}
          </button>
          <button
            className="btn"
            onClick={() => {
              onClose();
              onPick();
            }}
          >
            困ったときのお題（ホストだけに見える）
          </button>
        </div>
      </div>
      <div className="stack">
        <span className="label">新しい回をはじめる</span>
        {confirmReset ? (
          <div className="form-row">
            <span className="muted">お題・葉・灯籠・記録がすべて消えます。</span>
            <button
              className="btn btn--danger"
              onClick={() => {
                dispatch({ type: 'reset', at: Date.now() });
                onClose();
              }}
            >
              リセットする
            </button>
          </div>
        ) : (
          <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
            この回の記録を消して、まっさらにする
          </button>
        )}
      </div>
    </Modal>
  );
}
