import { createContext, useContext } from 'react';

export const TabIdContext = createContext<string | null>(null);

export function useCurrentTabId(): string | null {
  return useContext(TabIdContext);
}