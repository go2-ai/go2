import { useMemo } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { ReportViewer as ArianaReportViewer } from '@ariana-reports/react';
import { useReportSetup } from '../useReportSetup';

interface ReportViewerProps {
  /** Ariana Reports template (JSON text). */
  templateFile: string;
  /** Report data, e.g. { root: journalEntry }. */
  data?: unknown;
  /** Used as the PDF title and download file name. */
  title?: string;
}

export const ReportViewer = ({ templateFile, data, title }: ReportViewerProps) => {
  const { theme, uiLocale, functions, fonts, fontsReady } = useReportSetup();

  const pdf = useMemo(() => ({ fonts: fonts?.fonts, title }), [fonts, title]);

  if (!fontsReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
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
  );
};
