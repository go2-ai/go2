import { RouteSynchronizer } from "@/components/tabs/RouteSynchronizer";
import { Sidebar } from "@/components/tabs/sidebar";
import { TabWorkspace } from "@/components/tabs/TabWorkspace";
import { TabProvider } from "@/hooks/tabs/use-tab-manager";

export function DashboardLayout() {
  return (
    <TabProvider>
      <RouteSynchronizer />
      <div
        style={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          backgroundColor: "var(--mui-palette-background-default)",
        }}
      >
        <Sidebar />
        <main
          style={{
            flex: 1,
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <TabWorkspace />
        </main>
      </div>
    </TabProvider>
  );
}
