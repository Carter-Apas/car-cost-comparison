import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import type { FuelType } from "../shared/market.ts";
import { fallbackMarket } from "../shared/market.ts";
import { calculate, defaultCars, defaultUsage } from "../src/lib/calculator.ts";
// Node's JSON import attributes differ from Vite's; read the curated data directly.
import type { ConsumptionPreset } from "../src/lib/consumption-presets.ts";

const examples = JSON.parse(
  await readFile(
    new URL("../src/lib/consumption-presets.json", import.meta.url),
    "utf8",
  ),
) as ConsumptionPreset[];

test("each powertrain has five distinct, sourced examples spanning consumption", () => {
  for (const category of [
    "petrol91",
    "petrol95",
    "diesel",
    "electric",
    "phev",
    "motorcycle",
  ] as FuelType[]) {
    const group = examples.filter((example) => example.category === category);
    assert.equal(group.length, 5);
    assert.equal(new Set(group.map((example) => example.id)).size, 5);
    assert.ok(
      group.every(
        (example) =>
          example.year > 2000 &&
          example.sourceUrl.startsWith("https://") &&
          example.basis &&
          example.market,
      ),
    );
    const rates = group.map(
      (example) => example.efficiency ?? example.electricEfficiency!,
    );
    assert.ok(Math.max(...rates) > Math.min(...rates));
  }
});
test("EPA examples convert MPG, electricity units and charged-mode petrol separately", () => {
  for (const example of examples.filter((entry) => entry.raw)) {
    const raw = example.raw!;
    if (example.efficiency !== undefined)
      assert.ok(
        Math.abs(example.efficiency - 235.214583 / raw.combinedMpg) <= 0.051,
      );
    if (example.electricEfficiency !== undefined)
      assert.ok(
        Math.abs(example.electricEfficiency - raw.kwhPer100Miles! / 1.609344) <=
          0.051,
      );
    if (example.category === "phev")
      assert.ok(
        Math.abs(
          example.electricFuelEfficiency! -
            raw.chargedGallonsPer100Miles! * 2.35214583,
        ) <= 0.051,
      );
  }
});
test("charged PHEV petrol is counted at the chosen grade without treating the headline weighted figure as petrol-only", () => {
  const example = examples.find((entry) => entry.id === "epa-47504")!;
  const car = {
    ...defaultCars[0],
    type: "phev" as const,
    efficiency: example.efficiency!,
    electricEfficiency: example.electricEfficiency!,
    electricFuelEfficiency: example.electricFuelEfficiency!,
    phevFuelGrade: example.petrolGrade!,
    electricShare: 60,
  };
  const result = calculate(car, defaultUsage, fallbackMarket);
  const expected =
    (6000 / 100) * 8.4 * 2.9 +
    (9000 / 100) * 0.2 * 2.9 +
    (9000 / 100) * 31.1 * 0.3;
  assert.ok(Math.abs(result.energy - expected) < 1e-9);
  const electric = calculate(
    { ...car, type: "electric", electricShare: 100 },
    defaultUsage,
    fallbackMarket,
  );
  assert.ok(
    Math.abs(electric.energy - (15000 / 100) * 31.1 * 0.3) < 1e-9,
    "battery EV ignores stale PHEV petrol values",
  );
});
