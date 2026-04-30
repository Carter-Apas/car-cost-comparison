# car-cost-comparison

A frontend-only Vite app for comparing the ownership cost of two cars in NZD.

The calculator supports capex, annual opex, fuel or EV charging costs, RUC, ownership period, annual kilometres, capex-inclusive cost per kilometre, and raw running cost per kilometre.

## Development

```sh
npm install
npm run dev
```

## Checks

```sh
npm run format:check
npm run lint
npm run build
```

## Docker

```sh
docker build -t car-cost-comparison .
docker run --rm -p 8080:80 car-cost-comparison
```
