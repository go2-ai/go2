import { useMemo } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ReportViewer as ArianaReportViewer } from '@ariana-reports/react';
import { useReportSetup } from '../useReportSetup';
import { useToast } from '../../../contexts/ToastContext';

interface ReportViewerProps {
  /** Ariana Reports template (JSON text). */
  templateFile: string;
  /** Report data, e.g. { root: journalEntry }. */
  data?: unknown;
  /** Used as the PDF title and download file name. */
  title?: string;
  /** Language of the template: default language of functions such as amountInWords. */
  locale?: string;
}

export const ReportViewer = ({ templateFile, data, title, locale }: ReportViewerProps) => {
  const { t } = useTranslation('reports');
  const { showWarning } = useToast();
  const { theme, uiLocale, functions, fonts, fontsReady, missingFonts } = useReportSetup(locale);

  // The PDF export reports characters no registered font can draw (they print as "?").
  const pdf = useMemo(
    () => ({
      fonts: fonts?.fonts,
      title,
      onWarning: (message: string) => {
        console.warn('[reports] PDF export:', message);
        showWarning(t('pdfMissingCharacters'));
      },
    }),
    [fonts, title, showWarning, t]
  );

  if (!fontsReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {missingFonts.length > 0 && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          {missingFonts.includes('*')
            ? t('fontsNotLoaded')
            : t('someFontsNotLoaded', { fonts: missingFonts.join(', ') })}
        </Alert>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ArianaReportViewer
          template={templateFile}
          data={data ?? {}}
          functions={functions}
          measurer={fonts?.measurer}
          pdf={pdf}
          theme={theme}
          uiLocale={uiLocale}
          zoomMode="fitWidth"
          onError={(error) => console.error('[reports] Failed to generate report:', error)}
        />
      </Box>
    </Box>
  );
};
