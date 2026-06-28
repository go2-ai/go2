import { useNavigate } from "@tanstack/react-router";
import { useDispatch } from "react-redux";
import { useEffect } from "react";
import { useGetMyOrganizationsQuery } from "@/features/organizations/organizationsApi";
import {
  setOrganizations,
  setCurrentOrganization,
  setLoading,
  clearOrganizations,
} from "@/features/organizations/organizationsSlice";
import { clearUser } from "@/features/auth/authSlice";
import { Box, CircularProgress, Typography } from "@mui/material";

export function OrganizationResolver() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    data: organizations,
    isLoading,
    error,
  } = useGetMyOrganizationsQuery();

  useEffect(() => {
    dispatch(setLoading(isLoading));
  }, [isLoading, dispatch]);

  useEffect(() => {
    if (!isLoading && organizations) {
      dispatch(setOrganizations(organizations));

      if (organizations.length === 0) {
        navigate({ to: "/organizations", replace: true });
      } else {
        const lastOrganization = organizations[organizations.length - 1];
        dispatch(setCurrentOrganization(lastOrganization));
        navigate({ to: "/organizations", replace: true });
      }
    }
  }, [isLoading, organizations, dispatch, navigate]);

  useEffect(() => {
    if (error) {
      console.error("Failed to fetch organizations:", error);
      if ("status" in error && error.status === 401) {
        dispatch(clearUser());
        dispatch(clearOrganizations());
        navigate({ to: "/login", replace: true });
      } else {
        navigate({ to: "/login", replace: true });
      }
    }
  }, [error, dispatch, navigate]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
      }}
    >
      <CircularProgress />
      <Typography sx={{ mt: 2 }} color="text.secondary">
        Loading organizations...
      </Typography>
    </Box>
  );
}
