import { ExternalLink } from "lucide-react";

import { SelectField } from "@/components/calculator-fields";
import { FieldDescription } from "@/components/ui/field";
import { NativeSelectOption } from "@/components/ui/native-select";
import type { Car } from "@/lib/calculator";
import {
  presetPatch,
  presetsFor,
  presetSummary,
} from "@/lib/consumption-presets";

export const ConsumptionSelector = ({
  car,
  index,
  onChange,
}: {
  car: Car;
  index: number;
  onChange: (patch: Partial<Car>) => void;
}) => {
  const examples = presetsFor(car.type);
  const selected = examples.find(
    (example) => example.id === car.consumptionPresetId,
  );
  const choose = (id: string) => {
    const example = examples.find((preset) => preset.id === id);
    onChange(example ? presetPatch(example) : { consumptionPresetId: null });
  };
  return (
    <>
      <SelectField
        id={`car-${index}-consumption-example`}
        label="Example vehicle consumption"
        value={selected?.id ?? "custom"}
        onChange={choose}
      >
        <NativeSelectOption value="custom">
          Custom — enter your own consumption
        </NativeSelectOption>
        {examples.map((example) => (
          <NativeSelectOption key={example.id} value={example.id}>
            {example.name} ({example.year}) · {presetSummary(example)}
          </NativeSelectOption>
        ))}
      </SelectField>
      {selected ? (
        <FieldDescription>
          <strong>
            {selected.year} {selected.name}
          </strong>{" "}
          · {selected.size}
          <br />
          {presetSummary(selected)} · {selected.basis} · {selected.market}
          <br />
          {selected.notes}{" "}
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
            {selected.sourceName}{" "}
            <ExternalLink aria-hidden="true" className="inline size-3" />
          </a>
        </FieldDescription>
      ) : (
        <FieldDescription>
          Pick an example as a starting point, or enter your measured
          consumption.
        </FieldDescription>
      )}
      <FieldDescription>
        Examples fill consumption and petrol grade for plug-in hybrids and
        motorcycles, plus motorcycle engine capacity for rego. Check the year,
        variant and recommended petrol grade, and enter your own purchase price
        and running costs. Published test figures can differ from real driving.
      </FieldDescription>
    </>
  );
};
