import type { FuelType, MarketData } from "../../shared/market";

import { Badge } from "@/components/ui/badge";
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
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
  NumberField,
  SelectField,
  ToggleField,
} from "@/components/calculator-fields";
import { ConsumptionSelector } from "@/components/consumption-selector";
import { MaintenanceFields } from "@/components/maintenance-fields";
import type { Car } from "@/lib/calculator";
import {
  energyPrice,
  fuelLabels,
  officialRegoRate,
  priceKey,
  regoRate,
  rucRate,
} from "@/lib/calculator";
import { vehicleLabel } from "@/lib/consumption-presets";
import { dateLabel, observationSource, precise } from "@/lib/format";

const averageDescription = (
  car: Car,
  observation: MarketData["prices"]["electric"],
) => {
  if (!car.useAverage)
    return "Set prices for your usual fuel station or charging plan.";
  if (observation.status === "estimate")
    return "Using example prices until source data is available.";
  return `Automatically follows ${observationSource(observation)} · ${dateLabel(observation.date)}`;
};

const PetrolGradeField = ({
  car,
  index,
  onChange,
}: {
  car: Car;
  index: number;
  onChange: (patch: Partial<Car>) => void;
}) => {
  if (car.type !== "phev" && car.type !== "motorcycle") return null;
  const isBike = car.type === "motorcycle";
  const grade = isBike ? car.motorcycleFuelGrade : car.phevFuelGrade;
  const choose = (value: string) => {
    const fuelGrade = value as "petrol91" | "petrol95";
    onChange(
      isBike
        ? { motorcycleFuelGrade: fuelGrade }
        : { phevFuelGrade: fuelGrade },
    );
  };
  return (
    <SelectField
      id={`car-${index}-${isBike ? "motorcycle" : "phev"}-fuel-grade`}
      label="Petrol grade"
      value={grade}
      onChange={choose}
    >
      <NativeSelectOption value="petrol91">Petrol 91</NativeSelectOption>
      <NativeSelectOption value="petrol95">Petrol 95</NativeSelectOption>
    </SelectField>
  );
};

const EnergyFields = ({
  car,
  index,
  market,
  onChange,
}: {
  car: Car;
  index: number;
  market: MarketData;
  onChange: (patch: Partial<Car>) => void;
}) => {
  const id = `car-${index}`;
  const isElectric = car.type === "electric";
  const isPhev = car.type === "phev";
  const observation = market.prices[priceKey(car)];
  return (
    <FieldSet>
      <FieldLegend>Energy & efficiency</FieldLegend>
      <FieldGroup>
        <ToggleField
          id={`${id}-average`}
          label="Use national averages"
          checked={car.useAverage}
          onChange={(useAverage) =>
            onChange({
              useAverage,
              price: energyPrice(car, market),
              electricityPrice: market.prices.electric.value,
            })
          }
          description={averageDescription(car, observation)}
        />
        <ConsumptionSelector car={car} index={index} onChange={onChange} />
        <PetrolGradeField car={car} index={index} onChange={onChange} />
        <FieldGroup className="grid grid-cols-2 gap-4">
          <NumberField
            id={`${id}-price`}
            label={isElectric ? "Electricity price" : "Fuel price"}
            value={energyPrice(car, market)}
            disabled={car.useAverage}
            onChange={(price) => onChange({ price })}
            unit={isElectric ? "$/kWh" : "$/L"}
            step={0.01}
          />
          <NumberField
            id={`${id}-efficiency`}
            label={isPhev ? "Petrol-mode consumption" : "Consumption"}
            value={isElectric ? car.electricEfficiency : car.efficiency}
            onChange={(value) =>
              onChange(
                isElectric
                  ? { electricEfficiency: value, consumptionPresetId: null }
                  : { efficiency: value, consumptionPresetId: null },
              )
            }
            unit={isElectric ? "kWh/100 km" : "L/100 km"}
            step={0.1}
            description={isElectric ? "Include charging losses." : undefined}
          />
        </FieldGroup>
        {isPhev && (
          <>
            <FieldGroup className="grid grid-cols-2 gap-4">
              <NumberField
                id={`${id}-electric-price`}
                label="Electricity price"
                value={
                  car.useAverage
                    ? market.prices.electric.value
                    : car.electricityPrice
                }
                disabled={car.useAverage}
                onChange={(electricityPrice) => onChange({ electricityPrice })}
                unit="$/kWh"
                step={0.01}
              />
              <NumberField
                id={`${id}-electric-efficiency`}
                label="Electric consumption"
                value={car.electricEfficiency}
                onChange={(electricEfficiency) =>
                  onChange({ electricEfficiency, consumptionPresetId: null })
                }
                unit="kWh/100 km"
                step={0.1}
              />
            </FieldGroup>
            <NumberField
              id={`${id}-charged-fuel`}
              label="Petrol use with a charged battery"
              value={car.electricFuelEfficiency}
              onChange={(electricFuelEfficiency) =>
                onChange({ electricFuelEfficiency, consumptionPresetId: null })
              }
              unit="L/100 km"
              step={0.1}
              description="Leave at 0 for electric-only operation. Some examples include occasional engine use in this mode."
            />
            <NumberField
              id={`${id}-share`}
              label="Distance with a charged battery"
              value={car.electricShare}
              onChange={(electricShare) => onChange({ electricShare })}
              unit="%"
              max={100}
              description="Petrol-mode consumption applies to the remaining distance. Some PHEVs also use petrol with a charged battery. RUC applies to all kilometres."
            />
          </>
        )}
      </FieldGroup>
    </FieldSet>
  );
};

