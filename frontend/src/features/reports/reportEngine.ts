import { createFontMeasurer, type FontRegistration, type TextMeasurer } from '@ariana-reports/react';
import { amountInWords, type CurrencyInput } from '../../utils/amountInWords';
import robotoRegular from '../../assets/fonts/roboto/Roboto-Regular.ttf';
import robotoBold from '../../assets/fonts/roboto/Roboto-Bold.ttf';
import robotoItalic from '../../assets/fonts/roboto/Roboto-Italic.ttf';
import robotoBoldItalic from '../../assets/fonts/roboto/Roboto-BoldItalic.ttf';
import vazirmatnRegular from '../../assets/fonts/vazirmatn/Vazirmatn-Regular.ttf';
import vazirmatnBold from '../../assets/fonts/vazirmatn/Vazirmatn-Bold.ttf';
import yekanRegular from '../../assets/fonts/yekan/Yekan-Regular.ttf';

/**
 * Shared Ariana Reports setup: the fonts embedded in PDFs (and used to measure
 * text during layout) and the app functions available in template expressions.
 */

/**
 * Families listed in the designer's font picker in addition to the standard PDF fonts.
 * Persian templates use "Yekan, Vazirmatn": Yekan (regular weight only, the
 * app's Persian UI font) with Vazirmatn for the characters Yekan lacks
 * (e.g. # $ & | ~).
 */
export const REPORT_FONT_FAMILIES = ['Roboto', 'Yekan', 'Vazirmatn'];

// Bundled by Vite (src/assets), so the URLs work on whichever origin serves
// the frontend (the Vite dev server, or the built app with VITE_BASE_URL).
// The same files back the @font-face rules in styles/global.css, so the
// screen and the PDF use identical metrics.
const FONT_FILES: Array<Omit<FontRegistration, 'data'> & { url: string }> = [
  { family: 'Roboto', url: robotoRegular },
  { family: 'Roboto', bold: true, url: robotoBold },
  { family: 'Roboto', italic: true, url: robotoItalic },
  { family: 'Roboto', bold: true, italic: true, url: robotoBoldItalic },
  { family: 'Vazirmatn', url: vazirmatnRegular },
  { family: 'Vazirmatn', bold: true, url: vazirmatnBold },
  // TrueType conversion of public/fonts/Yekan.woff2 (the PDF engine does not read WOFF2);
  // on screen the @font-face rule in styles/global.css serves the WOFF2 file.
  { family: 'Yekan', url: yekanRegular },
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
  /** Families of the files that could not be loaded (the others are used). */
  failed: string[];
}

const loadFontFile = async ({ url, ...font }: (typeof FONT_FILES)[number]): Promise<FontRegistration> => {
  // Resolved against this module's URL, not the page's: the page can be
  // served by another origin than the scripts and assets (Rails in development).
  const response = await fetch(new URL(url, import.meta.url));
  if (!response.ok) throw new Error(`Failed to load font ${url} (${response.status})`);
  const data = await response.arrayBuffer();
  // An SPA fallback answers missing files with index.html and status 200.
  if (!isFontFile(data)) {
    throw new Error(`${url} is not a font file (content type: ${response.headers.get('content-type')})`);
  }
  return { ...font, data };
};

let fontsPromise: Promise<ReportFonts> | null = null;

/**
 * Loads the report fonts once per page load. Files are loaded independently:
 * one that fails is reported in `failed` instead of dropping every font (PDFs
 * without registered fonts print non-Latin text as "?").
 */
export const loadReportFonts = (): Promise<ReportFonts> => {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const results = await Promise.allSettled(FONT_FILES.map(loadFontFile));
      const fonts: FontRegistration[] = [];
      const failed: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          fonts.push(result.value);
        } else {
          failed.push(FONT_FILES[index].family);
          console.error('[reports] Failed to load a report font:', result.reason);
        }
      });
      if (fonts.length === 0) throw new Error('No report font could be loaded');
      return { fonts, measurer: await createFontMeasurer(fonts), failed: [...new Set(failed)] };
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
