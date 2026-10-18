// DOM helpers for keyboard navigation in the journal entry grid. Cells are
// marked by EditableGrid with data-grid-cell / data-row-id / data-col-key.
import { CELL_FOCUSABLE_SELECTOR, GRID_CELL_ATTR } from '../../../../components/editableGrid/types';

// Inactive cells only show a focusable read-only view; focusing it makes the
// grid mount the real editor, which then takes the focus.
const FOCUSABLE = CELL_FOCUSABLE_SELECTOR;

export const cellSelector = (rowId: string, colKey: string) =>
  `[${GRID_CELL_ATTR}][data-row-id="${CSS.escape(rowId)}"][data-col-key="${CSS.escape(colKey)}"]`;

/** The grid cell that contains `el`, if any. */
export const closestCell = (el: Element | null): HTMLElement | null =>
  (el?.closest(`[${GRID_CELL_ATTR}]`) as HTMLElement | null) ?? null;

export const focusableInCell = (cell: Element | null): HTMLElement | null =>
  (cell?.querySelector(FOCUSABLE) as HTMLElement | null) ?? null;

/** True when the element accepts typed text (so plain keys must not be hijacked). */
export const isTextEntry = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color'].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable;
};

/** True when an autocomplete/select popup belonging to `el` is open. */
export const isPopupOpen = (el: Element | null): boolean =>
  el?.getAttribute('aria-expanded') === 'true';

/** True when the open popup has a highlighted option that Enter would pick. */
export const hasHighlightedOption = (el: Element | null): boolean =>
  isPopupOpen(el) && !!el?.getAttribute('aria-activedescendant');

/** Column keys of a row in on-screen order. */
export const rowColumnKeys = (root: HTMLElement, rowId: string): string[] =>
  Array.from(root.querySelectorAll(`[${GRID_CELL_ATTR}][data-row-id="${CSS.escape(rowId)}"]`))
    .map(el => (el as HTMLElement).dataset.colKey ?? '')
    .filter(Boolean);

/** Columns of a rendered row that currently have something to focus. */
export const editableColumnKeys = (root: HTMLElement, rowId: string): string[] =>
  rowColumnKeys(root, rowId).filter(key => !!focusableInCell(root.querySelector(cellSelector(rowId, key))));

/**
 * Focuses the cell's input once it is rendered (it may first need to be
 * scrolled into the virtualized viewport). Falls back to focusing the row so
 * keyboard shortcuts keep working on disabled cells.
 */
export const focusCellWhenRendered = (
  root: HTMLElement,
  rowId: string,
  colKey: string,
  attempts = 6,
) => {
  const tryFocus = (left: number) => {
    const cell = root.querySelector(cellSelector(rowId, colKey));
    if (cell) {
      const target = focusableInCell(cell);
      if (target) {
        target.focus({ preventScroll: false });
        if (target instanceof HTMLInputElement && isTextEntry(target)) target.select();
      } else {
        const rowEl = root.querySelector(`[data-grid-row="${CSS.escape(rowId)}"]`) as HTMLElement | null;
        rowEl?.focus({ preventScroll: true });
      }
      return;
    }
    if (left > 0) requestAnimationFrame(() => tryFocus(left - 1));
  };
  requestAnimationFrame(() => tryFocus(attempts));
};
