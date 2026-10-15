import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import path from "node:path";

import { getMarket } from "./server/market";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "nz-market-api",
      configureServer: (server) => {
        server.middlewares.use("/api/market", async (request, response) => {
          try {
            const data = await getMarket(request.url?.includes("refresh=1"));
            response.setHeader("Content-Type", "application/json");
            response.setHeader("Cache-Control", "no-store");
            response.end(JSON.stringify(data));
          } catch {
            response.statusCode = 503;
            response.end(
              JSON.stringify({ error: "Market sources unavailable" }),
            );
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
