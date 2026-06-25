import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { getFontFamily } from './fonts';

export type ThemeMode = 'light' | 'dark';

export const createAppTheme = (locale: string = 'en', mode: ThemeMode = 'light'): Theme => {
  const fontFamily = getFontFamily(locale);
  const isDark = mode === 'dark';
  const isRtl = locale === 'fa' || locale === 'ar';

  return createTheme({
    direction: isRtl ? 'rtl' : 'ltr',
    palette: {
      mode,
      primary: {
        main: isDark ? '#818CF8' : '#4F46E5',     // Indigo 400 / 600
        light: isDark ? '#A5B4FC' : '#6366F1',    // Indigo 300 / 500
        dark: isDark ? '#6366F1' : '#3730A3',     // Indigo 500 / 700
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#C084FC' : '#7C3AED',     // Violet 400 / 600
        light: isDark ? '#D8B4FE' : '#8B5CF6',
        dark: isDark ? '#A855F7' : '#6D28D9',
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#0F0F1A' : '#F5F5FF',
        paper: isDark ? '#16162A' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#EEF2FF' : '#1E1B4B',
        secondary: isDark ? '#A5B4FC' : '#6366F1',
      },
      divider: isDark ? '#2D2D52' : '#E0E7FF',
    },
    typography: {
      fontFamily,
      ...(locale === 'fa' && {
        fontSize: 14,
        h4: { fontSize: '2rem', fontWeight: 600 },
        body1: { fontSize: '1rem', lineHeight: 1.8 },
      }),
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 600,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: isDark ? '1px solid #2D2D52' : '1px solid #E0E7FF',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiInputBase-input': { fontFamily },
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: { fontFamily },
        },
      },
    },
  });
};

export const defaultTheme = createAppTheme('en', 'light');