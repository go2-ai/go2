// frontend/src/features/accounting/journalEntries/components/cells/DescriptionCell.tsx
import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import MultiLocaleInput from '../../../../../components/shared/MultiLocaleInput';
import { useTranslatableLocales } from '../../../../../hooks/useTranslatableLocales';

interface DescriptionCellProps {
  value: Record<string, string>;
  organizationId: number;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * Keeps typing local and commits once when focus leaves the cell, so a whole
 * description is one undo step (instead of one per keystroke) and typing
 * doesn't re-render the grid. Changes made from the translations dialog
 * (focus is outside the cell then) are committed immediately.
 */
export const DescriptionCell = ({ value, organizationId, onChange, disabled }: DescriptionCellProps) => {
  const { primaryLocale, nonPrimaryLocales, isReady } = useTranslatableLocales({ organizationId });
  const boxRef = useRef<HTMLDivElement | null>(null);

  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  const lastValueRef = useRef(value);
  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    setDraft(value);
    setDirty(false);
  }, [value]);

  const focusInside = () => !!boxRef.current?.contains(document.activeElement);

  // Commit pending typing if the grid unmounts this editor before a blur.
  const pending = useRef({ dirty, draft, onChange });
  pending.current = { dirty, draft, onChange };
  useEffect(() => () => {
    const p = pending.current;
    if (p.dirty) p.onChange(p.draft);
  }, []);

  const handleChange = (next: Record<string, string>) => {
    if (!focusInside()) {
      setDraft(next);
      setDirty(false);
      onChange(next);
      return;
    }
    setDraft(next);
    setDirty(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (boxRef.current?.contains(e.relatedTarget as Node | null)) return;
    if (!dirty) return;
    setDirty(false);
    onChange(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && dirty) {
      e.preventDefault();
      setDraft(value);
      setDirty(false);
    }
  };

  if (!isReady) return null;

  return (
    <Box
      ref={boxRef}
      data-dirty={dirty ? 'true' : undefined}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      sx={{ height: '100%', width: '100%', px: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}
    >
      <MultiLocaleInput
        field="description"
        locale={primaryLocale}
        otherLocales={nonPrimaryLocales}
        value={draft}
        onChange={handleChange}
        disabled={disabled}
        dense
        fullWidth
        placeholder=""
      />
    </Box>
  );
};
