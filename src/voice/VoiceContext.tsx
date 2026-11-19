import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useStore } from '../state/RoomContext';
import type { SeatId } from '../state/types';
import { VoiceChat, type VoiceSnapshot } from './VoiceChat';

const VoiceContext = createContext<VoiceChat | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [voice, setVoice] = useState<VoiceChat | null>(null);
  useEffect(() => {
    const v = new VoiceChat(store);
    setVoice(v);
    return () => v.destroy();
  }, [store]);
  return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
}

const EMPTY: VoiceSnapshot = { joined: false, joining: false, muted: false, peers: 0, speaking: [], error: null };

export function useVoice() {
  const voice = useContext(VoiceContext);
  const snap = useSyncExternalStore(voice?.subscribe ?? (() => () => undefined), voice?.getSnapshot ?? (() => EMPTY));
  return { voice, ...snap };
}

/** その席の人が、いま声を出しているか */
export function useSpeaking(seat: SeatId) {
  return useVoice().speaking.includes(seat);
}
