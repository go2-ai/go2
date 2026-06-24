import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  locale: string;
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithCsrf,
  endpoints: (builder) => ({
    getMe: builder.query<CurrentUser, void>({
      query: () => '/api/me',
    }),
    signUp: builder.mutation({
      query: (userData) => ({
        url: '/users',
        method: 'POST',
        body: userData,
      }),
    }),
    confirmEmail: builder.mutation({
      query: ({ confirmation_token }) => ({
        url: `/users/confirmation?confirmation_token=${confirmation_token}`,
        method: 'GET',
      }),
    }),
    signIn: builder.mutation({
      query: (credentials) => ({
        url: '/users/sign_in',
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
});

export const {
  useGetMeQuery,
  useSignUpMutation,
  useConfirmEmailMutation,
  useSignInMutation,
} = authApi;