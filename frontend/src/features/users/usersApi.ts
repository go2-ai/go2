import { createApi } from '@reduxjs/toolkit/query/react';
import type { User } from './type';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUser: builder.query<User, number>({
      query: (userId) => `/organizations/${userId}`,
    }),
  }),
});

export const { useGetUserQuery } = usersApi;