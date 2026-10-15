import { load } from "cheerio";
import ExcelJS from "exceljs";

import type { MarketData, Observation } from "../shared/market.ts";
import { sourceUrls } from "../shared/market.ts";

const validPrice = (value: number) =>
  Number.isFinite(value) && value > 0 && value < 15;
export const isoDate = (value: string) => {
  const uk = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = new Date(
    uk
      ? `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}T00:00:00Z`
      : /[A-Za-z]/.test(value)
        ? `${value} UTC`
        : value,
  );
  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() > Date.now() + 86400000
  )
    throw new Error("Invalid publication date");
  return date.toISOString().slice(0, 10);
};
const gaspyPrice = (cents: unknown) => {
  if (typeof cents !== "number" || !validPrice(cents / 100))
    throw new Error("Invalid Gaspy fuel average");
  return cents / 100;
};
export const parseGaspy = (data: unknown): Partial<MarketData["prices"]> => {
  if (
    !data ||
    typeof data !== "object" ||
    !("Updated" in data) ||
    !("Averages" in data)
  )
    throw new Error("Gaspy averages missing");
  const updated = String(data.Updated).match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+@/,
  );
  if (!updated) throw new Error("Gaspy update date missing or invalid");
  const date = isoDate(`${updated[1]} ${updated[2]} ${updated[3]}`);
  const averages = data.Averages as Record<string, { Average?: unknown }>;
  if (!averages || typeof averages !== "object")
    throw new Error("Gaspy average format changed");
  const result: Partial<MarketData["prices"]> = {};
  const fuels = { petrol91: "91", petrol95: "95", diesel: "Diesel" } as const;
  for (const [key, fuel] of Object.entries(fuels)) {
    const cents = averages[fuel]?.Average;
    result[key as keyof typeof fuels] = {
      value: gaspyPrice(cents),
      date,
      source: sourceUrls.gaspy,
      status: "live",
    };
  }
  return result;
};

