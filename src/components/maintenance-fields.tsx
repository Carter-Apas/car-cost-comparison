import { NumberField } from "@/components/calculator-fields";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import type { Car, Maintenance } from "@/lib/calculator";

export const MaintenanceFields = ({
  car,
  index,
  onChange,
}: {
  car: Car;
  index: number;
  onChange: (patch: Partial<Car>) => void;
}) => {
  const id = `car-${index}`;
  const m = car.maintenance;
  const isElectric = car.type === "electric";
  const update = (patch: Partial<Maintenance>) =>
    onChange({ maintenance: { ...m, ...patch } });
  return (
    <FieldSet>
      <FieldLegend>Running-cost checklist</FieldLegend>
      <FieldDescription>
        Work through each expense using your quotes and service schedule. These
        starting values are examples; set a cost to $0 to exclude it.
      </FieldDescription>
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">01 · Oil changes</FieldLegend>
          {isElectric ? (
            <FieldDescription>
              Battery EVs don’t need engine oil changes. This cost is
              automatically $0.
            </FieldDescription>
          ) : (
            <>
              <NumberField
                id={`${id}-oil-cost`}
                label="Cost per oil change"
                value={m.oilChangeCost}
                onChange={(oilChangeCost) => update({ oilChangeCost })}
                unit="$"
                step={10}
              />
              <FieldGroup className="grid grid-cols-2 gap-4">
                <NumberField
                  id={`${id}-oil-km`}
                  label="Change every"
                  value={m.oilChangeKm}
                  onChange={(oilChangeKm) => update({ oilChangeKm })}
                  unit="km"
                  min={1}
                  step={1000}
                />
                <NumberField
                  id={`${id}-oil-months`}
                  label="Or every"
                  value={m.oilChangeMonths}
                  onChange={(oilChangeMonths) => update({ oilChangeMonths })}
                  unit="months"
                  min={1}
                />
              </FieldGroup>
              <FieldDescription>
                Whichever comes first. Use the manufacturer’s interval and the
                oil/filter service price, excluding work counted elsewhere.
              </FieldDescription>
            </>
          )}
        </FieldSet>
        <Separator />
        <FieldSet>
          <FieldLegend variant="label">02 · Insurance</FieldLegend>
          <NumberField
            id={`${id}-insurance`}
            label="Annual premium"
            value={m.insuranceAnnual}
            onChange={(insuranceAnnual) => update({ insuranceAnnual })}
            unit="$/year"
            step={50}
            description="Use your quote for this vehicle. Multiply a monthly premium by 12."
          />
        </FieldSet>
        <Separator />
        <FieldSet>
          <FieldLegend variant="label">03 · Tyres</FieldLegend>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <NumberField
              id={`${id}-tyre-cost`}
              label={
                car.type === "motorcycle"
                  ? "Replacement tyre pair"
                  : "Replacement set"
              }
              value={m.tyreSetCost}
              onChange={(tyreSetCost) => update({ tyreSetCost })}
              unit="$"
              step={50}
            />
            <NumberField
              id={`${id}-tyre-km`}
              label="Replace every"
              value={m.tyreLifeKm}
              onChange={(tyreLifeKm) => update({ tyreLifeKm })}
              unit="km"
              min={1}
              step={1000}
            />
          </FieldGroup>
          <FieldDescription>
            {car.type === "motorcycle"
              ? "Enter the fitted cost of the front and rear tyres. They may wear at different rates; use an equivalent pair replacement interval."
              : "Include fitting and balancing. The set cost is spread over its expected kilometre life."}
          </FieldDescription>
        </FieldSet>
        <Separator />
        <FieldSet>
          <FieldLegend variant="label">04 · Warrant of fitness</FieldLegend>
          <FieldGroup className="grid grid-cols-2 gap-4">
            <NumberField
              id={`${id}-wof-cost`}
              label="Cost per inspection"
              value={m.wofCost}
              onChange={(wofCost) => update({ wofCost })}
              unit="$"
              step={5}
            />
            <NumberField
              id={`${id}-wof-months`}
              label="Inspection every"
              value={m.wofMonths}
              onChange={(wofMonths) => update({ wofMonths })}
              unit="months"
              min={1}
            />
          </FieldGroup>
          <FieldDescription>
            Enter the interval that applies to your vehicle. Rego is calculated
            separately below.
          </FieldDescription>
        </FieldSet>
      </FieldGroup>
    </FieldSet>
  );
};
