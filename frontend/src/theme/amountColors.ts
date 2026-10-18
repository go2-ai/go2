import type { Theme } from '@mui/material/styles';

// Tailwind "sky" shades. Hue ≈200°: clearly apart from the green used for
// "Balanced"/success (≈123°), the indigo primary (≈240°) and the red debit.
const SKY_700 = '#0369A1';
const SKY_400 = '#38BDF8';

/**
 * Text colors for debit and credit amounts.
 *
 * Contrast against the paper background: sky 700 on #FFFFFF ≈ 5.9:1 and
 * sky 400 on #14141F ≈ 8.5:1, both above the WCAG AA 4.5:1 minimum for
 * normal text.
 */
export const creditColor = (theme: Theme): string =>
  theme.palette.mode === 'dark' ? SKY_400 : SKY_700;

export const debitColor = (theme: Theme): string => theme.palette.error.main;
