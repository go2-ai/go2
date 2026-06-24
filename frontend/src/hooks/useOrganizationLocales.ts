import { useGetOrganizationQuery } from '../features/organizations/organizationsApi';
import { locales, type LocaleCode } from '../shared/constants/locales';
import { getOrganizationLocales } from '../utils/translationHelper';

export const useOrganizationLocales = (organizationId: number) => {
  const { data: organization, isLoading } = useGetOrganizationQuery(organizationId);
  const knownCodes = locales.map(l => l.code);

  const activeLocales = (organization?.active_locales ?? ['en'])
    .filter((code): code is LocaleCode => knownCodes.includes(code as LocaleCode));

  const defaultLocale = (organization?.locale ?? 'en') as LocaleCode;
  const resolvedActiveLocales = activeLocales.length ? activeLocales : (['en'] as LocaleCode[]);
  const allLocales = organization
    ? getOrganizationLocales(organization).filter(
        (code): code is LocaleCode => knownCodes.includes(code as LocaleCode)
      )
    : ([] as LocaleCode[]);

  return {
    defaultLocale,
    activeLocales: resolvedActiveLocales,
    allLocales: allLocales.length ? allLocales : (['en'] as LocaleCode[]),
    isLoading,
  };
};