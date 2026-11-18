import { useState } from 'react';
import { sound } from '../audio/sound';
import { workLink } from '../config/links';
import { WORLDS } from '../data/worlds';
import { useMe, useSession } from '../state/RoomContext';
import type { Panel } from './PanelContext';
import { Timer } from './Timer';

export function TopBar({ open }: { open: (p: Panel) => void }) {
  const world = useSession((s) => s.world);
  const theme = useSession((s) => s.theme);
  const me = useMe();
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const info = WORLDS[world];

  return (
    <header className="topbar">
      <div className="topbar__place" key={world}>
        <span className="topbar__world">
          {info.name}
          {info.id === 'lantern' && <small>{info.subtitle}</small>}
        </span>
        {theme && <span className="topbar__theme">今日のテーマ：{theme}</span>}
        {workLink(world) && (
          <a className="work-link work-link--bar" href={workLink(world)!.url} target="_blank" rel="noreferrer">
            {workLink(world)!.label} ↗
          </a>
        )}
      </div>
      <Timer />
      <div className="topbar__tools">
        <button
          className={`tool ${soundOn ? 'is-on' : ''}`}
          onClick={() => {
            sound.setEnabled(!soundOn);
            setSoundOn(!soundOn);
          }}
          aria-pressed={soundOn}
          title={soundOn ? '音を消す' : '音を鳴らす'}
        >
          <span aria-hidden>{soundOn ? '🔔' : '🔕'}</span>
          <span className="tool__label">音</span>
        </button>
        <button className="tool" onClick={() => open('map')} title="世界の地図">
          <span aria-hidden>🗺️</span>
          <span className="tool__label">地図</span>
        </button>
        <button className="tool" onClick={() => open('record')} title="今日の記録">
          <span aria-hidden>📖</span>
          <span className="tool__label">記録</span>
        </button>
        {me.role === 'host' && (
          <button className="tool" onClick={() => open('host')} title="進行メニュー">
            <span aria-hidden>🧭</span>
            <span className="tool__label">進行</span>
          </button>
        )}
        <button className="tool" onClick={() => open('help')} title="この場所について">
          <span aria-hidden>？</span>
        </button>
      </div>
    </header>
  );
}
