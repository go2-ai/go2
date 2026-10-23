import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useTranslation } from 'react-i18next';
import {
  parseDelimitedCells,
  type ClipboardContext,
  type PasteResult,
} from '../utils/clipboard';
import { parseImportCells, templateSheetColumns } from '../utils/rowsSheet';
import { locales } from '../../../../shared/constants/locales';
import {
  SPREADSHEET_ACCEPT,
  SpreadsheetError,
  downloadCsv,
  downloadExcel,
  readSpreadsheetFile,
  type SpreadsheetReadError,
} from '../../../../utils/spreadsheet';

export type ImportMode = 'append' | 'replace';

interface ImportRowsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Accounts, centers and currencies to match codes against; null while they load. */
  context: ClipboardContext | null;
  /** The entry already has rows with data (offers to replace them). */
  hasRows: boolean;
  /** Called with the rows of a read file; the dialog closes right after. */
  onImport: (result: PasteResult, mode: ImportMode) => void;
}

type ReadState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'error'; reason: SpreadsheetReadError | 'noRows' };

/**
 * Imports journal entry rows from an Excel or CSV file (a filled template or
 * an export, see utils/rowsSheet), after offering a template to fill. The
 * rows are imported as soon as a file is read; a file that can't be read
 * keeps the dialog open with the reason.
 */
export const ImportRowsDialog = ({ open, onClose, context, hasRows, onImport }: ImportRowsDialogProps) => {
  const { t: tJE, i18n } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const ti = (key: string, options?: Record<string, unknown>) => tJE(`rowsImport.${key}`, options);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ReadState>({ status: 'idle' });
  const [mode, setMode] = useState<ImportMode>('append');

  const centerLevels = context?.centerLevels ?? 0;
  const templateColumns = templateSheetColumns(centerLevels, tJE);
  const titles = templateColumns.map((column) => column.header);

  const handleClose = () => {
    setState({ status: 'idle' });
    setMode('append');
    onClose();
  };

  const handleExcelTemplate = () => {
    void downloadExcel({
      title: ti('templateName'),
      columns: templateColumns,
      rows: [],
      rtl: i18n.dir() === 'rtl',
    });
  };

  const handleCsvTemplate = () => downloadCsv(ti('templateName'), [titles]);

  const handleFile = async (file: File | undefined) => {
    if (!file || !context) return;
    setState({ status: 'reading' });
    try {
      const cells = await readSpreadsheetFile(file, parseDelimitedCells);
      // Column titles are recognized in every language of the app (a file
      // may come from a user who works in another language).
      const languages = locales.map((locale) => locale.code);
      await i18n.loadLanguages(languages);
      const translators = languages.map((lng) => i18n.getFixedT(lng, 'accounting'));
      const result = parseImportCells(cells, context, translators);
      if (result.rows.length === 0) {
        setState({ status: 'error', reason: 'noRows' });
        return;
      }
      onImport(result, hasRows ? mode : 'append');
      handleClose();
    } catch (err) {
      setState({ status: 'error', reason: err instanceof SpreadsheetError ? err.reason : 'unreadable' });
    } finally {
      // Choosing the same file again still triggers a change.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-labelledby="import-rows-title">
      <DialogTitle id="import-rows-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <UploadFileRoundedIcon color="primary" fontSize="small" />
        <Box sx={{ flex: 1 }}>{ti('title')}</Box>
        <IconButton size="small" onClick={handleClose} aria-label={t('commonActions.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
              {ti('step1')}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {ti('columns')}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
              {titles.join(' | ')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {ti('codesHelp')}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
                onClick={handleExcelTemplate}
                disabled={!context}
                sx={{ textTransform: 'none' }}
              >
                {ti('excelTemplate')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
                onClick={handleCsvTemplate}
                disabled={!context}
                sx={{ textTransform: 'none' }}
              >
                {ti('csvTemplate')}
              </Button>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
              {ti('step2')}
            </Typography>
            {hasRows && (
              <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as ImportMode)} sx={{ mb: 1 }}>
                <FormControlLabel
                  value="append"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">{ti('addRows')}</Typography>}
                />
                <FormControlLabel
                  value="replace"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">{ti('replaceRows')}</Typography>}
                />
              </RadioGroup>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={SPREADSHEET_ACCEPT}
              hidden
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <Button
              size="small"
              variant="contained"
              startIcon={<UploadFileRoundedIcon fontSize="small" />}
              onClick={() => inputRef.current?.click()}
              disabled={!context || state.status === 'reading'}
              sx={{ textTransform: 'none' }}
            >
              {ti('choose')}
            </Button>

            {state.status === 'error' && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {ti(`errors.${state.reason}`)}
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          {t('commonActions.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
