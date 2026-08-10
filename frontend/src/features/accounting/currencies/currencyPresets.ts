export interface CurrencyPreset {
  abr: string;
  name_en: string;
  name_fa: string;
  decimal_digits: number;
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { abr: 'USD', name_en: 'US Dollar', name_fa: 'دلار آمریکا', decimal_digits: 2 },
  { abr: 'EUR', name_en: 'Euro', name_fa: 'یورو', decimal_digits: 2 },
  { abr: 'CAD', name_en: 'Canadian Dollar', name_fa: 'دلار کانادا', decimal_digits: 2 },
  { abr: 'AED', name_en: 'UAE Dirham', name_fa: 'درهم امارات', decimal_digits: 2 },
  { abr: 'CNY', name_en: 'Chinese Yuan', name_fa: 'یوان چین', decimal_digits: 2 },
  { abr: 'JPY', name_en: 'Japanese Yen', name_fa: 'ین ژاپن', decimal_digits: 0 },
];