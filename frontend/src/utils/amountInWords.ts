import i18n from '../i18n';

/**
 * Amounts and numbers in words, in English and Persian.
 *
 *   amountInWords(1234.5, 'USD', 'en')  // "One Thousand Two Hundred Thirty-Four Dollars and Fifty Cents"
 *   amountInWords(1250000, 'IRR', 'fa') // "یک میلیون و دویست و پنجاه هزار ریال"
 *   amountInWords(12.5, { abr: 'USD', names: { fa: 'دلار' }, decimal_digits: 2 }) // current app language
 *
 * Also available in report templates as {{ amountInWords(amount, currency, locale?) }}.
 */

/**
 * A currency code ("USD") or a currency record, e.g. the `currency` of the
 * journal entry print data. Unit names come from the built-in list for known
 * codes, otherwise from `names[locale]`, `name` or the code.
 */
export type CurrencyInput =
  | string
  | {
      abr?: string | null;
      /** Name in the language of the request that loaded it. */
      name?: string | null;
      /** Translated names: { en: 'US Dollar', fa: 'دلار' }. */
      names?: Record<string, string | null | undefined> | null;
      decimal_digits?: number | null;
    }
  | null
  | undefined;

type WordsLocale = 'en' | 'fa';

interface UnitNames {
  /** English: [singular, plural]. Persian: [name]. */
  major: string[];
  minor?: string[];
}

interface KnownCurrency {
  decimals: number;
  en: UnitNames;
  fa: UnitNames;
}

// Unit names and decimals for common currencies, by ISO code.
const KNOWN_CURRENCIES: Record<string, KnownCurrency> = {
  USD: { decimals: 2, en: { major: ['Dollar', 'Dollars'], minor: ['Cent', 'Cents'] }, fa: { major: ['دلار'], minor: ['سنت'] } },
  CAD: { decimals: 2, en: { major: ['Canadian Dollar', 'Canadian Dollars'], minor: ['Cent', 'Cents'] }, fa: { major: ['دلار کانادا'], minor: ['سنت'] } },
  AUD: { decimals: 2, en: { major: ['Australian Dollar', 'Australian Dollars'], minor: ['Cent', 'Cents'] }, fa: { major: ['دلار استرالیا'], minor: ['سنت'] } },
  EUR: { decimals: 2, en: { major: ['Euro', 'Euros'], minor: ['Cent', 'Cents'] }, fa: { major: ['یورو'], minor: ['سنت'] } },
  GBP: { decimals: 2, en: { major: ['Pound', 'Pounds'], minor: ['Penny', 'Pence'] }, fa: { major: ['پوند'], minor: ['پنی'] } },
  CHF: { decimals: 2, en: { major: ['Swiss Franc', 'Swiss Francs'], minor: ['Centime', 'Centimes'] }, fa: { major: ['فرانک سوئیس'], minor: ['سانتیم'] } },
  CNY: { decimals: 2, en: { major: ['Yuan', 'Yuan'], minor: ['Fen', 'Fen'] }, fa: { major: ['یوان'], minor: ['فن'] } },
  JPY: { decimals: 0, en: { major: ['Yen', 'Yen'] }, fa: { major: ['ین'] } },
  RUB: { decimals: 2, en: { major: ['Ruble', 'Rubles'], minor: ['Kopek', 'Kopeks'] }, fa: { major: ['روبل'], minor: ['کوپک'] } },
  TRY: { decimals: 2, en: { major: ['Lira', 'Lira'], minor: ['Kurus', 'Kurus'] }, fa: { major: ['لیر'], minor: ['کوروش'] } },
  INR: { decimals: 2, en: { major: ['Rupee', 'Rupees'], minor: ['Paisa', 'Paise'] }, fa: { major: ['روپیه'], minor: ['پیسه'] } },
  AED: { decimals: 2, en: { major: ['Dirham', 'Dirhams'], minor: ['Fils', 'Fils'] }, fa: { major: ['درهم'], minor: ['فلس'] } },
  SAR: { decimals: 2, en: { major: ['Riyal', 'Riyals'], minor: ['Halala', 'Halalas'] }, fa: { major: ['ریال سعودی'], minor: ['هلله'] } },
  QAR: { decimals: 2, en: { major: ['Riyal', 'Riyals'], minor: ['Dirham', 'Dirhams'] }, fa: { major: ['ریال قطر'], minor: ['درهم'] } },
  OMR: { decimals: 3, en: { major: ['Rial', 'Rials'], minor: ['Baisa', 'Baisa'] }, fa: { major: ['ریال عمان'], minor: ['بیسه'] } },
  KWD: { decimals: 3, en: { major: ['Dinar', 'Dinars'], minor: ['Fils', 'Fils'] }, fa: { major: ['دینار کویت'], minor: ['فلس'] } },
  IQD: { decimals: 3, en: { major: ['Dinar', 'Dinars'], minor: ['Fils', 'Fils'] }, fa: { major: ['دینار عراق'], minor: ['فلس'] } },
  AFN: { decimals: 2, en: { major: ['Afghani', 'Afghanis'], minor: ['Pul', 'Puls'] }, fa: { major: ['افغانی'], minor: ['پول'] } },
  IRR: { decimals: 0, en: { major: ['Rial', 'Rials'] }, fa: { major: ['ریال'] } },
  IRT: { decimals: 0, en: { major: ['Toman', 'Tomans'] }, fa: { major: ['تومان'] } },
};

