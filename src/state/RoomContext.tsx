import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { RoomStore } from './store';
import type { Action, Participant, SessionState } from './types';

interface RoomContextValue {
  store: RoomStore;
  me: Participant;
}

const RoomContext = createContext<RoomContextValue | null>(null);
export const RoomProvider = RoomContext.Provider;

function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('RoomProvider が見つかりません');
  return ctx;
}

export function useSession<T>(selector: (s: SessionState) => T): T {
  const { store } = useRoom();
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export function useOnline() {
  const { store } = useRoom();
  return useSyncExternalStore(store.subscribe, store.getOnline);
}

export function useMe() {
  return useRoom().me;
}

export function useDispatch() {
  return useRoom().store.dispatch;
}

export function useStore() {
  return useRoom().store;
}

/** 自分・他の人どちらの操作でも、Action が届いたら演出を起こすためのフック */
export function useActionEffect(handler: (action: Action, remote: boolean) => void) {
  const { store } = useRoom();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => store.onAction((a, r) => ref.current(a, r)), [store]);
}
