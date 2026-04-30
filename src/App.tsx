import {
  BatteryCharging,
  Fuel,
  Gauge,
  RotateCcw,
  Scale,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type CarForm = {
  capex: number;
  dollarsPerKwh: number;
  dollarsPerLitre: number;
  isElectric: boolean;
  kmPerLitre: number;
  kmPerKwh: number;
  name: string;
  opex: number;
  rucPer1000Km: number;
};

type Assumptions = {
  annualKm: number;
  ownershipYears: number;
};

type CarTotals = {
  annualEnergyCost: number;
  annualRucCost: number;
  annualRunningCost: number;
  costPerKm: number;
  energyCostPerKm: number;
  ownershipTotal: number;
  rawCostPerKm: number;
};

const defaultAssumptions: Assumptions = {
  annualKm: 15000,
  ownershipYears: 5,
};

const defaultCars: [CarForm, CarForm] = [
  {
    capex: 32000,
    dollarsPerKwh: 0.3,
    dollarsPerLitre: 2.7,
    isElectric: false,
    kmPerLitre: 18,
    kmPerKwh: 6.25,
    name: "Efficient petrol",
    opex: 1800,
    rucPer1000Km: 0,
  },
  {
    capex: 52000,
    dollarsPerKwh: 0.3,
    dollarsPerLitre: 2.7,
    isElectric: true,
    kmPerLitre: 18,
    kmPerKwh: 6.25,
    name: "Electric option",
    opex: 1100,
    rucPer1000Km: 76,
  },
];

const currency = new Intl.NumberFormat("en-NZ", {
  currency: "NZD",
  maximumFractionDigits: 0,
  style: "currency",
});

const currencyPrecise = new Intl.NumberFormat("en-NZ", {
  currency: "NZD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const numberFormat = new Intl.NumberFormat("en-NZ");

const positiveNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const calculateTotals = (car: CarForm, assumptions: Assumptions): CarTotals => {
  const annualKm = positiveNumber(assumptions.annualKm);
  const ownershipYears = positiveNumber(assumptions.ownershipYears, 1);
  const energyCostPerKm = car.isElectric
    ? positiveNumber(car.dollarsPerKwh) / positiveNumber(car.kmPerKwh, 1)
    : positiveNumber(car.dollarsPerLitre) / positiveNumber(car.kmPerLitre, 1);
  const annualEnergyCost = annualKm * energyCostPerKm;
  const annualRucCost = (annualKm / 1000) * positiveNumber(car.rucPer1000Km);
  const annualRunningCost =
    positiveNumber(car.opex) + annualEnergyCost + annualRucCost;
  const ownershipTotal =
    positiveNumber(car.capex) + annualRunningCost * ownershipYears;

  return {
    annualEnergyCost,
    annualRucCost,
    annualRunningCost,
    costPerKm: ownershipTotal / (annualKm * ownershipYears || 1),
    energyCostPerKm,
    ownershipTotal,
    rawCostPerKm: annualRunningCost / (annualKm || 1),
  };
};

const updateCar = (
  cars: [CarForm, CarForm],
  index: number,
  patch: Partial<CarForm>,
): [CarForm, CarForm] =>
  cars.map((car, carIndex) =>
    carIndex === index ? { ...car, ...patch } : car,
  ) as [CarForm, CarForm];

const readNumber = (value: string) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

const CostInput = ({
  description,
  id,
  label,
  min = 0,
  onChange,
  step = 1,
  value,
}: {
  description?: string;
  id: string;
  label: string;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) => (
  <Field>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Input
      id={id}
      min={min}
      onChange={(event) => onChange(readNumber(event.target.value))}
      step={step}
      type="number"
      value={value}
    />
    {description ? <FieldDescription>{description}</FieldDescription> : null}
  </Field>
);

const CarCostCard = ({
  car,
  index,
  onChange,
  totals,
}: {
  car: CarForm;
  index: number;
  onChange: (index: number, patch: Partial<CarForm>) => void;
  totals: CarTotals;
}) => {
  const carId = `car-${index}`;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>
          <Input
            aria-label={`Car ${index + 1} name`}
            className="h-9 border-transparent bg-muted/55 px-3 text-base font-medium"
            onChange={(event) => onChange(index, { name: event.target.value })}
            value={car.name}
          />
        </CardTitle>
        <CardDescription>
          {car.isElectric ? "Electric energy model" : "Fuel energy model"}
        </CardDescription>
        <CardAction>
          <Badge variant={car.isElectric ? "default" : "secondary"}>
            {car.isElectric ? "EV" : "Fuel"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/55 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <WalletCards aria-hidden="true" />
              <span className="text-xs font-medium uppercase">Total</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {currency.format(totals.ownershipTotal)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/55 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge aria-hidden="true" />
              <span className="text-xs font-medium uppercase">Total / km</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {currencyPrecise.format(totals.costPerKm)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/55 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fuel aria-hidden="true" />
              <span className="text-xs font-medium uppercase">Raw / km</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {currencyPrecise.format(totals.rawCostPerKm)}
            </p>
          </div>
        </div>

        <FieldSet>
          <FieldGroup>
            <Field orientation="horizontal">
              <Switch
                checked={car.isElectric}
                id={`${carId}-electric`}
                onCheckedChange={(checked) =>
                  onChange(index, { isElectric: checked })
                }
              />
              <FieldContent>
                <FieldLabel htmlFor={`${carId}-electric`}>
                  Electric car
                </FieldLabel>
                <FieldDescription>
                  Switches fuel inputs to electricity inputs.
                </FieldDescription>
              </FieldContent>
            </Field>

            <CostInput
              id={`${carId}-capex`}
              label="Capex: cost of car"
              onChange={(capex) => onChange(index, { capex })}
              value={car.capex}
            />
            <CostInput
              description="Annual operational costs excluding fuel or charging."
              id={`${carId}-opex`}
              label="Opex per year"
              onChange={(opex) => onChange(index, { opex })}
              value={car.opex}
            />
            <CostInput
              description="Road User Charges in NZD per 1,000 km. Leave at 0 if already covered by petrol fuel levies."
              id={`${carId}-ruc`}
              label="RUC dollars per 1,000 km"
              onChange={(rucPer1000Km) => onChange(index, { rucPer1000Km })}
              value={car.rucPer1000Km}
            />

            <Separator />

            {car.isElectric ? (
              <>
                <CostInput
                  description="NZD paid per kWh from home, public charging, or a blended estimate."
                  id={`${carId}-dollars-kwh`}
                  label="Dollars per kWh"
                  onChange={(dollarsPerKwh) =>
                    onChange(index, { dollarsPerKwh })
                  }
                  step={0.01}
                  value={car.dollarsPerKwh}
                />
                <CostInput
                  description="Vehicle efficiency. 6.25 km/kWh is a sensible compact EV default."
                  id={`${carId}-km-kwh`}
                  label="Kilometres per kWh"
                  onChange={(kmPerKwh) => onChange(index, { kmPerKwh })}
                  step={0.01}
                  value={car.kmPerKwh}
                />
              </>
            ) : (
              <>
                <CostInput
                  description="NZD paid for each litre of fuel."
                  id={`${carId}-dollars-litre`}
                  label="Dollars per litre"
                  onChange={(dollarsPerLitre) =>
                    onChange(index, { dollarsPerLitre })
                  }
                  step={0.01}
                  value={car.dollarsPerLitre}
                />
                <CostInput
                  description="Vehicle economy in kilometres per litre."
                  id={`${carId}-km-litre`}
                  label="Kilometres per litre"
                  onChange={(kmPerLitre) => onChange(index, { kmPerLitre })}
                  step={0.1}
                  value={car.kmPerLitre}
                />
              </>
            )}
          </FieldGroup>
        </FieldSet>
      </CardContent>
      <CardFooter className="grid gap-3 rounded-b-lg sm:grid-cols-2">
        <FooterMetric
          label="Energy per year"
          value={currency.format(totals.annualEnergyCost)}
        />
        <FooterMetric
          label="RUC per year"
          value={currency.format(totals.annualRucCost)}
        />
      </CardFooter>
    </Card>
  );
};

const ComparisonPanel = ({
  assumptions,
  cars,
  totals,
}: {
  assumptions: Assumptions;
  cars: [CarForm, CarForm];
  totals: [CarTotals, CarTotals];
}) => {
  const cheaperIndex =
    totals[0].ownershipTotal <= totals[1].ownershipTotal ? 0 : 1;
  const difference = Math.abs(
    totals[0].ownershipTotal - totals[1].ownershipTotal,
  );
  const largestTotal = Math.max(
    totals[0].ownershipTotal,
    totals[1].ownershipTotal,
  );

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale aria-hidden="true" />
          Comparison
        </CardTitle>
        <CardDescription>
          Total cost includes capex, opex, energy, and RUC over the selected
          period.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">Lower-cost option</p>
          <p className="mt-1 text-3xl font-semibold">
            {cars[cheaperIndex].name}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Saves {currency.format(difference)} over the ownership period.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {cars.map((car, index) => {
            const width = `${Math.max(
              8,
              (totals[index].ownershipTotal / largestTotal) * 100,
            )}%`;

            return (
              <div className="flex flex-col gap-2" key={index}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{car.name}</span>
                  <span className="text-muted-foreground">
                    {currency.format(totals[index].ownershipTotal)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-primary"
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="grid gap-3 rounded-b-lg md:grid-cols-3">
        <FooterMetric
          label="Car 1 per km"
          value={currencyPrecise.format(totals[0].costPerKm)}
        />
        <FooterMetric
          label="Car 2 per km"
          value={currencyPrecise.format(totals[1].costPerKm)}
        />
        <FooterMetric
          label="Annual km"
          value={numberFormat.format(assumptions.annualKm)}
        />
      </CardFooter>
    </Card>
  );
};

const FooterMetric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground uppercase">
      {label}
    </p>
    <p className="text-base font-semibold">{value}</p>
  </div>
);

const AssumptionCard = ({
  assumptions,
  onChange,
  onReset,
}: {
  assumptions: Assumptions;
  onChange: (patch: Partial<Assumptions>) => void;
  onReset: () => void;
}) => (
  <Card className="rounded-lg">
    <CardHeader>
      <CardTitle>Usage assumptions</CardTitle>
      <CardDescription>
        Shared distance and ownership period for both cars.
      </CardDescription>
      <CardAction>
        <Button onClick={onReset} size="sm" type="button" variant="outline">
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <CostInput
          id="annual-km"
          label="Kilometres per year"
          onChange={(annualKm) => onChange({ annualKm })}
          value={assumptions.annualKm}
        />
        <CostInput
          id="ownership-years"
          label="Ownership years"
          onChange={(ownershipYears) => onChange({ ownershipYears })}
          step={0.5}
          value={assumptions.ownershipYears}
        />
      </FieldGroup>
    </CardContent>
  </Card>
);

export const App = () => {
  const [assumptions, setAssumptions] = useState(defaultAssumptions);
  const [cars, setCars] = useState(defaultCars);
  const totals = useMemo(
    () =>
      cars.map((car) => calculateTotals(car, assumptions)) as [
        CarTotals,
        CarTotals,
      ],
    [assumptions, cars],
  );

  const handleCarChange = (index: number, patch: Partial<CarForm>) => {
    setCars((currentCars) => updateCar(currentCars, index, patch));
  };

  const handleReset = () => {
    setAssumptions(defaultAssumptions);
    setCars(defaultCars);
  };

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-8 md:py-8">
        <header className="grid gap-4 border-b pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Fuel aria-hidden="true" />
              <span>NZD ownership calculator</span>
              <BatteryCharging aria-hidden="true" />
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold text-balance md:text-5xl">
              Compare the true cost of two cars.
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Enter capex, annual opex, RUC, and fuel or electricity efficiency.
            The model converts everything to total ownership cost and cost per
            km.
          </p>
        </header>

        <AssumptionCard
          assumptions={assumptions}
          onChange={(patch) =>
            setAssumptions((currentAssumptions) => ({
              ...currentAssumptions,
              ...patch,
            }))
          }
          onReset={handleReset}
        />

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr_0.9fr]">
          {cars.map((car, index) => (
            <CarCostCard
              car={car}
              index={index}
              key={index}
              onChange={handleCarChange}
              totals={totals[index]}
            />
          ))}
          <ComparisonPanel
            assumptions={assumptions}
            cars={cars}
            totals={totals}
          />
        </section>
      </div>
    </main>
  );
};