export const discoverWorkbook = (html: string) => {
  const $ = load(html);
  const links = $("a[href]")
    .toArray()
    .map((a) => ({ text: $(a).text().trim(), href: $(a).attr("href")! }))
    .filter(
      (a) =>
        /Quarterly Survey of Domestic Electricity Prices/i.test(a.text) &&
        /xlsx/i.test(a.text + a.href),
    );
  const dated = links
    .map((a) => ({
      ...a,
      date: a.text.match(/15\s+(?:February|May|August|November)\s+\d{4}/i)?.[0],
    }))
    .filter((a) => a.date)
    .map((a) => ({ ...a, date: isoDate(a.date!) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!dated[0]) throw new Error("MBIE electricity workbook link not found");
  return {
    url: new URL(dated[0].href, sourceUrls.electricity).href,
    date: dated[0].date,
  };
};
const cellNumber = (cell: ExcelJS.Cell) =>
  Number(
    typeof cell.value === "object" && cell.value && "result" in cell.value
      ? cell.value.result
      : cell.value,
  );
export const parseElectricity = async (
  buffer: Buffer,
  date: string,
): Promise<Observation> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const reportSheets = workbook.worksheets
    .filter((sheet) => !/real|raw|historic|time series/i.test(sheet.name))
    .filter((sheet) => {
      const dates: string[] = [];
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          if (typeof cell.value !== "string") return;
          const match = cell.value.match(
            /Nominal indicators on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
          );
          if (match) dates.push(isoDate(match[1]));
        }),
      );
      return dates.includes(date);
    });
  if (!reportSheets.length)
    throw new Error(
      "MBIE workbook publication date does not match the requested report",
    );
  // Read a labelled national total from the current nominal summary. Never average towns,
  // use wholesale prices, or choose an unlabelled numeric cell.
  for (const sheet of reportSheets) {
    let totalColumn = 0;
    let price: number | null = null;
    sheet.eachRow((row) => {
      row.eachCell((cell, column) => {
        if (
          !totalColumn &&
          /^(retail|total(?: retail)? price|retail price|total cost)(?:\s*\(.*\))?$/i.test(
            typeof cell.value === "string" ? cell.value.trim() : "",
          )
        )
          totalColumn = column;
      });
      if (
        totalColumn &&
        (row.values as ExcelJS.CellValue[]).some(
          (value) => value === "New Zealand",
        )
      ) {
        const cell = row.getCell(totalColumn);
        const value = cellNumber(cell);
        if (Number.isFinite(value) && value > 10 && value < 100)
          price = value / 100;
      }
    });
    if (price !== null)
      return {
        value: price,
        date,
        source: sourceUrls.electricity,
        status: "live",
      };
  }
  throw new Error(
    "MBIE national nominal electricity total not found; workbook layout may have changed",
  );
};
const regoHeading = (
  text: string,
  now: Date,
  category: "car" | "motorcycle",
) => {
  const prefix =
    category === "motorcycle"
      ? /^Motorcycles\b/i
      : /^(Cars|Common vehicle types and use)\b/i;
  if (!prefix.test(text.trim())) return null;
  const date = text.match(/\b(AFTER|BEFORE)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (!date) return null;
  const cutoff = Date.parse(`${date[2]} UTC`);
  if (!Number.isFinite(cutoff)) return null;
  const after = date[1].toUpperCase() === "AFTER";
  if (after !== now.getTime() >= cutoff) return null;
  return { cutoff, after };
};
const regoSection = (
  html: string,
  now: Date,
  category: "car" | "motorcycle",
) => {
  const $ = load(html);
  const candidates = $("h2,h3")
    .toArray()
    .map((element) => ({
      element,
      schedule: regoHeading($(element).text(), now, category),
    }))
    .filter((entry) => entry.schedule !== null)
    .sort(
      (a, b) =>
        Number(b.schedule!.after) - Number(a.schedule!.after) ||
        b.schedule!.cutoff - a.schedule!.cutoff,
    );
  const heading = candidates[0]?.element;
  if (!heading)
    throw new Error(
      `Current ${category} rego schedule not found (the page may be an access check)`,
    );
  let section = "";
  let sibling = $(heading).next();
  while (sibling.length && !sibling.is("h2,h3")) {
    section += ` ${sibling.clone().find("h2,h3,h4,p,li,div,span").append(" ").end().text()}`;
    sibling = sibling.next();
  }
  return section.replace(/\s+/g, " ");
};
export const parseRego = (html: string, now = new Date()) => {
  const section = regoSection(html, now, "car");
  const prices = [
    ...section.matchAll(
      /Private passenger(?: vehicle)?\s*[–—-]\s*(diesel or electric|petrol|diesel|electric)\b(?:(?!Private passenger|Taxi or rental|Light trailer).)*?12 months:\s*\$([\d.]+)/gi,
    ),
  ];
  const values: Partial<MarketData["rego"]> = {};
  for (const match of prices) {
    const fuel = match[1].toLowerCase();
    const value = Number(match[2]);
    if (fuel === "diesel or electric") {
      values.diesel = value;
      values.electric = value;
    } else values[fuel as keyof MarketData["rego"]] = value;
  }
  if (
    ![values.petrol, values.diesel, values.electric].every(
      (value) => typeof value === "number" && value > 50 && value < 600,
    )
  )
    throw new Error("Rego schedule format changed");
  return values as MarketData["rego"];
};
export const parseMotorcycleRego = (
  html: string,
  now = new Date(),
): MarketData["motorcycleRego"] => {
  const section = regoSection(html, now, "motorcycle");
  const matches = [
    ...section.matchAll(
      /Private passenger\s*[–—-]\s*petrol,\s*(0\s*(?:to|[-–])\s*60cc|61\s*(?:to|[-–])\s*250cc|251\s*(?:to|[-–])\s*750cc|751cc\s+and\s+over)(?:(?!Private passenger).)*?12 months:\s*\$([\d.]+)/gi,
    ),
  ];
  const keys: Record<string, keyof MarketData["motorcycleRego"]> = {
    "0": "upTo60",
    "61": "from61To250",
    "251": "from251To750",
    "751": "over750",
  };
  const values: Partial<MarketData["motorcycleRego"]> = {};
  for (const match of matches)
    values[keys[String(parseInt(match[1], 10))]] = Number(match[2]);
  if (
    !Object.values(keys).every(
      (key) =>
        Number.isFinite(values[key]) &&
        values[key]! > 100 &&
        values[key]! < 2000,
    )
  )
    throw new Error("Motorcycle rego schedule format changed");
  return values as MarketData["motorcycleRego"];
};
const currencyNumber = (value: string | undefined) =>
  Number((value ?? "").replace(/[$,\s]/g, ""));

export const parseRuc = (html: string): MarketData["ruc"] => {
  const $ = load(html);
  let light = 0,
    phev = 0,
    online = 0,
    agent = 0;
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, " ").trim());
    if (cells[0] === "1" && /Up to 3[ ,]?500\s*kg/i.test(cells.join(" ")))
      light = currencyNumber(cells.at(-1));
    if (
      cells[0] === "12" &&
      /1[ ,]?001\s*[-–—]\s*3[ ,]?500\s*kg/.test(cells.join(" "))
    )
      phev = currencyNumber(cells.at(-1));
    if (/Online|NZTA app/i.test(cells[0]))
      online = Number(cells[1]?.replace(/[^\d.]/g, ""));
    if (/Counter sales at agents/i.test(cells[0]))
      agent = Number(cells[1]?.replace(/[^\d.]/g, ""));
  });
  if (![light, phev, online, agent].every((v) => v > 0 && v < 300))
    throw new Error("NZTA RUC table format changed");
  return { light, phev, online, agent };
};
