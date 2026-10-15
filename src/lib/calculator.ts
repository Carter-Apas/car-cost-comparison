import type { FuelType, MarketData, MotorcycleRego } from "../../shared/market";

export type Maintenance = {
  oilChangeCost: number;
  oilChangeKm: number;
  oilChangeMonths: number;
  insuranceAnnual: number;
  tyreSetCost: number;
  tyreLifeKm: number;
  wofCost: number;
  wofMonths: number;
};
export type Car = {
  type: FuelType;
  purchase: number;
  maintenance: Maintenance;
  consumptionPresetId: string | null;
  efficiency: number;
  electricFuelEfficiency: number;
  phevFuelGrade: "petrol91" | "petrol95";
  motorcycleFuelGrade: "petrol91" | "petrol95";
  motorcycleCc: number;
  electricEfficiency: number;
  electricShare: number;
  useAverage: boolean;
  price: number;
  electricityPrice: number;
  regoMode: "official" | "custom" | "excluded";
  customRego: number;
  rucMode: "official" | "custom" | "excluded";
  customRuc: number;
  includeRucAdmin: boolean;
  rucBlock: number;
  rucMethod: "online" | "agent";
};
export type Usage = { annualKm: number; years: number };
export const defaultUsage: Usage = { annualKm: 15000, years: 5 };
export const defaultCars: [Car, Car] = [
  {
    type: "petrol91",
    purchase: 32000,
    maintenance: {
      oilChangeCost: 200,
      oilChangeKm: 10000,
      oilChangeMonths: 12,
      insuranceAnnual: 1000,
      tyreSetCost: 1200,
      tyreLifeKm: 40000,
      wofCost: 80,
      wofMonths: 12,
    },
    consumptionPresetId: null,
    efficiency: 5.6,
    electricFuelEfficiency: 0,
    phevFuelGrade: "petrol91",
    motorcycleFuelGrade: "petrol91",
    motorcycleCc: 500,
    electricEfficiency: 16,
    electricShare: 60,
    useAverage: true,
    price: 2.7,
    electricityPrice: 0.3,
    regoMode: "official",
    customRego: 181.45,
    rucMode: "official",
    customRuc: 0,
    includeRucAdmin: true,
    rucBlock: 5000,
    rucMethod: "online",
  },
  {
    type: "electric",
    purchase: 52000,
    maintenance: {
      oilChangeCost: 200,
      oilChangeKm: 10000,
      oilChangeMonths: 12,
      insuranceAnnual: 1000,
      tyreSetCost: 1200,
      tyreLifeKm: 40000,
      wofCost: 80,
      wofMonths: 12,
    },
    consumptionPresetId: null,
    efficiency: 5.6,
    electricFuelEfficiency: 0,
    phevFuelGrade: "petrol91",
    motorcycleFuelGrade: "petrol91",
    motorcycleCc: 500,
    electricEfficiency: 16,
    electricShare: 60,
    useAverage: true,
    price: 0.3,
    electricityPrice: 0.3,
    regoMode: "official",
    customRego: 248.83,
    rucMode: "official",
    customRuc: 76,
    includeRucAdmin: true,
    rucBlock: 5000,
    rucMethod: "online",
  },
];
export const fuelLabels: Record<FuelType, string> = {
  petrol91: "Petrol 91",
  petrol95: "Petrol 95",
  diesel: "Diesel",
  electric: "Electric",
  phev: "Plug-in petrol hybrid",
  motorcycle: "Motorcycle (petrol)",
};
const nonNegative = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
export const priceKey = (car: Car) => {
  if (car.type === "motorcycle") return car.motorcycleFuelGrade;
  return car.type === "phev" ? car.phevFuelGrade : car.type;
};
export const motorcycleRegoBand = (cc: number): keyof MotorcycleRego => {
  if (cc <= 60) return "upTo60";
  if (cc <= 250) return "from61To250";
  if (cc <= 750) return "from251To750";
  return "over750";
};
export const officialRegoRate = (car: Car, market: MarketData) => {
  if (car.type === "motorcycle")
    return market.motorcycleRego[motorcycleRegoBand(car.motorcycleCc)];
  return market.rego[
    car.type === "electric"
      ? "electric"
      : car.type === "diesel"
        ? "diesel"
        : "petrol"
  ];
};
export const energyPrice = (car: Car, market: MarketData) =>
  car.useAverage ? market.prices[priceKey(car)].value : nonNegative(car.price);
