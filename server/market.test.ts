import ExcelJS from "exceljs";

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { electricityCandidates } from "./sources.ts";

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
  let feesAvailable = false;
  let electricityReport: number | null = null;
  const candidates = electricityCandidates();
  const buffers = await Promise.all(
    candidates.slice(0, 2).map(async (candidate) => {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Nominal summary");
      const date = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(candidate.date));
      sheet.addRows([
        [`Nominal indicators on ${date}`],
        ["Location", "Retail"],
        ["New Zealand", 42.1],
      ]);
      return Buffer.from(await book.xlsx.writeBuffer());
    }),
  );
  const requests: string[] = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (
      electricityReport !== null &&
      String(url) === candidates[electricityReport].url
    )
      return new Response(new Uint8Array(buffers[electricityReport]));
    if (feesAvailable && String(url) === sourceUrls.rego)
      return new Response(
        "<h2>Cars (if your licence starts AFTER 1 January 2020):</h2><div>Private passenger – petrol 12 months: $191.45 Private passenger – diesel or electric 12 months: $258.83</div><h2>Motorcycles (if your licence starts AFTER 1 January 2020):</h2><div>Private passenger – petrol, 0 to 60cc 12 months: $440 Private passenger – petrol, 61 to 250cc 12 months: $460 Private passenger – petrol, 251 to 750cc 12 months: $610 Private passenger – petrol, 751cc and over 12 months: $820</div>",
      );
    if (feesAvailable && String(url) === sourceUrls.ruc)
      return new Response(
        "<table><tr><td>Online NZTA app</td><td>$14</td></tr><tr><td>Counter sales at agents</td><td>$15</td></tr><tr><td>1</td><td>Up to 3500kg</td><td>86</td></tr><tr><td>12</td><td>1001 - 3500kg</td><td>48</td></tr></table>",
      );
    if ([sourceUrls.rego, sourceUrls.ruc].includes(String(url)))
      return new Response(
        '<html><script src="/_Incapsula_Resource"></script></html>',
      );
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
    assert.equal(initial.feesCheckedAt.rego, null);
    assert.equal(initial.rego.petrol, 181.45);
    assert.equal(initial.ruc.light, 76);
    assert.ok(
      initial.errors.some((error) =>
        /Rego fees blocked automated access/.test(error),
      ),
    );
    assert.ok(
      initial.errors.some((error) =>
        /RUC fees blocked automated access/.test(error),
      ),
    );
    assert.equal(initial.prices.petrol91.source, sourceUrls.gaspy);
    assert.equal(
      initial.prices.petrol91.value,
      fallbackMarket.prices.petrol91.value,
    );
    assert.equal(requests.length, 8);
    gaspyUnavailable = false;
    Date.now = () => originalNow() + 61000;
    const [first, duplicate] = await Promise.all([
      getMarket(true),
      getMarket(true),
    ]);
    assert.deepEqual(first, duplicate);
    assert.equal(requests.length, 16);
    assert.equal(first.prices.petrol91.status, "live");
    assert.equal(first.prices.petrol91.value, 3);
    assert.equal(first.prices.petrol91.source, sourceUrls.gaspy);
    assert.equal(first.errors.length, 3);
    const persisted = JSON.parse(
      await readFile(process.env.MARKET_CACHE_FILE, "utf8"),
    );
    assert.equal(persisted.prices.petrol91.value, 3);
    await getMarket(true);
    assert.equal(requests.length, 16, "refresh is rate limited for one minute");
    gaspyUnavailable = true;
    Date.now = () => originalNow() + 122000;
    const failed = await getMarket(true);
    assert.equal(failed.prices.petrol91.value, 3);
    assert.equal(failed.prices.petrol91.status, "cached");
    assert.equal(failed.prices.petrol91.source, sourceUrls.gaspy);
    assert.equal(failed.errors.length, 4);
    assert.equal(requests.length, 24);
    feesAvailable = true;
    electricityReport = 0;
    Date.now = () => originalNow() + 183000;
    const live = await getMarket(true);
    assert.equal(live.rego.petrol, 191.45);
    assert.equal(live.ruc.light, 86);
    assert.equal(live.prices.electric.date, candidates[0].date);
    assert.ok(live.feesCheckedAt.rego);
    assert.ok(live.feesCheckedAt.ruc);
    feesAvailable = false;
    electricityReport = 1;
    Date.now = () => originalNow() + 244000;
    const retained = await getMarket(true);
    assert.deepEqual(retained.rego, live.rego);
    assert.deepEqual(retained.motorcycleRego, live.motorcycleRego);
    assert.deepEqual(retained.ruc, live.ruc);
    assert.deepEqual(retained.feesCheckedAt, live.feesCheckedAt);
    assert.equal(retained.prices.electric.date, candidates[0].date);
    assert.equal(retained.prices.electric.status, "cached");
    assert.ok(
      retained.errors.some((error) =>
        /Retaining newer saved electricity data/.test(error),
      ),
    );
    assert.ok(
      retained.errors.some((error) => /previously downloaded fees/.test(error)),
    );
    assert.ok(
      requests.every(
        (url) =>
          [
            sourceUrls.gaspyData,
            sourceUrls.electricity,
            sourceUrls.rego,
            sourceUrls.ruc,
          ].includes(url) ||
          url.startsWith(
            "https://www.mbie.govt.nz/assets/Data-Files/Energy/nz-energy-quarterly-and-energy-in-nz/qsdep-report-",
          ),
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
