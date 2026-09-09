// src/components/tabs/tabActivation.ts
//
// Shared, pure helpers for tracking "most recently activated" order per
// panel, so that closing the active tab reactivates whichever tab you were
// on before it — not just the next one in open-order.

import type { Tab } from './types';

/** Removes ids that no longer correspond to an open tab. */
export function pruneHistory(history: string[], validIds: Set<string>): string[] {
  return history.filter((id) => validIds.has(id));
}

/** Moves (or adds) a tab id to the "most recent" end of the history stack. */
export function pushActivation(history: string[], tabId: string): string[] {
  return [...history.filter((id) => id !== tabId), tabId];
}

/**
 * Decides which tab should become active after `closedTabId` is closed.
 * Walks the activation history from most-recent to least-recent, skipping
 * the tab being closed, and returns the first entry that's still open.
 * Falls back to array order (legacy behavior) if history has nothing usable.
 */
export function getNextActiveTabId(
  currentTabs: Tab[],
  activationHistory: string[],
  closedTabId: string,
): string {
  const remaining = currentTabs.filter((t) => t.id !== closedTabId);
  if (remaining.length === 0) return '';

  const validIds = new Set(remaining.map((t) => t.id));

  for (let i = activationHistory.length - 1; i >= 0; i--) {
    const id = activationHistory[i];
    if (id !== closedTabId && validIds.has(id)) return id;
  }

  return remaining[remaining.length - 1].id;
}