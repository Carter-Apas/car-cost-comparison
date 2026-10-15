import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import type { MarketData } from "../../shared/market";

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
import { Separator } from "@/components/ui/separator";
import type { Car, Usage } from "@/lib/calculator";
import { calculate } from "@/lib/calculator";
import { vehicleLabel } from "@/lib/consumption-presets";
import { dollars, precise } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Comparison = ({
  cars,
  usage,
  market,
}: {
  cars: [Car, Car];
  usage: Usage;
  market: MarketData;
}) => {
  const labels = cars.map(vehicleLabel);
  const totals = cars.map((car) => calculate(car, usage, market));
  const difference = Math.abs(totals[0].total - totals[1].total);
  const cheaper = totals[0].total <= totals[1].total ? 0 : 1;
  const annualSaving = totals[0].annual - totals[1].annual;
  const extraPurchase = cars[1].purchase - cars[0].purchase;
  const breakEven = annualSaving !== 0 ? extraPurchase / annualSaving : null;
  const maxTotal = Math.max(...totals.map((t) => t.total), 1);
  const rows = [
    ["Energy", "energy"],
    ["Rego", "rego"],
    ["Road user charges", "ruc"],
    ["RUC admin fees", "rucAdmin"],
    ["Oil changes", "oil"],
    ["Insurance", "insurance"],
    ["Tyres", "tyres"],
    ["WoF", "wof"],
  ] as const;
  return (
    <Card className="comparison-card lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Your comparison</CardTitle>
        <CardDescription>
          {usage.years} years ·{" "}
          {new Intl.NumberFormat("en-NZ").format(usage.annualKm * usage.years)}{" "}
          km
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">NZD</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="saving-panel" aria-live="polite">
          <p className="eyebrow">
            {difference < 0.01
              ? "Equal ownership cost"
              : `Lower total cost · Option ${cheaper + 1}`}
          </p>
          <p className="winner-name">
            {difference < 0.01 ? "It’s a tie" : labels[cheaper]}
          </p>
          <p className="saving-value">
            {dollars.format(difference)}
            <ArrowDownRight aria-hidden="true" />
          </p>
          <p className="text-sm text-muted-foreground">
            {difference < 0.01
              ? "Both options cost the same over this period."
              : `less over ${usage.years} years of ownership`}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {labels.map((label, i) => (
            <div key={i}>
              <div className="mb-2 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Option {i + 1}
                  </p>
                  <p className="break-words" title={label}>
                    {label}
                  </p>
                </div>
                <strong className="shrink-0 whitespace-nowrap">
                  {dollars.format(totals[i].total)}
                </strong>
              </div>
              <div className="comparison-track">
                <div
                  className={cn(
                    "comparison-bar",
                    i === 1 && "comparison-bar-electric",
                  )}
                  style={{ width: `${(totals[i].total / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="overflow-x-auto">
          <table className="cost-table">
            <caption>Annual running costs</caption>
            <thead>
              <tr>
                <th scope="col">Cost</th>
                {labels.map((label, i) => (
                  <th
                    key={i}
                    scope="col"
                    aria-label={`Option ${i + 1}: ${label}`}
                  >
                    <span title={label}>{`Option ${i + 1}`}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {totals.map((t, i) => (
                    <td key={i}>{dollars.format(t[key])}</td>
                  ))}
                </tr>
              ))}
              <tr className="table-total">
                <th scope="row">Total / year</th>
                {totals.map((t, i) => (
                  <td key={i}>{dollars.format(t.annual)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Running / km</th>
                {totals.map((t, i) => (
                  <td key={i}>
                    {t.runningPerKm === null
                      ? "—"
                      : precise.format(t.runningPerKm)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Ownership / km</th>
                {totals.map((t, i) => (
                  <td key={i}>
                    {t.perKm === null ? "—" : precise.format(t.perKm)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {breakEven !== null && breakEven > 0 && extraPurchase !== 0 && (
          <p className="text-sm leading-6 text-muted-foreground">
            <ArrowUpRight className="mr-1 inline size-4" />
            The higher purchase price is recovered after about{" "}
            <strong className="text-foreground">
              {breakEven.toFixed(1)} years
            </strong>{" "}
            at these running costs.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs leading-5 text-muted-foreground">
          Includes purchase and running costs. Excludes resale value,
          depreciation adjustments and finance. Prices stay constant across the
          ownership period. Oil changes, tyres and WoF are annualised from your
          intervals; RUC admin fees are amortised over distance.
        </p>
      </CardFooter>
    </Card>
  );
};
