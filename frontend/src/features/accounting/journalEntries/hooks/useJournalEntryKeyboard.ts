// frontend/src/features/accounting/journalEntries/hooks/useJournalEntryKeyboard.ts
import { useEffect, useRef } from 'react';
import {
  closestCell,
  hasHighlightedOption,
  isPopupOpen,
  isTextEntry,
} from '../utils/gridNavigation';

export interface JournalEntryKeyboardActions {
  copyCellAbove: () => void;      // F4
  copyRowAbove: () => void;       // F3
  duplicateRows: () => void;      // F6
  balance: () => void;            // F8
  swapRate: () => void;           // F9
  swapDebitCredit: () => void;    // F10
  insertRow: () => void;          // Insert, Ctrl+Enter
  deleteRows: () => void;         // Delete (row mode), Ctrl+Delete
  undo: () => void;               // Ctrl+Z
  redo: () => void;               // Ctrl+Y, Ctrl+Shift+Z
  save: () => void;               // Ctrl+S
  saveDraft: () => void;          // Ctrl+Alt+S (Ctrl+Shift+S is Edge's web capture)
  openHelp: () => void;           // Ctrl+/
  openItems: () => void;          // F7: journal entry items of the row's account and centers
  moveVertical: (direction: 1 | -1, extendSelection: boolean) => void; // ↑ ↓ (Shift)
  moveHorizontal: (direction: 1 | -1) => void;                         // Enter, Shift+Enter
}

/** Pending (uncommitted) typing in the cell that holds `el`. */
const dirtyEditor = (el: Element | null): HTMLElement | null =>
  (el?.closest('[data-dirty="true"]') as HTMLElement | null) ?? null;

/**
 * Commits what is being typed in the focused cell (cells commit on blur) and
 * keeps the focus where it was, so a hotkey acts on the typed value.
 */
const commitFocusedCell = (el: Element | null) => {
  if (!(el instanceof HTMLElement) || !dirtyEditor(el)) return;
  el.blur();
  el.focus();
};

/**
 * Keyboard shortcuts of the journal entry editor.
 *
 * The listener is attached to the editor's root element (not the document):
 * every open journal entry tab stays mounted in the tab workspace, so a
 * document listener would apply a hotkey to all of them. Dialogs and popups
 * are rendered in portals outside the root, so they are naturally excluded.
 */
export const useJournalEntryKeyboard = (
  /** The editor root element (from a callback ref, so it can appear later). */
  root: HTMLElement | null,
  actions: JournalEntryKeyboardActions,
  enabled = true,
) => {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!root || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const a = actionsRef.current;
      const target = e.target as HTMLElement;
      const inCell = !!closestCell(target);
      const typing = isTextEntry(target);
      // Header fields (No, date, description) keep their native keys.
      const inHeaderField = typing && !inCell;
      const mod = e.ctrlKey || e.metaKey;

      const handle = (action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      };

      // Ctrl+Alt+S: save as draft. Skipped for AltGr (reported as Ctrl+Alt on
      // Windows), which some keyboard layouts use to type characters.
      if (mod && e.altKey && !e.shiftKey && e.code === 'KeyS' && !e.getModifierState('AltGraph')) {
        return handle(a.saveDraft);
      }

      if (mod && !e.altKey) {
        // Physical keys (e.code), so the shortcuts also work with a Persian
        // keyboard layout, where e.key would be e.g. "س" instead of "s".
        const key = ({ KeyS: 's', KeyZ: 'z', KeyY: 'y', Slash: '/' } as Record<string, string>)[e.code]
          ?? e.key.toLowerCase();
        // Ctrl+Shift+S is left to the browser (Edge web capture, Firefox screenshot)
        if (key === 's' && !e.shiftKey) return handle(a.save);
        if (key === '/') return handle(a.openHelp);
        if (key === 'z' || key === 'y') {
          // Let the browser undo uncommitted typing and header field edits.
          if (inHeaderField || dirtyEditor(target)) return;
          return handle(key === 'y' || e.shiftKey ? a.redo : a.undo);
        }
        if (e.key === 'Delete' && !inHeaderField) return handle(a.deleteRows);
        if (e.key === 'Enter' && !inHeaderField) return handle(a.insertRow);
        return;
      }

      const withCommit = (action: () => void) => handle(() => {
        commitFocusedCell(target);
        action();
      });

      switch (e.key) {
        case 'F3': return withCommit(a.copyRowAbove);
        case 'F4': return withCommit(a.copyCellAbove);
        case 'F6': return withCommit(a.duplicateRows);
        // Uses the committed row; also keeps Firefox's caret browsing (F7) off.
        case 'F7': return handle(a.openItems);
        case 'F8': return withCommit(a.balance);
        case 'F9': return withCommit(a.swapRate);
        case 'F10': return withCommit(a.swapDebitCredit);
        case 'Insert':
          if (inHeaderField) return;
          return handle(a.insertRow);
        case 'Delete':
          // In a cell Delete edits text; rows are deleted only in row mode
          // (a row header was clicked, so no cell has focus).
          if (inCell || typing) return;
          return handle(a.deleteRows);
        case 'ArrowUp':
        case 'ArrowDown': {
          if (e.altKey || inHeaderField) return;          // Alt+↓ opens a dropdown
          if (isPopupOpen(target)) return;                // move within the open list
          return handle(() => a.moveVertical(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey));
        }
        case 'Enter': {
          if (!inCell || e.altKey) return;
          if (hasHighlightedOption(target)) return;       // Enter picks the option
          return handle(() => a.moveHorizontal(e.shiftKey ? -1 : 1));
        }
      }
    };

    // Capture phase so the grid sees the key before inputs/selects react
    // to it (e.g. a closed Select would otherwise open on ArrowDown).
    root.addEventListener('keydown', handleKeyDown, true);
    return () => root.removeEventListener('keydown', handleKeyDown, true);
  }, [root, enabled]);
};
