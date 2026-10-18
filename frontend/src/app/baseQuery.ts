import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { getCsrfToken, setCsrfToken } from '../utils/csrf';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:5000',
  credentials: 'include',
  prepareHeaders: (headers) => {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

// Rails rotates the CSRF token when the session changes (e.g. Devise sign in /
// sign out). The server returns the new token in the X-CSRF-Token response
// header, so keep the <meta> tag in sync to avoid 422 InvalidAuthenticityToken.
export const baseQueryWithCsrf: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const freshToken = result.meta?.response?.headers.get('X-CSRF-Token');
  if (freshToken) {
    setCsrfToken(freshToken);
  }
  return result;
};
