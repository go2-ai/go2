import { OrganizationResolver } from "@/features/organizations/OrganizationResolver";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/")({
  component: OrganizationResolver,
});
