import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_BASE_URL ?? '',
    publicDir: 'public',
    server: {
      // In development Rails serves the page (layouts/react_app.html.erb on
      // :5000) and loads the scripts from this server. Asset URLs (fonts,
      // images, CSS url()) must point here, not at the page's origin.
      origin: env.VITE_DEV_ORIGIN ?? 'http://localhost:5173',
    },
  };
})
