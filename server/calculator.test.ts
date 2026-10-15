import assert from "node:assert/strict";
import { test } from "node:test";

import { fallbackMarket } from "../shared/market.ts";
import { calculate, defaultCars, defaultUsage } from "../src/lib/calculator.ts";

test("EV uses electricity, correct licensing, RUC and amortised transaction fees", () => {
  const result = calculate(defaultCars[1], defaultUsage, fallbackMarket);
  assert.equal(result.energy, 720);
  assert.equal(result.rego, 248.83);
  assert.equal(result.ruc, 1140);
  assert.equal(result.rucAdmin, 37.32);
  assert.equal(result.annual, 3676.15);
  assert.equal(result.total, 70380.75);
});
test("changing petrol to diesel automatically changes RUC and rego", () => {
  const petrol = calculate(defaultCars[0], defaultUsage, fallbackMarket);
  const diesel = calculate(
    { ...defaultCars[0], type: "diesel" },
    defaultUsage,
    fallbackMarket,
  );
  assert.equal(petrol.ruc, 0);
  assert.equal(petrol.rucAdmin, 0);
  assert.equal(diesel.ruc, 1140);
  assert.equal(diesel.rego, 248.83);
});
test("PHEV splits energy by distance, but pays RUC across all distance", () => {
  const result = calculate(
    { ...defaultCars[0], type: "phev", electricShare: 60 },
    defaultUsage,
    fallbackMarket,
  );
  assert.ok(
    Math.abs(
      result.energy - (((6000 * 5.6) / 100) * 2.7 + ((9000 * 16) / 100) * 0.3),
    ) < 1e-9,
  );
  assert.equal(result.ruc, 570);
  assert.equal(result.rego, 181.45);
});
test("custom rates remain independent of market updates; exclusions remove fees", () => {
  const custom = {
    ...defaultCars[1],
    useAverage: false,
    price: 0.1,
    regoMode: "excluded" as const,
    rucMode: "excluded" as const,
  };
  const result = calculate(custom, defaultUsage, {
    ...fallbackMarket,
    prices: {
      ...fallbackMarket.prices,
      electric: { ...fallbackMarket.prices.electric, value: 1 },
    },
  });
  assert.equal(result.energy, 240);
  assert.equal(result.rego, 0);
  assert.equal(result.ruc, 0);
  assert.equal(result.rucAdmin, 0);
});
test("zero distance never gives fabricated or infinite per-kilometre costs", () => {
  const result = calculate(
    defaultCars[1],
    { annualKm: 0, years: 5 },
    fallbackMarket,
  );
  assert.equal(result.perKm, null);
  assert.equal(result.runningPerKm, null);
  assert.equal(result.energy, 0);
  assert.equal(result.rucAdmin, 0);
});

test("checklist costs annualise quotes and intervals using distance and elapsed time", () => {
  const car = {
    ...defaultCars[0],
    maintenance: {
      oilChangeCost: 200,
      oilChangeKm: 10000,
      oilChangeMonths: 12,
      insuranceAnnual: 1000,
      tyreSetCost: 1200,
      tyreLifeKm: 40000,
      wofCost: 80,
      wofMonths: 6,
    },
  };
  const result = calculate(car, { annualKm: 20000, years: 2 }, fallbackMarket);
  assert.equal(result.oil, 400);
  assert.equal(result.insurance, 1000);
  assert.equal(result.tyres, 600);
  assert.equal(result.wof, 160);
  assert.equal(
    result.annual,
    result.energy + result.rego + result.ruc + result.rucAdmin + 2160,
  );
  const lowMileage = calculate(
    car,
    { annualKm: 1000, years: 2 },
    fallbackMarket,
  );
  assert.equal(
    lowMileage.oil,
    200,
    "time-based oil interval wins at low mileage",
  );
  assert.equal(lowMileage.tyres, 30);
  assert.equal(
    calculate({ ...car, type: "electric" }, defaultUsage, fallbackMarket).oil,
    0,
  );
});
test("zero checklist costs are excluded and WoF supports longer intervals", () => {
  const car = {
    ...defaultCars[0],
    maintenance: {
      ...defaultCars[0].maintenance,
      oilChangeCost: 0,
      insuranceAnnual: 0,
      tyreSetCost: 0,
      wofCost: 80,
      wofMonths: 24,
    },
  };
  const result = calculate(car, defaultUsage, fallbackMarket);
  assert.equal(result.oil, 0);
  assert.equal(result.insurance, 0);
  assert.equal(result.tyres, 0);
  assert.equal(result.wof, 40);
});

test("petrol motorcycles use Gaspy fuel and cc-based rego, with no default RUC", () => {
  const bike = {
    ...defaultCars[0],
    type: "motorcycle" as const,
    motorcycleCc: 125,
    motorcycleFuelGrade: "petrol91" as const,
    efficiency: 2.1,
  };
  const result = calculate(bike, defaultUsage, fallbackMarket);
  assert.equal(result.energy, 850.5);
  assert.equal(result.rego, 456.24);
  assert.equal(result.ruc, 0);
  assert.equal(result.rucAdmin, 0);
  assert.ok(result.oil > 0);
  assert.ok(result.wof > 0);
  for (const [cc, expected] of [
    [60, 431.52],
    [61, 456.24],
    [250, 456.24],
    [251, 606.29],
    [750, 606.29],
    [751, 816.45],
  ]) {
    assert.equal(
      calculate({ ...bike, motorcycleCc: cc }, defaultUsage, fallbackMarket)
        .rego,
      expected,
    );
  }
  assert.equal(
    calculate(
      { ...bike, motorcycleFuelGrade: "petrol95" },
      defaultUsage,
      fallbackMarket,
    ).energy,
    913.5,
  );
});
test("motorcycles retain custom rego, RUC and fuel overrides", () => {
  const bike = {
    ...defaultCars[0],
    type: "motorcycle" as const,
    motorcycleCc: 1252,
    regoMode: "custom" as const,
    customRego: 900,
    rucMode: "custom" as const,
    customRuc: 50,
    useAverage: false,
    price: 3,
    efficiency: 5.1,
  };
  const result = calculate(bike, { annualKm: 10000, years: 3 }, fallbackMarket);
  assert.equal(result.rego, 900);
  assert.equal(result.ruc, 500);
  assert.ok(Math.abs(result.energy - 1530) < 1e-9);
});
