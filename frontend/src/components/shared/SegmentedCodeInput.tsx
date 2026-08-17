import { useRef, useMemo } from 'react';
import { Box, TextField, Typography } from '@mui/material';

interface SegmentedCodeInputProps {
  /** Total number of segments */
  segments: number;
  /** Number of leading segments that are disabled (prefix). Default 0 */
  disabledPrefixSegments?: number;
  /** Full current code (may be shorter than segments count during typing) */
  value: string;
  /** Called with only the editable suffix (not the prefix) */
  onChange: (suffix: string) => void;
  /** Optional label */
  label?: string;
  /** Optional helper text / error */
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export const SegmentedCodeInput = ({
  segments,
  disabledPrefixSegments = 0,
  value,
  onChange,
  label,
  error = false,
  helperText,
  disabled = false,
  size = 'small',
}: SegmentedCodeInputProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const prefix = useMemo(
    () => value.slice(0, disabledPrefixSegments),
    [value, disabledPrefixSegments]
  );
  const suffix = useMemo(
    () => value.slice(disabledPrefixSegments),
    [value, disabledPrefixSegments]
  );

  const editableStart = disabledPrefixSegments;
  const editableCount = segments - disabledPrefixSegments;

  const focusEditableSegment = (editableIndex: number) => {
    const absoluteIndex = editableStart + editableIndex;
    if (absoluteIndex < 0 || absoluteIndex >= segments) return;
    inputRefs.current[absoluteIndex]?.focus();
  };

  const handleEditableChange = (
    editableIndex: number,
    rawValue: string
  ) => {
    const clean = rawValue.replace(/\D/g, '');
    const char = clean.charAt(0);

    const chars = suffix.padEnd(editableCount, '').split('');
    chars[editableIndex] = char;
    while (chars.length > 0 && chars[chars.length - 1] === '') {
      chars.pop();
    }
    const newSuffix = chars.join('');

    onChange(newSuffix);

    if (char && editableIndex < editableCount - 1) {
      focusEditableSegment(editableIndex + 1);
    }
  };

  const handleKeyDown = (
    editableIndex: number,
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    const currentChar = suffix[editableIndex] ?? '';

    if (e.key === 'Backspace' && currentChar === '' && editableIndex > 0) {
      focusEditableSegment(editableIndex - 1);
    }
  };

  return (
    <Box>
      {label && (
        <Typography
          variant="body2"
          sx={{
            mb: 1,
            color: error ? 'error.main' : 'text.secondary',
            fontWeight: 500,
          }}
        >
          {label}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1 }} dir="ltr">
        {Array.from({ length: segments }).map((_, absoluteIndex) => {
          const isDisabledSegment = absoluteIndex < disabledPrefixSegments;
          const editableIndex = absoluteIndex - editableStart;

          const inputStyle = {
            textAlign: 'center' as const,
            padding: '8px 0',
          };

          const fieldSx = {
            width: 40,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1,
              '& fieldset': {
                borderColor: error ? 'error.main' : 'divider',
              },
            },
            ...(absoluteIndex > 0 && {
              marginLeft: '-1px',
            }),
            '& .MuiInputBase-input': {
              padding: '8px 0',
              textAlign: 'center',
            },
          };

          if (isDisabledSegment) {
            return (
              <TextField
                key={absoluteIndex}
                value={prefix[absoluteIndex] ?? ''}
                disabled
                size={size}
                error={error}
                sx={fieldSx}
                inputProps={{
                  style: inputStyle,
                  'aria-label': `Segment ${absoluteIndex + 1}`,
                }}
              />
            );
          }

          return (
            <TextField
              key={absoluteIndex}
              value={suffix[editableIndex] ?? ''}
              onChange={(e) =>
                handleEditableChange(editableIndex, e.target.value)
              }
              onKeyDown={(e) => handleKeyDown(editableIndex, e)}
              disabled={disabled}
              size={size}
              error={error}
              inputRef={(el) => {
                inputRefs.current[absoluteIndex] = el;
              }}
              sx={fieldSx}
              inputProps={{
                maxLength: 1,
                inputMode: 'numeric',
                pattern: '[0-9]*',
                style: inputStyle,
                'aria-label': `Segment ${absoluteIndex + 1}`,
              }}
            />
          );
        })}
      </Box>

      {helperText && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: error ? 'error.main' : 'text.secondary',
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};