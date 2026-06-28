import { configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage/session";
import baseApi from "./api/baseApi";
import { authApi } from "@/features/auth/authApi";
import authReducer from "@/features/auth/authSlice";
import { membersApi } from "@/features/members/membersApi";
import { organizationsApi } from "@/features/organizations/organizationsApi";
import organizationsReducer from "@/features/organizations/organizationsSlice";

// Persist auth and organizations slices to sessionStorage
const authPersistConfig = {
  key: "auth",
  storage,
};

const organizationsPersistConfig = {
  key: "organizations",
  storage,
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedOrganizationsReducer = persistReducer(
  organizationsPersistConfig,
  organizationsReducer,
);

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [membersApi.reducerPath]: membersApi.reducer,
    [organizationsApi.reducerPath]: organizationsApi.reducer,
    auth: persistedAuthReducer,
    organizations: persistedOrganizationsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(
      baseApi.middleware,
      authApi.middleware,
      membersApi.middleware,
      organizationsApi.middleware,
    ),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
