import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { sound } from './audio/sound';
import { assetUrl, worldAssets } from './config/assets';
import { useScene } from './engine/useScene';
import { RoomProvider } from './state/RoomContext';
import { RoomStore } from './state/store';
import type { Participant } from './state/types';
import { safeStorage } from './state/util';
import { Entry } from './ui/Entry';
import { Help } from './ui/Help';
import { HostMenu } from './ui/HostMenu';
import { Participants } from './ui/Participants';
import { ReactionBar } from './ui/ReactionBar';
import { ReactionFloat } from './ui/ReactionFloat';
import { RecordSheet } from './ui/RecordSheet';
import { SpeakQueue } from './ui/SpeakQueue';
import { PanelProvider, type Panel } from './ui/PanelContext';
import { TopBar } from './ui/TopBar';
import { TopicPicker } from './ui/TopicPicker';
import { WorldAtlas } from './ui/WorldAtlas';
import { AmbientScene } from './worlds/AmbientScene';
import { CampfireScene } from './worlds/CampfireScene';
import { CoverStage } from './worlds/CoverStage';
import { VoiceProvider } from './voice/VoiceContext';
import { WorldStage } from './worlds/WorldStage';

/** イラストが主役のワールドでは、お題カードを右に寄せて絵を隠さない */
const SIDE_CARD_WORLDS = new Set(['minasoko', 'bbq', 'town']);

function roomFromUrl() {
  const id = new URLSearchParams(location.search).get('room');
  return (id && id.replace(/[^\w-]/g, '').slice(0, 32)) || 'demo';
}

function loadMe(roomId: string): Participant | null {
  const raw = safeStorage.get('session', `taiwa:me:${roomId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Participant;
  } catch {
    return null;
  }
}

const GATE = worldAssets.campfire.scenes?.gate;

/** 入室画面の背景：ナゴリの樹を外から見た夕暮れ。絵が無ければコードで描いた焚き火 */
function ProceduralBackdrop() {
  const { canvasRef } = useScene((c) => new CampfireScene(c), { backdrop: true });
  return <canvas ref={canvasRef} className="world__canvas entry__backdrop" />;
}

function EntryBackdrop() {
  const [failed, setFailed] = useState(!GATE);
  const fxRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (failed || !fxRef.current) return;
    const s = new AmbientScene(fxRef.current, 'fireflies', 1600 / 900);
    s.start();
    return () => s.destroy();
  }, [failed]);
  if (failed) return <ProceduralBackdrop />;
  return (
    <>
      <CoverStage src={GATE} aspect={1600 / 900} fallback="#0b0a16" className="entry__gate">
        <img src={assetUrl(GATE!)} alt="" style={{ display: 'none' }} onError={() => setFailed(true)} />
      </CoverStage>
      <canvas ref={fxRef} className="world__canvas world__canvas--fx" />
    </>
  );
}

export function App() {
  const roomId = useMemo(roomFromUrl, []);
  const store = useMemo(() => new RoomStore(roomId), [roomId]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const online = useSyncExternalStore(store.subscribe, store.getOnline);
  const [me, setMe] = useState<Participant | null>(() => loadMe(roomId));
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const enter = (p: Participant, fromClick = false) => {
    // 入室ボタンを押した瞬間から、焚き火の音を鳴らす（音はいつでも消せる）
    if (fromClick && !sound.enabled) sound.setEnabled(true);
    safeStorage.set('session', `taiwa:me:${roomId}`, JSON.stringify(p));
    store.setSeat(p.seat);
    store.dispatch({ type: 'join', participant: p });
    if (p.role === 'host' && !store.getState().startedAt) store.dispatch({ type: 'start', at: Date.now() });
    setMe(p);
    setEntered(true);
  };

  // 同じタブで再読み込みしたときは、そのまま席に戻る
  useEffect(() => {
    if (me && !entered) enter(me);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me || !entered) {
    return (
      <div className="app">
        <EntryBackdrop />
        <Entry roomId={roomId} state={state} online={online} initial={me} onEnter={(p) => enter(p, true)} />
      </div>
    );
  }

  const close = () => setPanel(null);

  return (
    <RoomProvider value={{ store, me }}>
      <PanelProvider value={setPanel}>
      <VoiceProvider>
      <div className={`app room ${SIDE_CARD_WORLDS.has(state.world) ? 'room--side' : ''}`}>
        <WorldStage />
        <div className="hud">
          <TopBar open={setPanel} />
          <Participants />
          <div className="hud__right">
            <SpeakQueue />
          </div>
          <ReactionFloat />
          <ReactionBar />
        </div>
        {panel === 'map' && <WorldAtlas onClose={close} />}
        {panel === 'record' && <RecordSheet onClose={close} />}
        {panel === 'host' && <HostMenu onClose={close} onPick={() => setPanel('pick')} />}
        {panel === 'pick' && <TopicPicker onClose={close} />}
        {panel === 'help' && (
          <Help
            onClose={close}
            roomId={roomId}
            onChangeSeat={() => {
              store.dispatch({ type: 'leave', seat: me.seat });
              store.setSeat(null);
              safeStorage.remove('session', `taiwa:me:${roomId}`);
              setEntered(false);
              close();
            }}
          />
        )}
      </div>
      </VoiceProvider>
      </PanelProvider>
    </RoomProvider>
  );
}
