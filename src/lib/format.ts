import type { Observation } from "../../shared/market";
import { sourceUrls } from "../../shared/market";

export const dollars = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});
export const precise = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const dateLabel = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("en-NZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Pacific/Auckland",
      }).format(new Date(date))
    : "Awaiting source data";
export const numberValue = (value: string) => Math.max(0, Number(value) || 0);

export const observationSource = (observation: Observation) =>
  observation.source === sourceUrls.gaspy ? "Gaspy" : "MBIE";
