# Roadwise — New Zealand car cost calculator

Compare two cars using purchase cost, annual distance, energy consumption, a checklist of oil changes, insurance, tyres and WoF, vehicle licensing (rego), and road user charges (RUC). Supports petrol 91, petrol 95, diesel, battery EVs, petrol plug-in hybrids and petrol motorcycles.

## Run locally

Requires Node 22.18+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Vite serves the calculator and `/api/market` in development. For the production app:

```sh
npm run build
PORT=8080 npm start
```

`npm run preview` previews the static UI only; use `npm start` to test production source refreshes.

## Prices and fees

The server checks price and fee sources at startup and every six hours. The UI also checks on opening and every six hours; its Refresh button requests a source check, rate-limited to once per minute. Simultaneous requests share one refresh.

- **Fuel:** [Gaspy’s live New Zealand fuel statistics](https://www.gaspy.nz/stats.html), using the same public Firebase JSON feed as that page. Reads national averages for 91, 95 and diesel, converts cents/litre to NZD/litre, and retains Gaspy’s database update date. Each value must be a positive numeric price and all three grades must be present. If Gaspy is unavailable or invalid, retains the last successfully fetched Gaspy averages and shows a warning. There is no alternate fuel source; legacy MBIE fuel cache entries are discarded. No Firebase SDK or API key is required.
- **Electricity:** [MBIE Quarterly Survey of Domestic Electricity Prices](https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/energy-prices/electricity-cost-and-price-monitoring). Discovers the newest XLSX and reads its labelled nominal New Zealand retail total. This is a residential benchmark including fixed household charges, not a marginal EV charging tariff or wholesale price. Enter your own off-peak, public or blended charging rate for a closer estimate.
- **Rego:** [NZTA licensing fees](https://www.nzta.govt.nz/vehicles/licensing-rego/vehicle-fees/licensing-fees). Private passenger car, 12-month online licence, including GST and administration. The bundled reference schedule is effective from 1 July 2026: petrol/petrol hybrids $181.45; diesel/electric $248.83. Other vehicle classes can use custom fees. Rego is recurring licensing, not initial registration.
- **RUC:** [NZTA rates and transaction fees](https://www.nzta.govt.nz/vehicles/road-user-charges/ruc-rates-and-transaction-fees). Reference rates: two-axle light diesel/EV $76/1,000 km, petrol PHEV $38/1,000 km; online admin $12.44, agent $13.71. EV/PHEV presets assume more than 1,000 kg and no more than 3,500 kg. Use custom/excluded fees for exemptions or other weights.

Successful observations are saved in `.cache/market.json` (override with `MARKET_CACHE_FILE`) and reused if a source fails. The UI displays publication dates, failed checks and older observations (fuel over 21 days, electricity over 120 days). Initial energy values are explicitly labelled **examples**, never fetched averages. Fee presets are labelled as reference rates until freshly checked. Each source can fail independently; errors never replace previously fetched prices with fabricated averages.

**Access checks and recovery:** Some government URLs return HTTP 200 with an Incapsula access-check page instead of source content. These are detected before parsing and reported as blocked automated access, rather than a changed fee/table format. Fuel still uses Gaspy only.

For electricity, the release index remains the preferred discovery method. If it or the linked download fails, the server checks the last four non-future quarterly MBIE asset URLs using the published `qsdep-report-15Aug2026.xlsx` naming convention. Downloads must be XLSX files and the nominal report's internal date must match the candidate date before its labelled New Zealand retail total is accepted. The newest valid download is selected, older downloads never replace newer cached data, and the UI warns that the latest release could not be confirmed when the index was inaccessible. This filename convention is a recovery mechanism, not a guaranteed permanent MBIE API.

**Live verification, 15 October 2026:** The MBIE HTML index returned an access check, but its official August workbook downloaded successfully through the recovery path: **$0.421476585176786/kWh** (shown as **42.1¢/kWh**), dated **15 August 2026**. Both NZTA URLs still returned access checks, including in a browser. Fresh NZTA fee verification remains blocked by the source; the app does not mark reference fees as freshly fetched. It continues to attempt both pages at each refresh. The expandable **Fee sources & rates in use** panel shows every active reference/cached fee, links its source, and identifies the reference schedule or last successful download. The fee inputs also identify when they are using reference rates.

**Fallback values:** A failed refresh retains a successfully cached value. On a fresh installation without a successful download, energy examples are petrol 91 **$2.70/L**, petrol 95 **$2.90/L**, diesel **$2.10/L** and electricity **$0.30/kWh**; these are labelled examples. Rego references are petrol/hybrid **$181.45/year**, diesel/EV **$248.83/year** (from **1 July 2026**). Motorcycle references are **$431.52**, **$456.24**, **$606.29** and **$816.45/year** for the four engine bands below. RUC references are **$76/1,000 km** light diesel/EV, **$38/1,000 km** petrol PHEV, with **$12.44 online** or **$13.71 agent** administration per licence. Failed downloads do not update the fee verification timestamps. Custom/excluded fees override these presets.

## Data sources and reference notes

Reference review: **15 October 2026**. The figures below are dated examples or reference schedules, not a promise that prices and fees will remain unchanged. Use the original pages when reviewing defaults or repairing an importer.

| Data                                   | Source                                                                                                                                                                                                                                                                                                                                                                             | How the calculator uses it                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| National fuel averages                 | [Gaspy statistics](https://www.gaspy.nz/stats.html), [public JSON feed](https://gaspy-datamine-stats.firebaseio.com/datamine.json), [page JavaScript](https://www.gaspy.nz/assets/stats-page.min.js)                                                                                                                                                                               | Reads `Averages["91"].Average`, `Averages["95"].Average`, `Averages.Diesel.Average` and `Updated`. Prices are cents/litre, converted to dollars/litre. The JavaScript confirms the feed and units used by Gaspy's own page. Gaspy is the only fuel source.                                                                                                                                                                                                                               |
| Residential electricity benchmark      | [MBIE electricity cost and price monitoring](https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/energy-prices/electricity-cost-and-price-monitoring), [15 August 2026 QSDEP workbook](https://www.mbie.govt.nz/assets/Data-Files/Energy/nz-energy-quarterly-and-energy-in-nz/qsdep-report-15Aug2026.xlsx) | Discovers the newest dated workbook from the source page. The verified August workbook contains the New Zealand nominal retail indicator in `QSDEP_Summary_Report`, cell `F14`: approximately **42.1 cents/kWh**. It includes household fixed charges. The release index is preferred; dated direct quarterly asset downloads provide recovery when it is blocked. Workbook dates are validated internally, and the UI does not claim it confirmed the latest release without the index. |
| Annual vehicle licensing (rego)        | [NZTA licensing fees](https://www.nzta.govt.nz/vehicles/licensing-rego/vehicle-fees/licensing-fees)                                                                                                                                                                                                                                                                                | Uses the active dated private-passenger schedule, including the combined diesel/electric category. Reference fees from **1 July 2026**: petrol/petrol hybrids **$181.45**, diesel/EV **$248.83**, for 12 months online, including GST and administration. Automated downloads remain blocked in the development environment.                                                                                                                                                             |
| Road user charges and transaction fees | [NZTA RUC rates and transaction fees](https://www.nzta.govt.nz/vehicles/road-user-charges/ruc-rates-and-transaction-fees), [NZTA electric-vehicle RUC guidance](https://www.nzta.govt.nz/vehicles/road-user-charges/ruc-for-electric-vehicles)                                                                                                                                     | Light two-axle diesel/EV reference rate **$76/1,000 km**; petrol PHEV **$38/1,000 km**. Administration: **$12.44 online**, **$13.71 at an agent**. Vehicle weight and exemption rules matter; see the source pages.                                                                                                                                                                                                                                                                      |

### Tyre cost and lifespan references

The default **$1,200 per four-tyre replacement set** is a planning example, not a measured NZ average or a vehicle-specific quote. Prices vary by tyre size, model and included services.

[Advantage Tyres' 215/55R17 range](https://advantagetyres.co.nz/shop/size/215-55r17-tyres/) listed these examples when checked on 15 October 2026:

| Tyre                         | Price per tyre | Four tyres, before fitting and fees |
| ---------------------------- | -------------- | ----------------------------------- |
| Hifly HF805                  | $164.80        | $659.20                             |
| BFGoodrich Advantage Control | $260.45        | $1,041.80                           |
| Michelin Primacy 5           | $314.00        | $1,256.00                           |

These retail prices **exclude fitting services and fees**. The calculator's replacement-set input should include fitting and balancing, so use a fitted quote when available. The examples support $1,200 as a plausible starting budget, but do not establish a universal fitted price.

[Bridgestone NZ's tyre age and lifespan guidance](https://www.bridgestone.co.nz/tyres/learn/maintenance/age-of-a-tyre) gives **40,000–80,000 km** for most passenger-car tyres under normal driving and good care. The calculator uses the lower end, **40,000 km**, as a conservative starting assumption. This is not a guaranteed service life; wear, vehicle characteristics, maintenance and age also matter. [Bridgestone's maintenance guidance](https://www.bridgestone.co.nz/tyres/learn/maintenance) covers pressure, rotation, alignment and condition checks.

At the default 15,000 km/year, the example calculation is `$1,200 × 15,000 / 40,000 = $450/year`. This spreads replacement cost over distance; it is not a prediction of the exact purchase date and does not currently model age-based replacement.

### Inputs without a published average

Oil changes (**$200**, every **10,000 km or 12 months**), insurance (**$1,000/year**) and WoF (**$80**, every **12 months**) are editable example inputs, not sourced national averages. Use the vehicle manufacturer's service schedule, a garage quote, an insurer quote, and the WoF inspection price and interval applicable to the vehicle. Do not present these defaults as official rates.

### Motorcycle costs and sources

The **Motorcycle (petrol)** option covers petrol motorcycles, including scooters registered as motorcycles. It uses Gaspy's selected 91/95 price and L/100 km consumption, plus oil changes, insurance, tyre replacements and WoF. Enter motorcycle-specific purchase and maintenance costs; the existing cost inputs are editable examples. The tyre input represents a front/rear pair, whose wear rates can differ.

[NZTA licensing fees](https://www.nzta.govt.nz/vehicles/licensing-rego/vehicle-fees/licensing-fees), reviewed 15 October 2026, publishes these private-passenger petrol motorcycle fees for 12 months online, including GST and administration, for licences starting from **1 July 2026**:

| Engine capacity | Annual rego |
| --------------- | ----------- |
| 0–60 cc         | $431.52     |
| 61–250 cc       | $456.24     |
| 251–750 cc      | $606.29     |
| 751 cc and over | $816.45     |

Engine capacity selects the motorcycle rego band automatically; selecting a consumption example fills the manufacturer's actual cc value. Mopeds use a separate licensing schedule: engine size alone does not turn a vehicle into a moped. The fee importer reads the dated **Motorcycles** section independently of passenger cars and mopeds. Saved motorcycle reference fees remain available when NZTA blocks access, and legacy caches are backfilled without claiming a fresh verification.

**RUC:** Petrol motorcycles use a default **$0 RUC** because petrol is taxed at the pump; this is not an exemption from contributing to road costs. See [NZTA About RUC](https://www.nzta.govt.nz/vehicles/road-user-charges/about-ruc). For future electric-motorcycle support, [NZTA's RUC exemptions](https://www.nzta.govt.nz/vehicles/road-user-charges/ruc-exemptions) also exempts electric vehicles at or below **1,000 kg**. Diesel or other untaxed-fuel motorcycles must not be assumed exempt; use their actual applicable rate. Custom and excluded rego/RUC overrides remain available.

Five manufacturer-sourced motorcycle examples were reviewed on **15 October 2026**:

| Example                          | Capacity | Fuel consumption | Market / test basis              | Source                                                                                                            |
| -------------------------------- | -------- | ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2025 Honda PCX125                | 125 cc   | 2.1 L/100 km     | UK / Honda published figure      | [Honda specifications](https://www.honda.co.uk/motorcycles/range/scooter/pcx-125/specifications.html)             |
| 2024 Honda CB500 Hornet          | 471 cc   | 3.5 L/100 km     | Europe / WMTC                    | [Honda 24YM press kit](https://hondanews.eu/eu/en/motorcycles/media/pressreleases/452842/24ym-honda-cb500-hornet) |
| 2025 Yamaha MT-07 manual         | 689 cc   | 4.1 L/100 km     | Europe / Yamaha published figure | [Yamaha specifications](https://www.yamaha-motor.eu/de/de/motorcycles/hyper-naked/pdp/mt-07/)                     |
| BMW R 1300 GS (2024 generation)  | 1,300 cc | 4.8 L/100 km     | NZ / WMTC                        | [BMW Motorrad NZ specifications](https://www.bmw-motorrad.co.nz/en/models/adventure/r1300gs/technicaldata.html)   |
| 2025 Harley-Davidson Sportster S | 1,252 cc | 5.1 L/100 km     | UK / EU 134/2014                 | [Harley-Davidson specifications](https://www.harley-davidson.com/gb/en/motorcycles/2025/sportster-s.html)         |

These are guide figures for the stated variants, not measured NZ fleet averages. In particular, the UK PCX125 and European 689 cc MT-07 may differ from NZ-market engine sizes or LAMS variants. Fuel-grade selections are editable; check the manufacturer's requirement for the actual bike. The BMW page currently lists 95 RON with adaptive 91–98 RON operation.

### Vehicle consumption examples

The consumption dropdown contains **30 curated examples: five each for petrol 91, petrol 95, diesel, electric, petrol plug-in hybrid and petrol motorcycles**. The examples span hatchbacks, sedans, crossovers, large SUVs and a ute. They fill consumption inputs, petrol grade for PHEVs and motorcycles, and motorcycle engine capacity for rego, while purchase price, maintenance, distance and fees remain your own inputs. Editing consumption returns the selector to Custom; changing powertrain clears the selected example. Display labels are generated from the selected example and powertrain (including the petrol grade for motorcycles and plug-in hybrids). Custom consumption uses the powertrain label. Option 1 and Option 2 remain as references for the cost columns; there is no separate name input.

Source review: **15 October 2026**. The catalogue is stored in [src/lib/consumption-presets.json](src/lib/consumption-presets.json). Each entry includes its year/variant, market, test basis, source link, review date and, for EPA records, the original numeric fields. These are static reference examples, not a live vehicle lookup.

Sources used:

- [Toyota NZ's 2019 Prius announcement](https://www.toyota.co.nz/about-toyota/toyota-news/2019/march/new-zealands-bestselling-hybrid-just-got-better/): original published combined consumption for the 1.8 hybrid.
- [Ford NZ's 2017 Ranger brochure](https://www.ford.co.nz/content/dam/Ford/website-assets/ap/nz/nameplate/ranger/brochure/Ford%20Ranger%20Brochure%202017.pdf), printed pages 20–21: Wildtrak 3.2 4WD automatic, combined ADR 81/02 consumption. This is a ute; passenger-car rego presets do not describe its licensing class.
- [Kia NZ's October 2023 EV9 brochure](https://www.kia.co.nz/assets/Uploads/KI0058-EV9-Brochure-OCT23-Portrait.pdf), page 10: GT-Line AWD 99.8 kWh, combined WLTP electricity consumption.
- [US DOE/EPA FuelEconomy.gov downloads](https://www.fueleconomy.gov/feg/download.shtml), [all-years CSV archive](https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip) and [field documentation](https://www.fueleconomy.gov/feg/ws/index.shtml): 22 model-specific records, linked individually below. US specification and EPA test figures are identified in the UI; they may differ from NZ-market engines, equipment and homologation figures. The current all-years dataset includes revised older estimates.
- [Rightcar's energy economy explanation](https://rightcar.govt.nz/fuel-economy): NZ comparison context and the limits of manufacturer laboratory ratings. Rightcar was consulted for methodology; its vehicle database was not imported into the preset catalogue.

**Units and interpretation:** EPA `comb08` is converted from US MPG using `L/100 km = 235.214583 / MPG`; `combE` is converted using `kWh/100 km = kWh/100 miles / 1.609344`. Values are rounded to one decimal. EPA electricity figures include charging losses; do not add another blanket charging-loss uplift to those presets. Original NZ manufacturer figures are retained in their stated units and test basis. EPA, ADR and manufacturer combined figures are not converted into a single test cycle, and the examples are guides rather than a claim of identical test conditions or real-world efficiency. Verify the required fuel grade for your actual car; the petrol dropdown categories are price scenarios, not manufacturer approval for every NZ variant.

**PHEVs:** Use the petrol rate with a depleted battery (`comb08`), charged-mode electricity (`combE`) and any charged-mode petrol consumption (`combinedCD`, converted from US gallons/100 miles using `× 2.35214583`). This avoids entering the headline weighted PHEV L/100 km figure and then discounting petrol kilometres a second time. Volvo's selected records include a small amount of charged-mode petrol use; the calculator counts it separately. The user's charged-battery distance share remains adjustable and is not inferred from the vehicle's claimed range. See the [EPA PHEV label explanation](https://www.fueleconomy.gov/feg/label/learn-more-PHEV-label.shtml) and [EV label explanation](https://www.fueleconomy.gov/feg/label/learn-more-electric-label.shtml).

| Category  | Example vehicle                        | Petrol/diesel L/100 km | Electricity kWh/100 km | Charged-mode petrol L/100 km | Market / test basis                             | Source                                                                                                                                                             |
| --------- | -------------------------------------- | ---------------------- | ---------------------- | ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Petrol 91 | 2019 Toyota Prius SX 1.8 hybrid        | 3.4                    | —                      | —                            | NZ specification / Toyota NZ published combined | [Toyota New Zealand](https://www.toyota.co.nz/about-toyota/toyota-news/2019/march/new-zealands-bestselling-hybrid-just-got-better/)                                |
| Petrol 91 | 2024 Toyota Corolla LE 2.0 CVT         | 6.7                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47343.shtml)                                                                                   |
| Petrol 91 | 2024 Mazda3 2.5 hatch automatic        | 7.8                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/46797.shtml)                                                                                   |
| Petrol 91 | 2024 Toyota RAV4 LE 2.5 AWD            | 7.8                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47390.shtml)                                                                                   |
| Petrol 91 | 2024 Subaru Forester 2.5 AWD           | 8.1                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47161.shtml)                                                                                   |
| Petrol 95 | 2024 MINI Cooper 1.5 automatic         | 7.4                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/46482.shtml)                                                                                   |
| Petrol 95 | 2024 Audi A4 40 TFSI quattro 2.0       | 7.8                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/46652.shtml)                                                                                   |
| Petrol 95 | 2024 Audi A6 55 TFSI quattro 3.0 V6    | 9.4                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47062.shtml)                                                                                   |
| Petrol 95 | 2024 Subaru WRX 2.4 manual             | 10.7                   | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47580.shtml)                                                                                   |
| Petrol 95 | 2024 Audi Q7 55 TFSI quattro 3.0 V6    | 11.2                   | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47174.shtml)                                                                                   |
| Diesel    | 2015 BMW 328d 2.0 automatic            | 6.5                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/35538.shtml)                                                                                   |
| Diesel    | 2015 Volkswagen Golf 2.0 TDI DSG       | 6.7                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/35352.shtml)                                                                                   |
| Diesel    | 2015 BMW X5 xDrive35d 3.0              | 8.7                    | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/35587.shtml)                                                                                   |
| Diesel    | 2017 Ford Ranger Wildtrak 3.2 4WD auto | 8.9                    | —                      | —                            | NZ specification / ADR 81/02 combined           | [Ford New Zealand brochure, pp. 20–21](https://www.ford.co.nz/content/dam/Ford/website-assets/ap/nz/nameplate/ranger/brochure/Ford%20Ranger%20Brochure%202017.pdf) |
| Diesel    | 2017 Land Rover Discovery 3.0 diesel   | 10.2                   | —                      | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/38715.shtml)                                                                                   |
| Electric  | 2024 Tesla Model 3 RWD                 | —                      | 15.8                   | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47909.shtml)                                                                                   |
| Electric  | 2024 Hyundai Kona Electric Long Range  | —                      | 18.1                   | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47449.shtml)                                                                                   |
| Electric  | 2024 Hyundai IONIQ 5 Long Range RWD    | —                      | 18.6                   | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/46960.shtml)                                                                                   |
| Electric  | 2024 Nissan Leaf 40 kWh                | —                      | 18.9                   | —                            | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/46973.shtml)                                                                                   |
| Electric  | 2023 Kia EV9 GT-Line AWD 99.8 kWh      | —                      | 22.8                   | —                            | NZ specification / WLTP combined                | [Kia New Zealand October 2023 brochure, p. 10](https://www.kia.co.nz/assets/Uploads/KI0058-EV9-Brochure-OCT23-Portrait.pdf)                                        |
| PHEV      | 2024 Toyota Prius Prime SE             | 4.5                    | 16.2                   | 0.0                          | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47501.shtml)                                                                                   |
| PHEV      | 2024 Toyota RAV4 Prime AWD             | 6.2                    | 22.4                   | 0.0                          | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47502.shtml)                                                                                   |
| PHEV      | 2024 Volvo XC60 T8 AWD Recharge        | 8.4                    | 31.1                   | 0.2                          | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47504.shtml)                                                                                   |
| PHEV      | 2024 Volvo XC90 T8 AWD Recharge        | 8.7                    | 34.2                   | 0.2                          | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47505.shtml)                                                                                   |
| PHEV      | 2024 Mitsubishi Outlander PHEV AWD     | 9.0                    | 32.3                   | 0.0                          | US specification / EPA combined                 | [US EPA / FuelEconomy.gov](https://www.fueleconomy.gov/feg/noframes/47499.shtml)                                                                                   |

## Calculation assumptions

Energy consumption uses L/100 km or kWh/100 km (include charging losses in the EV consumption figure). PHEVs split distance between depleted-battery and charged-battery modes, including any petrol used in charged mode, and pay RUC over all kilometres. Oil changes use your per-service quote and kilometre/month intervals (whichever comes first); battery EVs automatically exclude engine oil. Insurance uses an annual premium. Tyres use a fitted set cost and expected kilometre life. WoF uses your inspection price and applicable month interval. All starting costs are editable examples; set a cost to zero to exclude it. These items are annualised rather than rounded to whole prepaid events. Fees can use NZTA presets, custom values or be excluded.

RUC transaction fees are amortised over the chosen purchase distance, since licences carry forward across years; this is a running-cost estimate rather than the exact cash paid for prepaid blocks. Prices remain constant through the selected ownership period. Totals exclude resale value and finance. Zero annual distance gives no per-kilometre value.

## Docker

```sh
docker build -t roadwise .
docker run --rm -p 8080:80 -v roadwise-market:/app/.cache roadwise
```

The container serves the UI and source-refresh API with Node 24 on port 80. Mount `/app/.cache` to retain observations across deployments. No API keys are needed.

## Checks

```sh
npm run build
npm run lint
npm test
npm run format:check
```
