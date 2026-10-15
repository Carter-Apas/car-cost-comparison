import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getMarket } from "./market.ts";

const root = path.resolve("dist");
const contentTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405);
      response.end();
      return;
    }
    if (url.pathname === "/api/market") {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify(
          await getMarket(url.searchParams.get("refresh") === "1"),
        ),
      );
      return;
    }
    const filename = path.resolve(
      root,
      `.${decodeURIComponent(url.pathname.replace(/^\/$/, "/index.html"))}`,
    );
    if (!filename.startsWith(`${root}/`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      const body = await readFile(filename);
      response.writeHead(200, {
        "Content-Type":
          contentTypes[path.extname(filename)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") response.end();
      else response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  } catch {
    response.writeHead(500);
    response.end("Unable to serve request");
  }
});
server.listen(Number(process.env.PORT ?? 80), "0.0.0.0", () =>
  console.log("NZ car calculator is running"),
);
void getMarket();
setInterval(
  () => {
    void getMarket();
  },
  6 * 60 * 60 * 1000,
).unref();
