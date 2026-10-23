import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { themeFromMui, type MuiThemeLike } from '@ariana-reports/react';
import { loadReportFonts, reportFunctions, type ReportFonts } from './reportEngine';

/**
 * Theme, UI language, fonts and functions shared by the report viewer and designer.
 * `reportLocale` (the template's language) is the default language of report
 * functions such as amountInWords; the viewer's UI follows the user's language.
 */
export const useReportSetup = (reportLocale?: string) => {
  const muiTheme = useTheme();
  const { i18n } = useTranslation();
  const language = i18n.language || 'en';
  const functionsLocale = reportLocale || language;

  // MUI's palette.grey type has no index signature, so it does not match
  // MuiThemeLike structurally; at runtime themeFromMui only reads plain values.
  const theme = useMemo(() => themeFromMui(muiTheme as unknown as MuiThemeLike), [muiTheme]);
  // Ariana has a built-in Persian UI (right to left); other languages use English.
  const uiLocale = language.startsWith('fa') ? 'fa' : undefined;
  const functions = useMemo(() => reportFunctions(functionsLocale), [functionsLocale]);

  const [fonts, setFonts] = useState<ReportFonts | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [fontsFailed, setFontsFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadReportFonts()
      .then((loaded) => {
        if (active) setFonts(loaded);
      })
      .catch((error) => {
        // Reports still render with the standard PDF fonts (Latin only).
        console.error('[reports] Failed to load report fonts:', error);
        if (active) setFontsFailed(true);
      })
      .finally(() => {
        if (active) setFontsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Families PDFs can't use, e.g. ['Yekan']; every family when nothing loaded.
  const missingFonts = fontsFailed ? ['*'] : (fonts?.failed ?? []);

  return { theme, uiLocale, functions, fonts, fontsReady, missingFonts };
};
