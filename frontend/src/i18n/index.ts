import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'shared',
    ns: ['shared', 'auth', 'organizations', 'members', 'departments', 'roles', 'groups', 'versions', 'permissions'],
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      parse: (data: string, languages?: string | string[]) => {
        const parsed = JSON.parse(data);
        const lang = Array.isArray(languages) ? languages[0] : languages;
        if (lang && parsed[lang] && typeof parsed[lang] === 'object') {
          return parsed[lang];
        }
        return parsed;
      },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;