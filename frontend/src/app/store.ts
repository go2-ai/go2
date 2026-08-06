import { configureStore } from '@reduxjs/toolkit';
import { authApi } from '../features/auth/authApi';
import { organizationsApi } from '../features/organizations/organizationsApi';
import { membersApi } from '../features/members/membersApi';
import { departmentsApi } from '../features/departments/departmentsApi';
import { rolesApi } from '../features/roles/rolesApi';
import { groupsApi } from '../features/groups/groupsApi';
import { versionsApi } from '../features/versions/versionsApi';
import { permissionsApi } from '../features/permissions/permissionsApi';
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
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;