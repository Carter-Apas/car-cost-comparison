import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { fallbackMarket, sourceUrls } from "../shared/market.ts";

test("fuel uses only Gaspy, discards legacy MBIE cache, and retains Gaspy data on failure", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "roadwise-market-"));
  process.env.MARKET_CACHE_FILE = path.join(directory, "market.json");
  const legacy = structuredClone(fallbackMarket);
  delete (legacy as Partial<typeof legacy>).motorcycleRego;
  legacy.prices.petrol91 = {
    value: 2.5,
    date: "2026-09-25",
    status: "cached",
    source: "https://www.mbie.govt.nz/weekly-fuel-price-monitoring",
  };
  await writeFile(process.env.MARKET_CACHE_FILE, JSON.stringify(legacy));
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalWarn = console.warn;
  let gaspyUnavailable = true;
  const requests: string[] = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url) !== sourceUrls.gaspyData || gaspyUnavailable)
      return new Response("blocked", { status: 503 });
    return Response.json({
      Updated: "15 Oct 2026 @ 12:47PM",
      Averages: {
        "91": { Average: 300 },
        "95": { Average: 320 },
        Diesel: { Average: 250 },
      },
    });
  };
  console.warn = () => {};
  try {
    const { getMarket } = await import("./market.ts");
    const initial = await getMarket();
    assert.equal(initial.prices.petrol91.status, "estimate");
    assert.equal(initial.motorcycleRego.over750, 816.45);
    assert.equal(initial.prices.petrol91.source, sourceUrls.gaspy);
    assert.equal(
      initial.prices.petrol91.value,
      fallbackMarket.prices.petrol91.value,
    );
    assert.equal(requests.length, 4);
    gaspyUnavailable = false;
    Date.now = () => originalNow() + 61000;
    const [first, duplicate] = await Promise.all([
      getMarket(true),
      getMarket(true),
    ]);
    assert.deepEqual(first, duplicate);
    assert.equal(requests.length, 8);
    assert.equal(first.prices.petrol91.status, "live");
    assert.equal(first.prices.petrol91.value, 3);
    assert.equal(first.prices.petrol91.source, sourceUrls.gaspy);
    assert.equal(first.errors.length, 3);
    const persisted = JSON.parse(
      await readFile(process.env.MARKET_CACHE_FILE, "utf8"),
    );
    assert.equal(persisted.prices.petrol91.value, 3);
    await getMarket(true);
    assert.equal(requests.length, 8, "refresh is rate limited for one minute");
    gaspyUnavailable = true;
    Date.now = () => originalNow() + 122000;
    const failed = await getMarket(true);
    assert.equal(failed.prices.petrol91.value, 3);
    assert.equal(failed.prices.petrol91.status, "cached");
    assert.equal(failed.prices.petrol91.source, sourceUrls.gaspy);
    assert.equal(failed.errors.length, 4);
    assert.equal(requests.length, 12);
    assert.ok(
      requests.every((url) =>
        [
          sourceUrls.gaspyData,
          sourceUrls.electricity,
          sourceUrls.rego,
          sourceUrls.ruc,
        ].includes(url),
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    console.warn = originalWarn;
    delete process.env.MARKET_CACHE_FILE;
    await rm(directory, { recursive: true, force: true });
  }
});
