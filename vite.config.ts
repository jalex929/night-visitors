import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plain Vite config so any host (Bolt, StackBlitz, Netlify, a laptop) can start it as is.
export default defineConfig({
  // Relative base so the build works at /, /night-visitors/, /lab/night-visitors/ or anywhere.
  base: "./",
  plugins: [react()],
});
