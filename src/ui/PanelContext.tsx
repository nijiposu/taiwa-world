import { createContext, useContext } from 'react';

export type Panel = 'map' | 'record' | 'host' | 'pick' | 'help' | null;

const PanelContext = createContext<(p: Panel) => void>(() => undefined);
export const PanelProvider = PanelContext.Provider;

/** ワールドの中から地図や記録をひらくため */
export function useOpenPanel() {
  return useContext(PanelContext);
}
