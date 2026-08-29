import { configureStore } from '@reduxjs/toolkit';
import { authApi } from '../features/auth/authApi';
import { organizationsApi } from '../features/organizations/organizationsApi';
import { membersApi } from '../features/members/membersApi';
import { departmentsApi } from '../features/departments/departmentsApi';
import { rolesApi } from '../features/roles/rolesApi';
import { groupsApi } from '../features/groups/groupsApi';
import { versionsApi } from '../features/versions/versionsApi';
import { permissionsApi } from '../features/permissions/permissionsApi';
import { accountingSettingsApi } from '../features/accounting/settings/settingsApi';
import { accountingCurrenciesApi } from '../features/accounting/currencies/currenciesApi';
import { accountingCenterTypesApi } from '../features/accounting/centerTypes/centerTypesApi';
import { accountingCentersApi } from '../features/accounting/centers/centersApi';
import { accountingAccountCategoriesApi } from '../features/accounting/accountCategories/accountCategoriesApi';
import { accountingLedgersApi } from '../features/accounting/ledgers/ledgersApi';
import { accountingAccountsApi } from '../features/accounting/accounts/accountsApi';
import { fiscalYearsApi } from '../features/fiscalYears/fiscalYearsApi';
import { journalEntriesApi } from '../features/accounting/journalEntries/journalEntriesApi';

import organizationsReducer from '../features/organizations/organizationsSlice';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    [authApi.reducerPath]: authApi.reducer,
    [organizationsApi.reducerPath]: organizationsApi.reducer,
    [membersApi.reducerPath]: membersApi.reducer,
    [departmentsApi.reducerPath]: departmentsApi.reducer,
    [rolesApi.reducerPath]: rolesApi.reducer,
    [groupsApi.reducerPath]: groupsApi.reducer,
    [versionsApi.reducerPath]: versionsApi.reducer,
    [permissionsApi.reducerPath]: permissionsApi.reducer,
    [accountingSettingsApi.reducerPath]: accountingSettingsApi.reducer,
    [accountingCurrenciesApi.reducerPath]: accountingCurrenciesApi.reducer,
    [accountingCenterTypesApi.reducerPath]: accountingCenterTypesApi.reducer,
    [accountingCentersApi.reducerPath]: accountingCentersApi.reducer,
    [accountingAccountCategoriesApi.reducerPath]: accountingAccountCategoriesApi.reducer,
    [accountingLedgersApi.reducerPath]: accountingLedgersApi.reducer,
    [accountingAccountsApi.reducerPath]: accountingAccountsApi.reducer,
    [fiscalYearsApi.reducerPath]: fiscalYearsApi.reducer,
    [journalEntriesApi.reducerPath]: journalEntriesApi.reducer,
    organizations: organizationsReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      organizationsApi.middleware,
      membersApi.middleware,
      departmentsApi.middleware,
      rolesApi.middleware,
      groupsApi.middleware,
      versionsApi.middleware,
      permissionsApi.middleware,
      accountingSettingsApi.middleware,
      accountingCurrenciesApi.middleware,
      accountingCenterTypesApi.middleware,
      accountingCentersApi.middleware,
      accountingAccountCategoriesApi.middleware,
      accountingLedgersApi.middleware,
      accountingAccountsApi.middleware,
      fiscalYearsApi.middleware,
      journalEntriesApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;