const FeeVerification = ({
  market,
  kind,
  car,
}: {
  market: MarketData;
  kind: "rego" | "ruc";
  car: Car;
}) => {
  if (
    car[kind === "rego" ? "regoMode" : "rucMode"] !== "official" ||
    (kind === "ruc" && rucRate(car, market) === 0)
  )
    return null;
  return (
    <FieldDescription>
      {market.feesCheckedAt[kind]
        ? `NZTA ${kind === "rego" ? "schedule" : "rates"} downloaded ${dateLabel(market.feesCheckedAt[kind])}.`
        : kind === "rego"
          ? "NZTA reference schedule from 1 July 2026; no successful live download yet."
          : "NZTA reference rates; no successful live download yet. See Fee sources & rates in use above."}
    </FieldDescription>
  );
};

const FeeFields = ({
  car,
  index,
  market,
  onChange,
}: {
  car: Car;
  index: number;
  market: MarketData;
  onChange: (patch: Partial<Car>) => void;
}) => {
  const id = `car-${index}`;
  return (
    <FieldSet>
      <FieldLegend>Rego & road user charges</FieldLegend>
      <FieldGroup>
        {car.type === "motorcycle" && (
          <NumberField
            id={`${id}-motorcycle-cc`}
            label="Engine capacity"
            value={car.motorcycleCc}
            onChange={(motorcycleCc) =>
              onChange({ motorcycleCc, consumptionPresetId: null })
            }
            unit="cc"
            min={1}
            description="NZTA motorcycle licensing is based on engine capacity. Mopeds have a separate schedule."
          />
        )}
        <SelectField
          id={`${id}-rego-mode`}
          label="Annual rego"
          value={car.regoMode}
          onChange={(value) => onChange({ regoMode: value as Car["regoMode"] })}
        >
          <NativeSelectOption value="official">
            {car.type === "motorcycle"
              ? "NZTA motorcycle"
              : "NZTA passenger car"}{" "}
            · {precise.format(officialRegoRate(car, market))}
            /year
          </NativeSelectOption>
          <NativeSelectOption value="custom">
            Enter my own fee
          </NativeSelectOption>
          <NativeSelectOption value="excluded">Exclude rego</NativeSelectOption>
        </SelectField>
        <FeeVerification car={car} market={market} kind="rego" />
        {car.regoMode === "custom" && (
          <NumberField
            id={`${id}-rego`}
            label="Rego per year"
            value={car.customRego}
            onChange={(customRego) => onChange({ customRego })}
            unit="$"
            step={0.01}
          />
        )}
        <SelectField
          id={`${id}-ruc-mode`}
          label="Road user charges"
          value={car.rucMode}
          onChange={(value) => onChange({ rucMode: value as Car["rucMode"] })}
        >
          <NativeSelectOption value="official">
            NZTA light vehicle rate
          </NativeSelectOption>
          <NativeSelectOption value="custom">
            Enter my own rate
          </NativeSelectOption>
          <NativeSelectOption value="excluded">Exclude RUC</NativeSelectOption>
        </SelectField>
        <FeeVerification car={car} market={market} kind="ruc" />
        {car.rucMode === "custom" && (
          <NumberField
            id={`${id}-ruc`}
            label="RUC per 1,000 km"
            value={car.customRuc}
            onChange={(customRuc) => onChange({ customRuc })}
            unit="$"
            step={1}
          />
        )}
        <FieldDescription>
          {rucRate(car, market) === 0
            ? "Petrol road charges are included at the pump."
            : `${precise.format(rucRate(car, market))} per 1,000 km. NZTA presets cover two-axle light cars up to 3,500 kg; EVs and PHEVs must exceed 1,000 kg.`}
        </FieldDescription>
        {rucRate(car, market) > 0 && (
          <>
            <ToggleField
              id={`${id}-ruc-admin`}
              label="Include RUC transaction fees"
              checked={car.includeRucAdmin}
              onChange={(includeRucAdmin) => onChange({ includeRucAdmin })}
            />
            {car.includeRucAdmin && (
              <FieldGroup className="grid grid-cols-2 gap-4">
                <NumberField
                  id={`${id}-ruc-block`}
                  label="RUC purchase size"
                  value={car.rucBlock}
                  onChange={(rucBlock) =>
                    onChange({
                      rucBlock: Math.round(rucBlock / 1000) * 1000,
                    })
                  }
                  unit="km"
                  min={1000}
                  step={1000}
                />
                <SelectField
                  id={`${id}-ruc-method`}
                  label="Buy RUC through"
                  value={car.rucMethod}
                  onChange={(value) =>
                    onChange({ rucMethod: value as Car["rucMethod"] })
                  }
                >
                  <NativeSelectOption value="online">
                    Online · {precise.format(market.ruc.online)}
                  </NativeSelectOption>
                  <NativeSelectOption value="agent">
                    Agent · {precise.format(market.ruc.agent)}
                  </NativeSelectOption>
                </SelectField>
              </FieldGroup>
            )}
          </>
        )}
      </FieldGroup>
    </FieldSet>
  );
};

