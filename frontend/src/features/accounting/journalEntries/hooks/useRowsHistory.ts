import { useCallback, useEffect, useRef, useState } from 'react';

const HISTORY_LIMIT = 100;

/**
 * State holder for the grid rows with undo/redo.
 *
 * Every committed change to `rows` becomes one undo step; recording happens
 * in an effect (not inside state updaters) so it is safe under StrictMode and
 * batching. Snapshots are the immutable row arrays themselves, so this is
 * cheap.
 */
export const useRowsHistory = <T>(initial: T[] = []) => {
  const [rows, setRows] = useState<T[]>(initial);

  const past = useRef<T[][]>([]);
  const future = useRef<T[][]>([]);
  const committed = useRef<T[]>(rows);
  // A rows array produced by undo/redo/reset; not recorded.
  const unrecorded = useRef<T[] | null>(null);
  // Rows of the latest render.
  const latest = useRef(rows);
  latest.current = rows;

  useEffect(() => {
    if (rows === committed.current) return;
    if (rows === unrecorded.current) {
      unrecorded.current = null;
    } else {
      past.current.push(committed.current);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
    }
    committed.current = rows;
  }, [rows]);

  const apply = useCallback((next: T[]) => {
    unrecorded.current = next;
    setRows(next);
  }, []);

  const undo = useCallback((): boolean => {
    const previous = past.current.pop();
    if (!previous) return false;
    future.current.push(committed.current);
    apply(previous);
    return true;
  }, [apply]);

  const redo = useCallback((): boolean => {
    const next = future.current.pop();
    if (!next) return false;
    past.current.push(committed.current);
    apply(next);
    return true;
  }, [apply]);

  /** Replaces the rows and forgets the history (e.g. after loading). */
  const reset = useCallback((next: T[]) => {
    past.current = [];
    future.current = [];
    apply(next);
  }, [apply]);

  /** Updates rows without creating an undo step (e.g. ids from the server). */
  // Computed from the latest rendered rows (not inside a state updater, which
  // must stay pure). Only use when no other row update is pending.
  const setRowsSilently = useCallback((update: (prev: T[]) => T[]) => {
    const next = update(latest.current);
    if (next === latest.current) return;
    apply(next);
  }, [apply]);

  return { rows, setRows, undo, redo, reset, setRowsSilently };
};