export const regoRate = (car: Car, market: MarketData) =>
  car.regoMode === "excluded"
    ? 0
    : car.regoMode === "custom"
      ? nonNegative(car.customRego)
      : officialRegoRate(car, market);
export const rucRate = (car: Car, market: MarketData) =>
  car.rucMode === "excluded"
    ? 0
    : car.rucMode === "custom"
      ? nonNegative(car.customRuc)
      : car.type === "phev"
        ? market.ruc.phev
        : car.type === "diesel" || car.type === "electric"
          ? market.ruc.light
          : 0;
export const maintenanceCosts = (car: Car, annualKm: number) => {
  const km = nonNegative(annualKm);
  const m = car.maintenance;
  const oilChanges =
    car.type === "electric"
      ? 0
      : Math.max(
          km / Math.max(1, nonNegative(m.oilChangeKm)),
          12 / Math.max(1, nonNegative(m.oilChangeMonths)),
        );
  const oil = nonNegative(m.oilChangeCost) * oilChanges;
  const insurance = nonNegative(m.insuranceAnnual);
  const tyres =
    (nonNegative(m.tyreSetCost) * km) / Math.max(1, nonNegative(m.tyreLifeKm));
  const wof =
    (nonNegative(m.wofCost) * 12) / Math.max(1, nonNegative(m.wofMonths));
  return { oil, insurance, tyres, wof, total: oil + insurance + tyres + wof };
};
const energyCost = (car: Car, km: number, market: MarketData) => {
  const electricShare =
    car.type === "electric"
      ? 1
      : car.type === "phev"
        ? Math.min(100, nonNegative(car.electricShare)) / 100
        : 0;
  const electricityPrice = car.useAverage
    ? market.prices.electric.value
    : nonNegative(car.electricityPrice);
  const chargedFuel =
    car.type === "phev" ? nonNegative(car.electricFuelEfficiency) : 0;
  const fuelCost =
    (km / 100) *
    ((1 - electricShare) * nonNegative(car.efficiency) +
      electricShare * chargedFuel) *
    energyPrice(car, market);
  const chargingCost =
    ((km * electricShare * nonNegative(car.electricEfficiency)) / 100) *
    (car.type === "electric" ? energyPrice(car, market) : electricityPrice);
  return fuelCost + chargingCost;
};

export const calculate = (car: Car, usage: Usage, market: MarketData) => {
  const km = nonNegative(usage.annualKm);
  const years = nonNegative(usage.years);
  const energy = energyCost(car, km, market);
  const ruc = (km / 1000) * rucRate(car, market);
  // Amortised admin cost; distance licences carry forward across years.
  const rucAdmin =
    ruc > 0 && car.includeRucAdmin
      ? (km / Math.max(1000, nonNegative(car.rucBlock))) *
        market.ruc[car.rucMethod]
      : 0;
  const rego = regoRate(car, market);
  const maintenance = maintenanceCosts(car, km);
  const annual = energy + ruc + rucAdmin + rego + maintenance.total;
  const total = nonNegative(car.purchase) + annual * years;
  return {
    energy,
    ruc,
    rucAdmin,
    rego,
    oil: maintenance.oil,
    insurance: maintenance.insurance,
    tyres: maintenance.tyres,
    wof: maintenance.wof,
    annual,
    total,
    perKm: km > 0 && years > 0 ? total / (km * years) : null,
    runningPerKm: km > 0 ? annual / km : null,
  };
};
