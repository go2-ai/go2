// src/hooks/useTranslatableLocales.ts

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../app/store';
import { useGetOrganizationQuery } from '../features/organizations/organizationsApi';
import {
  getOrganizationLocales,
  getNonPrimaryLocales,
} from '../utils/translationHelper';

interface UseTranslatableLocalesOptions {
  /** When omitted, uses the current organization from the store. */
  organizationId?: number;
  /** Override the primary locale (defaults to the current user's locale). */
  locale?: string;
  /** Override non-primary locales (defaults to org locales minus user locale). */
  otherLocales?: string[];
}

export const useTranslatableLocales = ({
  organizationId,
  locale,
  otherLocales,
}: UseTranslatableLocalesOptions = {}) => {
  const { user, isInitialized: isAuthInitialized } = useSelector(
    (state: RootState) => state.auth
  );
  const { currentOrganization } = useSelector(
    (state: RootState) => state.organizations
  );

  const resolvedOrganizationId = organizationId ?? currentOrganization?.id;
  const organizationFromStore =
    currentOrganization?.id === resolvedOrganizationId
      ? currentOrganization
      : undefined;

  const { data: fetchedOrganization, isLoading: isOrganizationLoading } =
    useGetOrganizationQuery(resolvedOrganizationId!, {
      skip: !resolvedOrganizationId || !!organizationFromStore,
    });

  const organization = organizationFromStore ?? fetchedOrganization;

  // Primary locale with proper fallback chain
  const primaryLocale = useMemo(() => {
    if (locale) return locale;
    if (isAuthInitialized && user?.locale) return user.locale;
    if (organization?.locale) return organization.locale;
    return 'en';
  }, [locale, isAuthInitialized, user?.locale, organization?.locale]);

  // ✅ Uses the helper for consistency
  const allLocales = useMemo(() => {
    if (!organization) return [];
    return getOrganizationLocales(organization);
  }, [organization]);

  // ✅ Uses the helper for consistency
  const nonPrimaryLocales = useMemo(() => {
    if (otherLocales !== undefined) return otherLocales;
    if (!organization || !primaryLocale) return [];
    return getNonPrimaryLocales(organization, primaryLocale);
  }, [otherLocales, organization, primaryLocale]);

  const isReady = useMemo(() => {
    return isAuthInitialized && !!organization && allLocales.length > 0 && !!primaryLocale;
  }, [isAuthInitialized, organization, allLocales, primaryLocale]);

  return {
    primaryLocale,
    nonPrimaryLocales,
    allLocales,
    isReady,
    isAuthInitialized,
    isOrganizationLoading: isOrganizationLoading && !organizationFromStore,
    organization,
  };
};