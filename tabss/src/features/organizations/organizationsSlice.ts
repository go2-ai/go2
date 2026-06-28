import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";
import type { Organization } from "./types";

interface OrganizationsState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoading: boolean;
}

const initialState: OrganizationsState = {
  organizations: [],
  currentOrganization: null,
  isLoading: false,
};

const organizationsSlice = createSlice({
  name: "organizations",
  initialState,
  reducers: {
    setOrganizations: (state, action: PayloadAction<Organization[]>) => {
      state.organizations = action.payload;
    },
    setCurrentOrganization: (
      state,
      action: PayloadAction<Organization | null>,
    ) => {
      state.currentOrganization = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearOrganizations: (state) => {
      state.organizations = [];
      state.currentOrganization = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(PURGE, (state) => {
      state.organizations = [];
      state.currentOrganization = null;
      state.isLoading = false;
    });
  },
});

export const {
  setOrganizations,
  setCurrentOrganization,
  setLoading,
  clearOrganizations,
} = organizationsSlice.actions;

export default organizationsSlice.reducer;
