import { ExternalLink, Fuel, Info, RefreshCw, Zap } from "lucide-react";

import type { MarketData } from "../../shared/market";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fuelLabels } from "@/lib/calculator";
import { dateLabel, observationSource, precise } from "@/lib/format";
import { cn } from "@/lib/utils";

const priceStatus = (
  price: MarketData["prices"]["electric"],
  electric: boolean,
) => {
  if (price.status === "estimate") return "Example";
  if (
    price.date &&
    Date.now() - new Date(price.date).getTime() >
      (electric ? 120 : 21) * 86400000
  )
    return "Older data";
  return price.status === "cached" ? "Saved" : observationSource(price);
};

export const MarketTracker = ({
  market,
  loading,
  refresh,
}: {
  market: MarketData;
  loading: boolean;
  refresh: () => void;
}) => (
  <section aria-labelledby="market-title" className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="market-title" className="text-lg font-semibold">
          The New Zealand price watch
        </h2>
        <p className="text-sm text-muted-foreground">
          National energy averages · NZD, including GST
        </p>
      </div>
      <Button variant="outline" size="sm" disabled={loading} onClick={refresh}>
        <RefreshCw
          data-icon="inline-start"
          className={cn(loading && "animate-spin")}
        />
        {loading ? "Checking sources…" : "Refresh prices"}
      </Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(["petrol91", "petrol95", "diesel", "electric"] as const).map((key) => {
        const price = market.prices[key];
        const isEstimate = price.status === "estimate";
        return (
          <Card size="sm" key={key} className="price-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {key === "electric" ? (
                  <Zap aria-hidden="true" />
                ) : (
                  <Fuel aria-hidden="true" />
                )}
                {key === "electric" ? "Home electricity" : fuelLabels[key]}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  {priceStatus(price, key === "electric")}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="price-value">
                {key === "electric"
                  ? `${(price.value * 100).toFixed(1)}¢`
                  : precise.format(price.value)}
                <span> / {key === "electric" ? "kWh" : "litre"}</span>
              </p>
            </CardContent>
            <CardFooter className="justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {isEstimate
                  ? "Example input · not a fetched average"
                  : dateLabel(price.date)}
              </span>
              <a
                href={price.source}
                target="_blank"
                rel="noreferrer"
                aria-label={`${fuelLabels[key]} source at ${observationSource(price)}`}
              >
                <ExternalLink className="size-3.5" />
              </a>
            </CardFooter>
          </Card>
        );
      })}
    </div>
    {!loading &&
      (market.errors.length > 0 ||
        Object.values(market.prices).some((p) => p.status === "estimate")) && (
        <Alert>
          <Info />
          <AlertTitle>Some sources couldn’t be refreshed</AlertTitle>
          <AlertDescription>
            {market.errors.length
              ? market.errors.join(" ")
              : "Source averages have not been downloaded yet. Example prices are shown; enter your own prices below."}
          </AlertDescription>
        </Alert>
      )}
    <p className="text-xs leading-5 text-muted-foreground">
      Fuel uses Gaspy’s live national averages; residential electricity is
      published quarterly. Electricity includes household fixed charges and is a
      benchmark, not an EV charging tariff. Use your own rate for off-peak or
      public charging.{" "}
      {market.checkedAt && `Last checked ${dateLabel(market.checkedAt)}.`}
    </p>
  </section>
);
