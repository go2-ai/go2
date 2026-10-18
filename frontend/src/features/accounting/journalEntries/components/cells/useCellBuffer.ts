import { useEffect, useRef, useState } from 'react';

interface UseCellBufferOptions {
  value: number | null;
  /** Text shown while the cell is focused (raw, no separators). */
  toEditText: (value: number | null) => string;
  /** Returns false for keystrokes that would make the text invalid. */
  isValidPartial: (raw: string) => boolean;
  /** Converts the final text into the committed value. */
  parse: (raw: string) => number | null;
  onCommit: (value: number | null) => void;
  /** Fired on the first keystroke that produces a non-empty value. */
  onTypingStart?: () => void;
}

/**
 * Local editing buffer for numeric grid cells.
 *
 * - Typing only changes the local buffer; the value is committed on blur and
 *   only if the user actually edited the cell. Committing an unchanged value
 *   would re-run the debit/rate/amount recalculation and undo changes made
 *   by hotkeys (that is why F9 appeared to do nothing).
 * - When the value changes from outside (hotkeys, undo, paste) the buffer
 *   follows it, even while the cell is focused.
 * - Escape discards the uncommitted typing.
 * - Typing that is still pending when the editor unmounts is committed.
 * - `dirty` is exposed as `data-dirty` on the input so editor-level shortcuts
 *   (Ctrl+Z, row actions) can tell whether there is uncommitted typing.
 */
export const useCellBuffer = ({
  value,
  toEditText,
  isValidPartial,
  parse,
  onCommit,
  onTypingStart,
}: UseCellBufferOptions) => {
  const [isFocused, setIsFocused] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [buffer, setBuffer] = useState<string>(() => toEditText(value));

  const lastValueRef = useRef(value);
  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    setBuffer(toEditText(value));
    setDirty(false);
    // toEditText is a pure formatter; only value changes matter here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setBuffer(toEditText(value));
    setDirty(false);
    const input = e.target;
    requestAnimationFrame(() => input.select());
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!isValidPartial(raw)) return;
    if (raw !== '') onTypingStart?.();
    setBuffer(raw);
    setDirty(true);
  };

  const onBlur = () => {
    setIsFocused(false);
    if (!dirty) return;
    setDirty(false);
    onCommit(parse(buffer));
  };

  // The grid unmounts the editor when another cell becomes active, possibly
  // before a blur happens; don't lose what was typed.
  const pending = useRef({ dirty, buffer, parse, onCommit });
  pending.current = { dirty, buffer, parse, onCommit };
  useEffect(() => () => {
    const p = pending.current;
    if (p.dirty) p.onCommit(p.parse(p.buffer));
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && dirty) {
      e.preventDefault();
      setBuffer(toEditText(value));
      setDirty(false);
    }
  };

  return {
    isFocused,
    dirty,
    buffer,
    handlers: { onFocus, onChange, onBlur, onKeyDown },
    dirtyAttr: { 'data-dirty': dirty ? 'true' : undefined },
  };
};

export const parseNumericText = (raw: string): number | null => {
  if (raw === '' || raw === '-') return null;
  const num = parseFloat(raw);
  return isNaN(num) ? null : num;
};
