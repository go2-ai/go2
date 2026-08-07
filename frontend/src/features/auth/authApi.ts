import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';
import type { TagDescription } from '@reduxjs/toolkit/query';

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
  tagTypes: ['Auth'] as const,
  endpoints: (builder) => ({
    getMe: builder.query<CurrentUser, void>({
      query: () => '/api/me',
      providesTags: ['Auth'],
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
      invalidatesTags: ['Auth'] as TagDescription<'Auth'>[],
    }),
    signIn: builder.mutation({
      query: (credentials) => ({
        url: '/users/sign_in',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'] as TagDescription<'Auth'>[],
    }),
    signOut: builder.mutation<void, void>({
      query: () => ({
        url: '/users/sign_out',
        method: 'DELETE',
      }),
      invalidatesTags: ['Auth'] as TagDescription<'Auth'>[],
    }),
  }),
});

export const {
  useGetMeQuery,
  useSignUpMutation,
  useConfirmEmailMutation,
  useSignInMutation,
  useSignOutMutation,
} = authApi;