import type { ReactNode } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { numberValue } from "@/lib/format";

export const NumberField = ({
  id,
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max,
  disabled = false,
  description,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  description?: string;
}) => (
  <Field data-disabled={disabled}>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <div className="number-control">
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            Math.min(
              max ?? Infinity,
              Math.max(min, numberValue(e.target.value)),
            ),
          )
        }
        aria-describedby={description ? `${id}-help` : undefined}
      />
      {unit && <span aria-hidden="true">{unit}</span>}
    </div>
    {description && (
      <FieldDescription id={`${id}-help`}>{description}</FieldDescription>
    )}
  </Field>
);
export const SelectField = ({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) => (
  <Field>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <NativeSelect
      className="w-full"
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </NativeSelect>
  </Field>
);
export const ToggleField = ({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <Field orientation="horizontal">
    <FieldContent>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
    </FieldContent>
    <Switch
      aria-label={label}
      id={id}
      checked={checked}
      onCheckedChange={onChange}
    />
  </Field>
);
