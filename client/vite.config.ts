import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL || "http://localhost:3000";

  return {
    plugins: [react()],
    server: { port: 5173 },
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./tests/setup.ts",
      include: ["tests/**/*.test.{ts,tsx}"],
    },
  };
});
