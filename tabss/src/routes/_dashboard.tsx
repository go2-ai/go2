import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { store } from "@/store";
import { validateSession } from "@/features/auth/authSlice";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const { isAuthenticated } = store.getState().auth;
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }

    const result = await store.dispatch(validateSession());
    if (validateSession.rejected.match(result)) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});