// ── English ────────────────────────────────────────────────────────────────

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const EN_SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion', 'Quintillion', 'Sextillion'];

const enBelowThousand = (n: number): string => {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${EN_ONES[hundreds]} Hundred`);
  if (rest >= 20) {
    parts.push(rest % 10 ? `${EN_TENS[Math.floor(rest / 10)]}-${EN_ONES[rest % 10]}` : EN_TENS[Math.floor(rest / 10)]);
  } else if (rest) {
    parts.push(EN_ONES[rest]);
  }
  return parts.join(' ');
};

// ── Persian ────────────────────────────────────────────────────────────────

const FA_ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده',
  'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const FA_TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const FA_HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const FA_SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'کوادریلیون', 'کوینتیلیون', 'سکستیلیون'];
const FA_AND = ' و ';

const faBelowThousand = (n: number): string => {
  const parts: string[] = [];
  const rest = n % 100;
  if (n >= 100) parts.push(FA_HUNDREDS[Math.floor(n / 100)]);
  if (rest >= 20) {
    parts.push(FA_TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(FA_ONES[rest % 10]);
  } else if (rest) {
    parts.push(FA_ONES[rest]);
  }
  return parts.join(FA_AND);
};

// ── Shared ─────────────────────────────────────────────────────────────────

const WORDS = {
  en: { zero: 'Zero', minus: 'Minus', and: ' and ', groupJoin: ' ', belowThousand: enBelowThousand, scales: EN_SCALES },
  fa: { zero: 'صفر', minus: 'منفی', and: FA_AND, groupJoin: FA_AND, belowThousand: faBelowThousand, scales: FA_SCALES },
} as const;

const resolveLocale = (locale?: string | null): WordsLocale => {
  const code = (locale || i18n.language || 'en').toLowerCase().split(/[-_]/)[0];
  return code === 'fa' ? 'fa' : 'en';
};

/** Integer in words. Fractions are truncated; use amountInWords for money. */
export const numberToWords = (value: number | bigint, locale?: string | null): string => {
  const lang = resolveLocale(locale);
  const words = WORDS[lang];

  let n: bigint;
  if (typeof value === 'bigint') {
    n = value;
  } else {
    if (!Number.isFinite(value)) return '';
    n = BigInt(Math.trunc(value));
  }

  if (n === 0n) return words.zero;
  const negative = n < 0n;
  if (negative) n = -n;

  const groups: string[] = [];
  let scale = 0;
  while (n > 0n) {
    const group = Number(n % 1000n);
    if (group) {
      if (scale >= words.scales.length) return ''; // larger than supported
      const text = words.belowThousand(group);
      groups.unshift(scale ? `${text} ${words.scales[scale]}` : text);
    }
    n /= 1000n;
    scale += 1;
  }

  const text = groups.join(words.groupJoin);
  return negative ? `${words.minus} ${text}` : text;
};

const currencyCode = (currency: CurrencyInput): string =>
  (typeof currency === 'string' ? currency : currency?.abr || '').trim().toUpperCase();

// Known currencies use the built-in names (they have correct singular/plural
// forms); other currencies use their translated name, then name, then code.
const majorName = (currency: CurrencyInput, lang: WordsLocale, count: bigint): string => {
  const known = KNOWN_CURRENCIES[currencyCode(currency)]?.[lang].major;
  if (known) return known[count === 1n ? 0 : known.length - 1];

  if (typeof currency === 'object' && currency) {
    const translated = currency.names?.[lang];
    if (translated) return translated;
    if (currency.name) return currency.name;
  }
  return currencyCode(currency);
};

/** Minor part when the currency's minor unit name is unknown: "and 50/100", "و پنجاه صدم". */
const fractionWords = (minor: number, decimals: number, lang: WordsLocale): string => {
  if (lang === 'fa') {
    const denominators: Record<number, string> = { 1: 'دهم', 2: 'صدم', 3: 'هزارم' };
    const denominator = denominators[decimals];
    if (denominator) return `${numberToWords(minor, lang)} ${denominator}`;
  }
  return `${String(minor).padStart(decimals, '0')}/${10 ** decimals}`;
};

/**
 * An amount of money in words.
 *
 * @param amount   Number (or numeric string). Rounded to the currency's decimals.
 * @param currency Currency code ("USD") or currency record ({ abr, name, names, decimal_digits }).
 *                 Optional: without it only the number is written out.
 * @param locale   "en" or "fa" (also "fa-IR" etc.). Defaults to the current app language.
 *                 Other languages fall back to English.
 */
export const amountInWords = (
  amount: number | string | null | undefined,
  currency?: CurrencyInput,
  locale?: string | null
): string => {
  const value = typeof amount === 'string' ? Number(amount.replace(/,/g, '')) : amount;
  if (value == null || !Number.isFinite(value)) return '';

  const lang = resolveLocale(locale);
  const words = WORDS[lang];
  const known = KNOWN_CURRENCIES[currencyCode(currency)];
  const ownDecimals = typeof currency === 'object' && currency ? currency.decimal_digits : undefined;
  const decimals = Math.max(0, Math.min(6, Math.trunc(ownDecimals ?? known?.decimals ?? 2)));

  // Split into whole units and minor units without floating-point drift.
  const factor = 10 ** decimals;
  const abs = Math.abs(value);
  let major: bigint;
  let minor: number;
  if (abs * factor <= Number.MAX_SAFE_INTEGER) {
    // toPrecision(15) removes binary noise first, so 1.005 rounds to 1.01.
    const scaled = Math.round(Number((abs * factor).toPrecision(15)));
    major = BigInt(Math.floor(scaled / factor));
    minor = scaled % factor;
  } else {
    major = BigInt(Math.round(abs));
    minor = 0;
  }

  const hasCurrency = currencyCode(currency) !== '' || (typeof currency === 'object' && !!(currency?.name || currency?.names?.[lang]));
  const parts: string[] = [numberToWords(major, lang)];
  if (hasCurrency) parts.push(majorName(currency, lang, major));
  let text = parts.join(' ');

  if (minor > 0) {
    const minorNames = known?.[lang].minor;
    if (hasCurrency && minorNames) {
      const minorName = minorNames[minor === 1 ? 0 : minorNames.length - 1];
      text += `${words.and}${numberToWords(minor, lang)} ${minorName}`;
    } else {
      text += `${words.and}${fractionWords(minor, decimals, lang)}`;
    }
  }

  return value < 0 && (major > 0n || minor > 0) ? `${words.minus} ${text}` : text;
};
