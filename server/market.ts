import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseGaspy,
  parseMotorcycleRego,
  parseRego,
  parseRuc,
} from "./parsers.ts";
import { fetchElectricity, sourceHtml, SourceAccessError } from "./sources.ts";

import { fallbackMarket, sourceUrls } from "../shared/market.ts";
import type { MarketData } from "../shared/market.ts";

const cacheFile =
  process.env.MARKET_CACHE_FILE ?? path.resolve(".cache/market.json");
const refreshInterval = 6 * 60 * 60 * 1000;
let current: MarketData = structuredClone(fallbackMarket);
let lastAttempt = 0;
let pending: Promise<MarketData> | undefined;
let initialized = false;
const fetchSource = async (url: string) => {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    ![
      "www.mbie.govt.nz",
      "mbie.govt.nz",
      "www.nzta.govt.nz",
      "nzta.govt.nz",
      "gaspy-datamine-stats.firebaseio.com",
    ].includes(parsed.hostname)
  )
    throw new Error("Unexpected source host");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "NZCarCalculator/1.0", Accept: "*/*" },
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response;
};
const discardLegacyFuel = (data: MarketData) => {
  for (const key of ["petrol91", "petrol95", "diesel"] as const) {
    if (data.prices[key].source !== sourceUrls.gaspy)
      data.prices[key] = structuredClone(fallbackMarket.prices[key]);
  }
  return data;
};
const backfillMotorcycleRego = (data: MarketData) => {
  if (!data.motorcycleRego) {
    data.motorcycleRego = structuredClone(fallbackMarket.motorcycleRego);
    data.feesCheckedAt.rego = null;
  }
  return data;
};
const initialize = async () => {
  if (initialized) return;
  initialized = true;
  try {
    const saved = JSON.parse(await readFile(cacheFile, "utf8")) as MarketData;
    if (
      Object.values(saved.prices).length === 4 &&
      Object.values(saved.prices).every(
        (p) => Number.isFinite(p.value) && p.value > 0 && p.value < 15,
      ) &&
      saved.rego &&
      saved.ruc &&
      saved.feesCheckedAt
    )
      current = discardLegacyFuel(backfillMotorcycleRego(saved));
  } catch {
    /* First boot uses explicitly labelled example prices. */
  }
};
const fetchFuelPrices = async () =>
  parseGaspy(await (await fetchSource(sourceUrls.gaspyData)).json());

const refresh = async (): Promise<MarketData> => {
  await initialize();
  lastAttempt = Date.now();
  const next = structuredClone(current);
  next.errors = [];
  for (const price of Object.values(next.prices))
    if (price.status === "live") price.status = "cached";
  const results = await Promise.allSettled([
    (async () => {
      Object.assign(next.prices, await fetchFuelPrices());
    })(),
    (async () => {
      const { observation, notice } = await fetchElectricity(fetchSource);
      if (
        !next.prices.electric.date ||
        observation.date! >= next.prices.electric.date
      )
        next.prices.electric = observation;
      if (notice)
        next.errors.push(
          next.prices.electric.date === observation.date
            ? notice
            : `Electricity release page unavailable. Retaining newer saved electricity data dated ${next.prices.electric.date}.`,
        );
    })(),
    (async () => {
      const html = await sourceHtml(await fetchSource(sourceUrls.rego));
      const rego = parseRego(html);
      const motorcycleRego = parseMotorcycleRego(html);
      next.rego = rego;
      next.motorcycleRego = motorcycleRego;
      next.feesCheckedAt.rego = new Date().toISOString();
    })(),
    (async () => {
      next.ruc = parseRuc(await sourceHtml(await fetchSource(sourceUrls.ruc)));
      next.feesCheckedAt.ruc = new Date().toISOString();
    })(),
  ]);
  const labels = [
    "Fuel averages",
    "Electricity average",
    "Rego fees",
    "RUC fees",
  ];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      next.errors.push(
        `${labels[index]} ${result.reason instanceof SourceAccessError ? "blocked automated access" : "unavailable"}. Using ${index < 2 ? "saved data or example prices" : next.feesCheckedAt[index === 2 ? "rego" : "ruc"] ? "previously downloaded fees" : "the dated NZTA reference rates shown below"}.`,
      );
      console.warn(`${labels[index]}:`, String(result.reason));
    }
  });
  next.checkedAt = new Date().toISOString();
  current = next;
  try {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(`${cacheFile}.tmp`, JSON.stringify(next));
    await rename(`${cacheFile}.tmp`, cacheFile);
  } catch (error) {
    console.warn("Could not persist market cache:", String(error));
  }
  return structuredClone(current);
};
export const getMarket = async (force = false) => {
  await initialize();
  // Shared promise and one-minute limit prevent repeated clicks hammering sources.
  if (
    !pending &&
    (Date.now() - lastAttempt >= refreshInterval ||
      (force && Date.now() - lastAttempt >= 60000))
  ) {
    pending = refresh().finally(() => {
      pending = undefined;
    });
  }
  return pending ? pending : structuredClone(current);
};
