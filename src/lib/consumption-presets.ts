import { fuelLabels, type Car } from "./calculator";
import presetData from "./consumption-presets.json";

import type { FuelType } from "../../shared/market";

export type ConsumptionPreset = {
  id: string;
  category: FuelType;
  name: string;
  year: number;
  size: string;
  market: string;
  basis: string;
  sourceName: string;
  sourceUrl: string;
  reviewedAt: string;
  efficiency?: number;
  electricEfficiency?: number;
  electricFuelEfficiency?: number;
  petrolGrade?: "petrol91" | "petrol95";
  motorcycleCc?: number;
  notes: string;
  raw?: {
    epaId: string;
    combinedMpg: number;
    kwhPer100Miles?: number;
    chargedGallonsPer100Miles?: number;
  };
};
export const consumptionPresets = presetData as ConsumptionPreset[];
export const presetsFor = (type: FuelType) =>
  consumptionPresets.filter((preset) => preset.category === type);
export const presetPatch = (preset: ConsumptionPreset): Partial<Car> => {
  const patch: Partial<Car> = { consumptionPresetId: preset.id };
  if (preset.efficiency !== undefined) patch.efficiency = preset.efficiency;
  if (preset.electricEfficiency !== undefined)
    patch.electricEfficiency = preset.electricEfficiency;
  if (preset.category === "phev") {
    patch.electricFuelEfficiency = preset.electricFuelEfficiency ?? 0;
    patch.phevFuelGrade = preset.petrolGrade ?? "petrol91";
  }
  if (preset.category === "motorcycle") {
    patch.motorcycleCc = preset.motorcycleCc ?? 500;
    patch.motorcycleFuelGrade = preset.petrolGrade ?? "petrol91";
  }
  return patch;
};
export const presetSummary = (preset: ConsumptionPreset) => {
  if (preset.category === "electric")
    return `${preset.electricEfficiency?.toFixed(1)} kWh/100 km`;
  if (preset.category === "phev")
    return `${preset.efficiency?.toFixed(1)} L/100 km petrol · ${preset.electricEfficiency?.toFixed(1)} kWh/100 km charged`;
  return `${preset.efficiency?.toFixed(1)} L/100 km`;
};

export const vehicleLabel = (car: Car): string => {
  const preset = consumptionPresets.find(
    (example) =>
      example.id === car.consumptionPresetId && example.category === car.type,
  );
  const powertrain =
    car.type === "motorcycle"
      ? `Motorcycle · ${fuelLabels[car.motorcycleFuelGrade]}`
      : car.type === "phev"
        ? `Plug-in hybrid · ${fuelLabels[car.phevFuelGrade]}`
        : fuelLabels[car.type];
  return preset ? `${preset.name} · ${powertrain}` : powertrain;
};
