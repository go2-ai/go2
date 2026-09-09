import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ReportViewerProps {
  templateFile: string;
  data?: Record<string, any>;
  reportKey: string;
}

declare global {
  interface Window {
    Stimulsoft: any;
  }
}

const STIMULSOFT_BASE = import.meta.env.DEV
  ? 'http://localhost:5173'
  : '';

const STIMULSOFT_SCRIPTS = [
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.reports.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.viewer.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.designer.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.reports.export.js`,
  `${STIMULSOFT_BASE}/stimulsoft/Scripts/stimulsoft.reports.chart.js`,
];

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
};

export const ReportViewer = ({ templateFile, data, reportKey }: ReportViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      try {
        for (const src of STIMULSOFT_SCRIPTS) {
          await loadScript(src);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        if (disposed) {
          // Strict Mode's first, discarded effect run in dev — not an error.
          return;
        }

        if (!viewerRef.current) {
          console.error('Viewer ref still null after mount');
          setError('Viewer initialization failed');
          setLoading(false);
          return;
        }

        const Stimulsoft = window.Stimulsoft;

        const report = Stimulsoft.Report.StiReport.createNewReport();
        report.load(templateFile);

        if (data) {
          // The template's dictionary was originally built against a JSON
          // file connector (StiJsonDatabase). That connector derived two
          // data sources named 'root' (the top-level object) and
          // 'root_items' (an array property inside it). Every field/band
          // in the template is bound to those exact names — not to
          // `reportKey` — so we must register under 'root' regardless of
          // what reportKey is, or the fields stay bound to the dead file
          // connector and render blank.
          if (!('items' in data) && !Array.isArray(data)) {
            console.warn(
              `[ReportViewer] regData payload for report "${reportKey}" has no ` +
              `top-level "items" array. The template expects an object shaped ` +
              `like { items: [...], ...otherFields } so it can derive a ` +
              `"root_items" sub-table the same way the original JSON file did. ` +
              `Cells bound to root_items will likely render empty. Payload keys: ` +
              `${Object.keys(data).join(', ')}`
            );
          }
          console.log('regData payload:', JSON.stringify(data));

          report.regData('root', 'root', data);
        }

        // First arg is StiViewerOptions (or null), not a DOM node.
        const viewer = new Stimulsoft.Viewer.StiViewer(null, 'StiViewer', false);
        viewer.report = report;
        // renderHtml attaches to the DOM; render() alone does not.
        viewer.renderHtml(viewerRef.current);

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize Stimulsoft:', err);
        setError(`Failed to load report viewer: ${err}`);
        setLoading(false);
      }
    };

    initialize();

    return () => {
      disposed = true;
    };
  }, [templateFile, data, reportKey]);

  return (
    <Box sx={{ height: '100%', width: '100%'}}>
      <div ref={viewerRef} style={{ height: '100%', width: '100%' }} />

      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'background.paper',
            zIndex: 10,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'background.paper',
            zIndex: 10,
          }}
        >
          <Typography color="error">{error}</Typography>
        </Box>
      )}
    </Box>
  );
};