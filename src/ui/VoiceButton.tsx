import { assetUrl } from '../config/assets';
import { useVoice } from '../voice/VoiceContext';

/** 右上の「声で参加」。入ったあとは、マイクの入/切と、抜けるボタンになる */
export function VoiceButton() {
  const { voice, joined, joining, muted, peers, error } = useVoice();
  if (!voice) return null;
  if (!joined) {
    return (
      <button className={`tool tool--voice ${error ? 'has-error' : ''}`} onClick={() => void voice.join()} disabled={joining} title={error ?? '声で参加する'}>
        <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-candle.webp')} alt="" />
        <span className="tool__label">{joining ? 'つないでいます…' : '声で参加'}</span>
      </button>
    );
  }
  return (
    <span className="voice-on">
      <button className={`tool ${muted ? '' : 'is-on'}`} onClick={() => voice.toggleMute()} aria-pressed={!muted} title={muted ? 'マイクを入れる' : 'マイクを切る'}>
        <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-candle.webp')} alt="" style={{ opacity: muted ? 0.4 : 1, filter: muted ? 'grayscale(1)' : undefined }} />
        <span className="tool__label">{muted ? 'ミュート中' : `声 ${peers + 1}人`}</span>
      </button>
      <button className="tool tool--leave" onClick={() => voice.leave()} title="声の通話から抜ける" aria-label="声の通話から抜ける">
        ✕
      </button>
    </span>
  );
}
