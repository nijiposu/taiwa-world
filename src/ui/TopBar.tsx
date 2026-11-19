import { useState } from 'react';
import { sound } from '../audio/sound';
import { assetUrl } from '../config/assets';
import { workLink } from '../config/links';
import { WORLDS } from '../data/worlds';
import { useConnection, useMe, useSession } from '../state/RoomContext';
import type { Panel } from './PanelContext';
import { Timer } from './Timer';
import { VoiceButton } from './VoiceButton';

export function TopBar({ open }: { open: (p: Panel) => void }) {
  const world = useSession((s) => s.world);
  const theme = useSession((s) => s.theme);
  const me = useMe();
  const connection = useConnection();
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
      {(connection === 'connecting' || connection === 'closed') && (
        <span className="conn" role="status">
          <i aria-hidden />
          {connection === 'closed' ? 'つながり直しています…' : 'つないでいます…'}
        </span>
      )}
      <Timer />
      <div className="topbar__tools">
        <VoiceButton />
        <button
          className={`tool ${soundOn ? 'is-on' : ''}`}
          onClick={() => {
            sound.setEnabled(!soundOn);
            setSoundOn(!soundOn);
          }}
          aria-pressed={soundOn}
          title={soundOn ? '音を消す' : '音を鳴らす'}
        >
          <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-lantern.webp')} alt="" style={{ opacity: soundOn ? 1 : 0.45 }} />
          <span className="tool__label">音</span>
        </button>
        <button className="tool" onClick={() => open('map')} title="世界の地図">
          <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-compass.webp')} alt="" />
          <span className="tool__label">地図</span>
        </button>
        <button className="tool" onClick={() => open('record')} title="今日の記録">
          <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-notebook.webp')} alt="" />
          <span className="tool__label">記録</span>
        </button>
        {me.role === 'host' && (
          <button className="tool" onClick={() => open('host')} title="進行メニュー">
            <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-record.webp')} alt="" />
            <span className="tool__label">進行</span>
          </button>
        )}
        <button className="tool" onClick={() => open('help')} title="この場所について">
          <img className="tool__icon" src={assetUrl('assets/nagori-ui/icon-hint.webp')} alt="" />
        </button>
      </div>
    </header>
  );
}
