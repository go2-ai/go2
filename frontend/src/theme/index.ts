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
        main: isDark ? '#6366F1' : '#4F46E5',     // Indigo 500 / 600
        light: isDark ? '#A5B4FC' : '#6366F1',    // Indigo 300 / 500
        dark: isDark ? '#4F46E5' : '#3730A3',     // Indigo 600 / 700
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#94A3B8' : '#64748B',     // Slate 400 / 500 - subtle contrast
        light: isDark ? '#CBD5E1' : '#94A3B8',    // Slate 300 / 400
        dark: isDark ? '#64748B' : '#475569',     // Slate 500 / 600
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#0A0A0F' : '#F8FAFC',
        paper: isDark ? '#14141F' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F8FAFC' : '#0F172A',
        secondary: isDark ? '#94A3B8' : '#475569',
      },
      divider: isDark ? '#1E1E32' : '#E2E8F0',
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
            fontWeight: 500,
            borderRadius: 8,
            ...(isDark && {
              '&:hover': {
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)',
              },
            }),
          },
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: {
              background: isDark 
                ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                : undefined,
            },
          },
        ],
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            background: isDark ? '#14141F' : '#FFFFFF',
            border: isDark ? '1px solid #1E1E32' : '1px solid #E2E8F0',
            boxShadow: isDark 
              ? '0 4px 24px rgba(99, 102, 241, 0.08)'
              : '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: isDark ? '#6366F1' : '#6366F1',
              boxShadow: isDark 
                ? '0 8px 32px rgba(99, 102, 241, 0.15)'
                : '0 4px 12px rgba(99, 102, 241, 0.1)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            ...(isDark && {
              background: 'rgba(20, 20, 31, 0.9)',
              backdropFilter: 'blur(12px)',
            }),
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
      MuiAppBar: {
        styleOverrides: {
          root: {
            ...(isDark && {
              background: 'rgba(20, 20, 31, 0.8)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid #1E1E32',
            }),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            ...(isDark && {
              background: 'rgba(20, 20, 31, 0.95)',
              backdropFilter: 'blur(12px)',
              borderRight: '1px solid #1E1E32',
            }),
          },
        },
      },
    },
  });
};

export const defaultTheme = createAppTheme('en', 'light');