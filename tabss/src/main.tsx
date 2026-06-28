import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { PersistGate } from "redux-persist/integration/react";
import { Provider } from "react-redux";
import { store, persistor } from "./store";
import theme from "./theme";
import "./i18n";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./index.css";

// Create a new router instance
const router = createRouter({ routeTree, basepath: "/app" });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <RouterProvider router={router} />
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </StrictMode>,
  );
}
