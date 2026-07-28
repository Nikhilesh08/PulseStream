import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // This magic line forces Vite to never load duplicate React copies!
    dedupe: ["react", "react-dom"],
  },
});
