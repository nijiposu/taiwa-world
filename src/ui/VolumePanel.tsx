import { useEffect, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { useVoice } from '../voice/VoiceContext';

/** 音のボタンからひらく、音量の調整。BGM・効果音・みんなの声を別々に */
export function VolumePanel({ soundOn, onToggle, onClose }: { soundOn: boolean; onToggle: () => void; onClose: () => void }) {
  const { voice } = useVoice();
  const [music, setMusic] = useState(sound.musicVolume);
  const [sfx, setSfx] = useState(sound.sfxVolume);
  const [voiceVol, setVoiceVol] = useState(() => voice?.getVolume() ?? 1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.tool--sound')) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const row = (label: string, value: number, set: (v: number) => void, disabled = false) => (
    <label className={`volume__row ${disabled ? 'is-off' : ''}`}>
      <span>{label}</span>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => set(Number(e.target.value) / 100)} />
      <b>{Math.round(value * 100)}</b>
    </label>
  );

  return (
    <div ref={ref} className="volume" role="dialog" aria-label="音量">
      <button className={`volume__toggle ${soundOn ? 'is-on' : ''}`} onClick={onToggle}>
        {soundOn ? 'BGM・効果音：オン' : 'BGM・効果音：オフ'}
      </button>
      {row('BGM', music, (v) => (setMusic(v), sound.setMusicVolume(v)), !soundOn)}
      {row('効果音', sfx, (v) => (setSfx(v), sound.setSfxVolume(v)), !soundOn)}
      {row('みんなの声', voiceVol, (v) => (setVoiceVol(v), voice?.setVolume(v)))}
      <small>音量は、この端末にだけ覚えておきます。</small>
    </div>
  );
}
