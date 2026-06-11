import { createApi } from '@reduxjs/toolkit/query/react';
import type { Department } from './types';
import { baseQueryWithCsrf } from '../../app/baseQuery';

type DepartmentPayload = Record<string, string>;

export const departmentsApi = createApi({
  reducerPath: 'departmentsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Department'],
  endpoints: (builder) => ({
    getDepartments: builder.query<Department[], number>({
      query: (organizationId) => `/organizations/${organizationId}/departments`,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Department' as const, id })), { type: 'Department', id: 'LIST' }]
          : [{ type: 'Department', id: 'LIST' }],
    }),

    getDepartment: builder.query<Department, { organizationId: number; departmentId: number }>({
      query: ({ organizationId, departmentId }) => `/organizations/${organizationId}/departments/${departmentId}`,
      providesTags: (result, error, { departmentId }) => [{ type: 'Department', id: departmentId }],
    }),
    
    createDepartment: builder.mutation<Department, { organizationId: number; data: DepartmentPayload }>({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/departments`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Department', id: 'LIST' }],
    }),
    
    updateDepartment: builder.mutation<Department, { organizationId: number; departmentId: number; data: DepartmentPayload }>({
      query: ({ organizationId, departmentId, data }) => ({
        url: `/organizations/${organizationId}/departments/${departmentId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { departmentId }) => [{ type: 'Department', id: departmentId }, { type: 'Department', id: 'LIST' }],
    }),
    
    deleteDepartment: builder.mutation<Department, { organizationId: number; departmentId: number }>({
      query: ({ organizationId, departmentId }) => ({
        url: `/organizations/${organizationId}/departments/${departmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { departmentId }) => [{ type: 'Department', id: departmentId }, { type: 'Department', id: 'LIST' }],
    }),
        
  })
});

export const { 
  useGetDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation
} = departmentsApi;