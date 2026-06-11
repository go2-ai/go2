import { useGetOrganizationQuery } from '../features/organizations/organizationsApi';
import { locales, type LocaleCode } from '../shared/constants/locales';

export const useOrganizationLocales = (organizationId: number) => {
  const { data: organization } = useGetOrganizationQuery(organizationId);
  const knownCodes = locales.map(l => l.code);

  const activeLocales = (organization?.active_locales ?? ['en'])
    .filter((code): code is LocaleCode => knownCodes.includes(code as LocaleCode));

  return {
    defaultLocale: (organization?.locale ?? 'en') as LocaleCode,
    activeLocales: activeLocales.length ? activeLocales : (['en'] as LocaleCode[]),
  };
};