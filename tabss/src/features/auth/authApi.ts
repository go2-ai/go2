import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '@/utils/baseQuery';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithCsrf,
  endpoints: (builder) => ({
    getCurrentUser: builder.query<{ id: number; email: string }, void>({
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

export const { useGetCurrentUserQuery, useSignUpMutation, useConfirmEmailMutation, useSignInMutation } = authApi;
