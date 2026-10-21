import type { Theme } from '@mui/material/styles';

// Tailwind "sky" shades for credit. Hue ≈200°: clearly apart from the green
// used for "Balanced"/success/gain (≈123°) and the indigo primary (≈240°).
const SKY_700 = '#0369A1';
const SKY_400 = '#38BDF8';
// Tailwind "pink" shades for debit (hue ≈330°), so a debit amount isn't read
// as an error or a loss (red).
const PINK_600 = '#DB2777';
const PINK_400 = '#F472B6';

/**
 * Text colors for debit and credit amounts.
 *
 * Contrast against the paper background: sky 700 on #FFFFFF ≈ 5.9:1, sky 400
 * on #14141F ≈ 8.5:1, pink 600 on #FFFFFF ≈ 4.6:1 and pink 400 on #14141F
 * ≈ 6.9:1, all above the WCAG AA 4.5:1 minimum for normal text.
 */
export const creditColor = (theme: Theme): string =>
  theme.palette.mode === 'dark' ? SKY_400 : SKY_700;

export const debitColor = (theme: Theme): string =>
  theme.palette.mode === 'dark' ? PINK_400 : PINK_600;
