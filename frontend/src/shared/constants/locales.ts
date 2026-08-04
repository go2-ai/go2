import { enUS, faIR } from 'date-fns/locale';

export const locales = [
  { 
    code: 'en', 
    label: 'English', 
    direction: 'ltr' as const,
    dateFnsLocale: enUS,
  },
  { 
    code: 'fa', 
    label: 'فارسی', 
    direction: 'rtl' as const,
    dateFnsLocale: faIR,
  },
] as const;

export type LocaleCode = typeof locales[number]['code'];
export type Direction = typeof locales[number]['direction'];