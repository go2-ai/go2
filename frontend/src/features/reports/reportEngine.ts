import { createFontMeasurer, type FontRegistration, type TextMeasurer } from '@ariana-reports/react';
import { amountInWords, type CurrencyInput } from '../../utils/amountInWords';
import robotoRegular from '../../assets/fonts/roboto/Roboto-Regular.ttf';
import robotoBold from '../../assets/fonts/roboto/Roboto-Bold.ttf';
import robotoItalic from '../../assets/fonts/roboto/Roboto-Italic.ttf';
import robotoBoldItalic from '../../assets/fonts/roboto/Roboto-BoldItalic.ttf';

/**
 * Shared Ariana Reports setup: the fonts embedded in PDFs (and used to measure
 * text during layout) and the app functions available in template expressions.
 */

/** Families listed in the designer's font picker in addition to the standard PDF fonts. */
export const REPORT_FONT_FAMILIES = ['Roboto'];

// Bundled by Vite (src/assets), so the URLs work on whichever origin serves
// the frontend (the Vite dev server, or the built app with VITE_BASE_URL).
// The same files back the @font-face rules in styles/global.css, so the
// screen and the PDF use identical metrics.
const FONT_FILES: Array<Omit<FontRegistration, 'data'> & { url: string }> = [
  { family: 'Roboto', url: robotoRegular },
  { family: 'Roboto', bold: true, url: robotoBold },
  { family: 'Roboto', italic: true, url: robotoItalic },
  { family: 'Roboto', bold: true, italic: true, url: robotoBoldItalic },
];

// First four bytes of TrueType ("\0\x01\0\0", "true"), OpenType ("OTTO") and WOFF ("wOFF") files.
const FONT_SIGNATURES = ['00010000', '74727565', '4f54544f', '774f4646'];

const isFontFile = (data: ArrayBuffer): boolean => {
  const head = Array.from(new Uint8Array(data.slice(0, 4)), (b) => b.toString(16).padStart(2, '0')).join('');
  return FONT_SIGNATURES.includes(head);
};

export interface ReportFonts {
  fonts: FontRegistration[];
  measurer: TextMeasurer;
}

let fontsPromise: Promise<ReportFonts> | null = null;

/** Loads the report fonts once per page load. */
export const loadReportFonts = (): Promise<ReportFonts> => {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const fonts = await Promise.all(
        FONT_FILES.map(async ({ url, ...font }) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to load font ${url} (${response.status})`);
          const data = await response.arrayBuffer();
          // An SPA fallback answers missing files with index.html and status 200.
          if (!isFontFile(data)) {
            throw new Error(`${url} is not a font file (content type: ${response.headers.get('content-type')})`);
          }
          return { ...font, data };
        })
      );
      return { fonts, measurer: await createFontMeasurer(fonts) };
    })().catch((error) => {
      fontsPromise = null; // allow a retry
      throw error;
    });
  }
  return fontsPromise;
};

/**
 * Functions callable from template expressions, e.g.
 * {{ amountInWords(sum(rows, 'debit'), entry[0].currency) }}.
 * `locale` is the default language for functions that produce text.
 */
export const reportFunctions = (locale: string) => ({
  amountInWords: (amount: unknown, currency?: unknown, wordsLocale?: unknown) =>
    amountInWords(
      typeof amount === 'number' || typeof amount === 'string' ? amount : null,
      currency as CurrencyInput,
      typeof wordsLocale === 'string' ? wordsLocale : locale
    ),
});
