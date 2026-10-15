import { CarFront, Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { fallbackMarket, sourceUrls } from "../shared/market";
import type { MarketData } from "../shared/market";

import { NumberField } from "@/components/calculator-fields";
import { Comparison } from "@/components/comparison";
import { MarketTracker } from "@/components/market-tracker";
import { VehicleCard } from "@/components/vehicle-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { defaultCars, defaultUsage, priceKey } from "@/lib/calculator";
import type { Car, Usage } from "@/lib/calculator";
import { dateLabel } from "@/lib/format";

const fetchMarket = async (
  force: boolean,
  signal?: AbortSignal,
): Promise<MarketData> => {
  const response = await fetch(`/api/market${force ? "?refresh=1" : ""}`, {
    signal,
  });
  if (!response.ok) throw new Error("Market service unavailable");
  const data = (await response.json()) as MarketData;
  if (!data.prices?.electric || !data.rego || !data.motorcycleRego || !data.ruc)
    throw new Error("Invalid market response");
  return data;
};

export const App = () => {
  const [market, setMarket] = useState<MarketData>(fallbackMarket);
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<[Car, Car]>(() =>
    structuredClone(defaultCars),
  );
  const [usage, setUsage] = useState<Usage>(defaultUsage);
  const refresh = useCallback(async (force = false, signal?: AbortSignal) => {
    setLoading(true);
    try {
      setMarket(await fetchMarket(force, signal));
    } catch {
      if (!signal?.aborted)
        setMarket((current) => ({
          ...current,
          errors: [
            "Price service unavailable. Saved reference fees and example or previously fetched prices remain available.",
          ],
        }));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(false, controller.signal);
    const timer = window.setInterval(
      () => {
        void refresh();
      },
      6 * 60 * 60 * 1000,
    );
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);
  const update = (index: number, patch: Partial<Car>) => {
    if (patch.type) {
      const key = priceKey({ ...cars[index], ...patch });
      patch = {
        ...patch,
        price: market.prices[key].value,
        consumptionPresetId: null,
        electricFuelEfficiency: 0,
      };
    }
    setCars(
      (current) =>
        current.map((car, i) => (i === index ? { ...car, ...patch } : car)) as [
          Car,
          Car,
        ],
    );
  };
  return (
    <main className="min-h-svh">
      <div className="app-shell">
        <nav aria-label="Brand" className="app-nav">
          <a className="brand" href="#">
            <span className="brand-mark">
              <CarFront aria-hidden="true" />
            </span>
            roadwise<span className="brand-country">NZ</span>
          </a>
          <span className="text-xs text-muted-foreground">
            Make your next vehicle add up.
          </span>
        </nav>
        <header className="page-heading">
          <div>
            <Badge variant="outline">
              <Check data-icon="inline-start" />
              Built for New Zealand
            </Badge>
            <h1>
              A smarter way
              <br />
              to compare vehicles<span>.</span>
            </h1>
            <p>
              From the pump to the plug, see what your next vehicle really
              costs.
            </p>
          </div>
          <div className="heading-note">
            <span className="eyebrow">The whole picture</span>
            <p>Two vehicles. One clear comparison.</p>
            <span>Energy, rego and road charges included.</span>
          </div>
        </header>
        <MarketTracker
          market={market}
          loading={loading}
          refresh={() => {
            void refresh(true);
          }}
        />
        <Card className="usage-card">
          <CardHeader>
            <CardTitle>Your time on the road</CardTitle>
            <CardDescription>
              A shared driving plan for both options.
            </CardDescription>
            <CardAction>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCars(structuredClone(defaultCars));
                  setUsage(defaultUsage);
                }}
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="annual-km"
                label="Distance per year"
                value={usage.annualKm}
                onChange={(annualKm) => setUsage((u) => ({ ...u, annualKm }))}
                unit="km"
                step={1000}
              />
              <NumberField
                id="ownership-years"
                label="Ownership period"
                value={usage.years}
                onChange={(years) => setUsage((u) => ({ ...u, years }))}
                unit="years"
                step={0.5}
                min={0.5}
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <section
          className="calculator-layout"
          aria-label="Vehicle cost comparison"
        >
          <div className="vehicle-grid">
            {cars.map((car, index) => (
              <VehicleCard
                key={index}
                car={car}
                index={index}
                market={market}
                onChange={(patch) => update(index, patch)}
              />
            ))}
          </div>
          <Comparison cars={cars} usage={usage} market={market} />
        </section>
        <footer className="site-footer">
          <p>Made for the roads of Aotearoa.</p>
          <div className="flex flex-wrap gap-4">
            <a href={sourceUrls.gaspy} target="_blank" rel="noreferrer">
              Gaspy fuel prices ↗
            </a>
            <a href={sourceUrls.electricity} target="_blank" rel="noreferrer">
              MBIE electricity ↗
            </a>
            <a href={sourceUrls.rego} target="_blank" rel="noreferrer">
              NZTA rego ↗
            </a>
            <a href={sourceUrls.ruc} target="_blank" rel="noreferrer">
              NZTA RUC ↗
            </a>
          </div>
          <p className="w-full">
            {market.feesCheckedAt.rego
              ? `Rego checked ${dateLabel(market.feesCheckedAt.rego)}.`
              : "Rego reference schedule: from 1 July 2026; not freshly verified."}{" "}
            {market.feesCheckedAt.ruc
              ? `RUC checked ${dateLabel(market.feesCheckedAt.ruc)}.`
              : "RUC reference rates: $76 light vehicles / $38 petrol PHEVs; not freshly verified."}{" "}
            Rego means annual vehicle licensing, not first registration.
          </p>
        </footer>
      </div>
    </main>
  );
};
