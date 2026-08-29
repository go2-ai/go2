// frontend/src/components/shared/MultiLocaleInput.tsx
import React, { useState } from "react";
import {
  Box,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Tooltip,
  Chip,
  Stack,
  InputAdornment,
  Divider,
  alpha,
} from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from 'react-i18next';
import { useTranslatableLocales } from '../../hooks/useTranslatableLocales';
import type { LocaleMap } from '../../utils/translationHelper';

interface TranslatableInputProps {
  /** The field name used as the label and for building the value object key */
  field: string;
  /** Primary locale (always shown inline). Defaults to the current user's locale. */
  locale?: string;
  /** Additional locales that open the translation modal. Defaults to the organization's default and active locales minus the user's locale. */
  otherLocales?: string[];
  /** Controlled value – a map of locale → string */
  value?: LocaleMap;
  /** Called whenever any locale value changes */
  onChange?: (value: LocaleMap) => void;
  /** Optional placeholder for the primary input */
  placeholder?: string;
  /** Pass-through to the underlying TextField */
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  /**
   * Compact mode for dense grid cells. Removes the label, helper text,
   * underline, and vertical padding so the control fits a ~36-40px row
   * while preserving the translation modal behavior.
   */
  dense?: boolean;
}

function localeLabel(code: string): string {
  try {
    return new Intl.DisplayNames([code, "en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** Counts how many of the other locales have non-empty values */
function filledCount(map: LocaleMap, locales: string[]): number {
  return locales.filter((l) => !!map[l]?.trim()).length;
}

const MultiLocaleInput: React.FC<TranslatableInputProps> = ({
  field,
  locale,
  otherLocales,
  value = {},
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error = false,
  helperText,
  fullWidth = true,
  dense = false,
}) => {
  const label = field.charAt(0).toUpperCase() + field.slice(1);
  const { t } = useTranslation('shared');
  const {
    primaryLocale,
    nonPrimaryLocales,
  } = useTranslatableLocales({ locale, otherLocales });
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<LocaleMap>({});

  const hasOtherLocales = nonPrimaryLocales.length > 0;
  const filled = hasOtherLocales ? filledCount(value, nonPrimaryLocales) : 0;

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.({ ...value, [primaryLocale]: e.target.value });
  };

  const openModal = () => {
    setDraft({ ...value });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleDraftChange = (loc: string, val: string) => {
    setDraft((prev) => ({ ...prev, [loc]: val }));
  };

  const handleSave = () => {
    onChange?.({ ...draft });
    setModalOpen(false);
  };

  return (
    <>
      <TextField
        label={dense ? undefined : label}
        value={value[primaryLocale] ?? ""}
        onChange={handlePrimaryChange}
        placeholder={placeholder}
        disabled={disabled}
        required={!dense && required}
        error={error}
        helperText={dense ? undefined : helperText}
        fullWidth={fullWidth}
        size={dense ? undefined : "small"}
        variant={dense ? "standard" : "outlined"}
        sx={
          dense
            ? {
                height: '100%',
                '& .MuiInputBase-root': {
                  height: '100%',
                  py: 0,
                  backgroundColor: disabled ? 'action.disabledBackground' : 'transparent',
                },
                '& .MuiInputBase-input': {
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  py: 0,
                  px: 0,
                },
              }
            : undefined
        }
        InputProps={
          hasOtherLocales
            ? {
                ...(dense && { disableUnderline: true }),
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Add translations" placement="top">
                      <span>
                        <IconButton
                          size="small"
                          onClick={openModal}
                          disabled={disabled}
                          color={filled === nonPrimaryLocales.length ? "success" : "default"}
                          sx={{
                            transition: "background 0.15s",
                            "&:hover": {
                              background: (theme) => alpha(theme.palette.primary.main, 0.08),
                            },
                          }}
                        >
                          <TranslateIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              }
            : dense
              ? { disableUnderline: true }
              : undefined
        }
      />

      {hasOtherLocales && (
        <Dialog
          open={modalOpen}
          onClose={closeModal}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
            },
          }}
        >
          {/* Header */}
          <DialogTitle
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pb: 1,
              pr: 1.5,
            }}
          >
            <TranslateIcon color="primary" fontSize="small" />
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                {t('components.MultiLocaleInput.title', { field: label })}
              </Typography>
            </Box>
            <IconButton size="small" onClick={closeModal} sx={{ ml: "auto" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <Divider />

          <DialogContent sx={{ pt: 2.5, pb: 1 }}>
            <Stack spacing={2.5}>
              {/* Primary locale (read-only preview) */}
              <Box>
                <Stack direction="row" alignItems="center" gap={1} mb={0.75}>
                  <Chip
                    label={primaryLocale.toUpperCase()}
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 700, letterSpacing: 0.5 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {localeLabel(primaryLocale)}
                  </Typography>
                </Stack>
                <TextField
                  fullWidth
                  size="small"
                  value={draft[primaryLocale] ?? ""}
                  onChange={(e) => handleDraftChange(primaryLocale, e.target.value)}
                />
              </Box>

              {nonPrimaryLocales.map((loc) => (
                <Box key={loc}>
                  <Stack direction="row" alignItems="center" gap={1} mb={0.75}>
                    <Chip
                      label={loc.toUpperCase()}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight:700, letterSpacing: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {localeLabel(loc)}
                    </Typography>
                  </Stack>
                  <TextField
                    fullWidth
                    size="small"
                    value={draft[loc] ?? ""}
                    onChange={(e) => handleDraftChange(loc, e.target.value)}
                  />
                </Box>
              ))}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={closeModal}>
              {t('commonActions.cancel')}
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleSave}
            >
              {t('commonActions.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default MultiLocaleInput;