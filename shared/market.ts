export type FuelType =
  | "petrol91"
  | "petrol95"
  | "diesel"
  | "electric"
  | "phev"
  | "motorcycle";
export type Observation = {
  value: number;
  date: string | null;
  source: string;
  status: "live" | "cached" | "estimate" | "reference";
};
export type MotorcycleRego = {
  upTo60: number;
  from61To250: number;
  from251To750: number;
  over750: number;
};
export type MarketData = {
  checkedAt: string | null;
  prices: Record<"petrol91" | "petrol95" | "diesel" | "electric", Observation>;
  rego: { petrol: number; diesel: number; electric: number };
  motorcycleRego: MotorcycleRego;
  ruc: { light: number; phev: number; online: number; agent: number };
  feesCheckedAt: { rego: string | null; ruc: string | null };
  errors: string[];
};
export const sourceUrls = {
  gaspy: "https://www.gaspy.nz/stats.html",
  gaspyData: "https://gaspy-datamine-stats.firebaseio.com/datamine.json",
  electricity:
    "https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/energy-prices/electricity-cost-and-price-monitoring",
  rego: "https://www.nzta.govt.nz/vehicles/licensing-rego/vehicle-fees/licensing-fees",
  ruc: "https://www.nzta.govt.nz/vehicles/road-user-charges/ruc-rates-and-transaction-fees",
};
// Energy values are example inputs until a source observation is downloaded.
export const fallbackMarket: MarketData = {
  checkedAt: null,
  prices: {
    petrol91: {
      value: 2.7,
      date: null,
      source: sourceUrls.gaspy,
      status: "estimate",
    },
    petrol95: {
      value: 2.9,
      date: null,
      source: sourceUrls.gaspy,
      status: "estimate",
    },
    diesel: {
      value: 2.1,
      date: null,
      source: sourceUrls.gaspy,
      status: "estimate",
    },
    electric: {
      value: 0.3,
      date: null,
      source: sourceUrls.electricity,
      status: "estimate",
    },
  },
  // Private passenger vehicles, 12-month online licensing, from 1 July 2026.
  rego: { petrol: 181.45, diesel: 248.83, electric: 248.83 },
  motorcycleRego: {
    upTo60: 431.52,
    from61To250: 456.24,
    from251To750: 606.29,
    over750: 816.45,
  },
  ruc: { light: 76, phev: 38, online: 12.44, agent: 13.71 },
  feesCheckedAt: { rego: null, ruc: null },
  errors: [],
};