export const VehicleCard = ({
  car,
  index,
  market,
  onChange,
}: {
  car: Car;
  index: number;
  market: MarketData;
  onChange: (patch: Partial<Car>) => void;
}) => {
  const id = `car-${index}`;
  const isElectric = car.type === "electric";
  const isPhev = car.type === "phev";
  const hasElectric = isElectric || isPhev;
  return (
    <Card className="vehicle-card">
      <CardHeader>
        <CardTitle>
          <span className="eyebrow">Option {index + 1}</span>
        </CardTitle>
        <CardDescription>{vehicleLabel(car)}</CardDescription>
        <CardAction>
          <Badge variant={hasElectric ? "default" : "secondary"}>
            {fuelLabels[car.type]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FieldGroup>
          <SelectField
            id={`${id}-type`}
            label="Powertrain"
            value={car.type}
            onChange={(value) => onChange({ type: value as FuelType })}
          >
            {Object.entries(fuelLabels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </SelectField>
          <NumberField
            id={`${id}-purchase`}
            label="Purchase price"
            value={car.purchase}
            onChange={(purchase) => onChange({ purchase })}
            unit="$"
            step={500}
          />
        </FieldGroup>
        <Separator />
        <EnergyFields
          car={car}
          index={index}
          market={market}
          onChange={onChange}
        />
        <Separator />
        <MaintenanceFields car={car} index={index} onChange={onChange} />
        <Separator />
        <FeeFields
          car={car}
          index={index}
          market={market}
          onChange={onChange}
        />
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Rego: 12-month online licence, GST included
        </span>
        <span className="font-medium">
          {precise.format(regoRate(car, market))}/yr
        </span>
      </CardFooter>
    </Card>
  );
};
