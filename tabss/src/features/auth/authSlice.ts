import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { PURGE } from "redux-persist";
import { authApi } from "./authApi";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isValidating: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isValidating: false,
};

export const validateSession = createAsyncThunk<
  { id: number; email: string },
  void,
  { rejectValue: string }
>("auth/validateSession", async (_, { dispatch, rejectWithValue }) => {
  try {
    const result = await dispatch(
      authApi.endpoints.getCurrentUser.initiate(),
    ).unwrap();
    return result;
  } catch {
    return rejectWithValue("Session invalid");
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(PURGE, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(validateSession.pending, (state) => {
        state.isValidating = true;
      })
      .addCase(validateSession.fulfilled, (state, action) => {
        state.isValidating = false;
        state.isAuthenticated = true;
        state.user = action.payload as User;
      })
      .addCase(validateSession.rejected, (state) => {
        state.isValidating = false;
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;
