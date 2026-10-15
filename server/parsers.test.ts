import ExcelJS from "exceljs";

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  discoverWorkbook,
  isoDate,
  parseElectricity,
  parseGaspy,
  parseMotorcycleRego,
  parseRego,
  parseRuc,
} from "./parsers.ts";

test("source blocks and invalid publication dates fail closed", () => {
  assert.throws(() => parseRego("<html>Challenge</html>"));
  assert.throws(() => parseRuc("<html>Challenge</html>"));
  assert.throws(() => discoverWorkbook("<html>Challenge</html>"));
  assert.throws(() => isoDate("invalid"));
});
test("electricity finds newest dated QSDEP workbook, not first archive link", () => {
  const link = discoverWorkbook(
    `<a href="/assets/old.xlsx">Quarterly Survey of Domestic Electricity Prices to 15 May 2026 [XLSX]</a><a href="/assets/new.xlsx">Quarterly Survey of Domestic Electricity Prices to 15 August 2026 [XLSX]</a>`,
  );
  assert.equal(link.date, "2026-08-15");
  assert.equal(link.url, "https://www.mbie.govt.nz/assets/new.xlsx");
});
test("electricity uses labelled national nominal total, never a city or real-price sheet", async () => {
  const book = new ExcelJS.Workbook();
  const real = book.addWorksheet("Real prices");
  real.addRows([
    ["Location", "Total price"],
    ["New Zealand", 20],
  ]);
  const sheet = book.addWorksheet("Nominal summary");
  sheet.addRows([
    ["Nominal indicators on 15 August 2026"],
    ["Location", "Lines", "Total price"],
    ["Auckland", 10, 30],
    ["New Zealand", 12, 42.1],
  ]);
  const observation = await parseElectricity(
    Buffer.from(await book.xlsx.writeBuffer()),
    "2026-08-15",
  );
  assert.ok(Math.abs(observation.value - 0.421) < 1e-9);
  assert.equal(observation.date, "2026-08-15");
});
test("NZTA fees choose current passenger cars, not motorcycles or earlier schedule", () => {
  const rego = parseRego(
    `<h2>Cars (if your licence starts AFTER 1 July 2026):</h2><div>Private passenger – petrol <ul><li>12 months: $181.45</li></ul>Private passenger – diesel <ul><li>12 months: $248.83</li></ul>Private passenger – electric <ul><li>12 months: $248.83</li></ul></div><h2>Motorcycles</h2><div>Private passenger – petrol 12 months: $500</div>`,
  );
  assert.deepEqual(rego, { petrol: 181.45, diesel: 248.83, electric: 248.83 });
  const ruc = parseRuc(
    `<table><tr><td>Online NZTA app</td><td>$12.44</td></tr><tr><td>Counter sales at agents</td><td>$13.71</td></tr></table><table><tr><td>1</td><td>Powered vehicles with 2 axles</td><td>Up to 3500kg</td><td>76</td></tr><tr><td>12</td><td>Plug-in petrol hybrid</td><td>1001 - 3500kg</td><td>38</td></tr></table>`,
  );
  assert.deepEqual(ruc, { light: 76, phev: 38, online: 12.44, agent: 13.71 });
});

test("Gaspy converts cents to dollars and uses the database publication date", () => {
  const result = parseGaspy({
    Updated: "15 Oct 2026 @ 12:47PM",
    Averages: {
      "91": { Average: 357.65 },
      "95": { Average: 376.42 },
      Diesel: { Average: 320.17 },
    },
  });
  assert.ok(Math.abs(result.petrol91!.value - 3.5765) < 1e-9);
  assert.ok(Math.abs(result.petrol95!.value - 3.7642) < 1e-9);
  assert.ok(Math.abs(result.diesel!.value - 3.2017) < 1e-9);
  assert.equal(result.petrol91!.date, "2026-10-15");
  assert.equal(result.petrol91!.source, "https://www.gaspy.nz/stats.html");
});
test("Gaspy rejects missing grades, invalid prices and missing timestamps", () => {
  assert.throws(() => parseGaspy(null));
  assert.throws(() => parseGaspy({ Averages: {} }));
  assert.throws(() => parseGaspy({ Updated: "unknown", Averages: {} }));
  assert.throws(() =>
    parseGaspy({
      Updated: "15 Oct 2026 @ 12:47PM",
      Averages: {
        "91": { Average: "357.65" },
        "95": { Average: 376.42 },
        Diesel: { Average: 320.17 },
      },
    }),
  );
  assert.throws(() =>
    parseGaspy({
      Updated: "15 Oct 2026 @ 12:47PM",
      Averages: {
        "91": { Average: 0 },
        "95": { Average: 376.42 },
        Diesel: { Average: 320.17 },
      },
    }),
  );
  assert.throws(() =>
    parseGaspy({
      Updated: "15 Oct 2026 @ 12:47PM",
      Averages: { "91": { Average: 357.65 }, "95": { Average: 376.42 } },
    }),
  );
});

test("electricity handles MBIE summary offsets, repeated Retail columns and blank formulas", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("QSDEP_Summary_Report");
  sheet.getCell("B5").value = "Nominal indicators on 15 August 2026";
  sheet.getCell("B12").value = "Location";
  sheet.getCell("F12").value = "Retail";
  sheet.getCell("J12").value = "Retail";
  sheet.getCell("N12").value = "Retail";
  sheet.getCell("F13").value = "c/kWh";
  sheet.getCell("J13").value = "%";
  sheet.getCell("N13").value = "c/kWh";
  sheet.getCell("B14").value = "New Zealand";
  sheet.getCell("F14").value = 42.1476585176786;
  sheet.getCell("J14").value = 0.002524;
  sheet.getCell("N14").value = 0.106116;
  sheet.getCell("A9").value = { formula: "IFERROR(A1,0)", result: undefined };
  const result = await parseElectricity(
    Buffer.from(await book.xlsx.writeBuffer()),
    "2026-08-15",
  );
  assert.ok(Math.abs(result.value - 0.421476585176786) < 1e-9);
});

test("NZTA current common vehicle schedule maps combined diesel/electric fees", () => {
  const html = `<h2>Common vehicle types and use (if your licence starts BEFORE 1 July 2026):</h2><div>Private passenger vehicle – petrol 12 months: $172.97 Private passenger vehicle – diesel or electric 12 months: $241.59</div><h2>Common vehicle types and use (if your licence starts AFTER 1 July 2026):</h2><div class="accordion"><h3>Private passenger vehicle – petrol</h3><p>3 months: $51.85</p><p>6 months: $95.06</p><p>12 months: $181.45</p><h3>Private passenger vehicle – diesel or electric</h3><p>12 months: $248.83</p><h3>Taxi or rental vehicle – petrol</h3><p>12 months: $280.31</p></div><h2>Motorcycles</h2><div>Private passenger – petrol 12 months: $500</div>`;
  assert.deepEqual(parseRego(html, new Date("2026-10-15")), {
    petrol: 181.45,
    diesel: 248.83,
    electric: 248.83,
  });
  assert.deepEqual(parseRego(html, new Date("2026-06-30")), {
    petrol: 172.97,
    diesel: 241.59,
    electric: 241.59,
  });
  assert.deepEqual(parseRego(html, new Date("2026-07-01")), {
    petrol: 181.45,
    diesel: 248.83,
    electric: 248.83,
  });
});
test("rego parser selects the active dated schedule and rejects incomplete passenger data", () => {
  const schedule = (date: string, petrol: number, other: number) =>
    `<h2>Common vehicle types and use (if your licence starts AFTER ${date}):</h2><div>Private passenger vehicle – petrol 12 months: $${petrol} Private passenger vehicle – diesel or electric 12 months: $${other}</div>`;
  const html =
    schedule("1 July 2026", 181.45, 248.83) + schedule("1 July 2027", 190, 260);
  assert.equal(parseRego(html, new Date("2026-10-15")).petrol, 181.45);
  assert.equal(parseRego(html, new Date("2027-07-01")).petrol, 190);
  assert.throws(() =>
    parseRego(
      `<h2>Common vehicle types and use (if your licence starts AFTER 1 July 2026):</h2><div>Private passenger vehicle – petrol 3 months: $51.85 Taxi or rental vehicle – petrol 12 months: $280.31 Private passenger vehicle – diesel or electric 12 months: $248.83</div>`,
      new Date("2026-10-15"),
    ),
  );
});

test("motorcycle rego uses active engine bands, separate from mopeds and passenger cars", () => {
  const html = `<h2>Motorcycles (if your licence starts BEFORE 1 July 2026):</h2><div>Private passenger – petrol, 0 to 60cc 12 months: $442.41</div><h2>Motorcycles (if your licence starts AFTER 1 July 2026):</h2><div><h3>Private passenger – petrol, 0 to 60cc</h3><p>12 months: $431.52</p><h3>Private passenger – petrol, 61–250cc</h3><p>12 months: $456.24</p><h3>Private passenger – petrol, 251 to 750cc</h3><p>12 months: $606.29</p><h3>Private passenger – petrol, 751cc and over</h3><p>12 months: $816.45</p><h3>Private passenger – electric</h3><p>12 months: $446.96</p></div><h2>Mopeds (if your licence starts AFTER 1 July 2026):</h2><div>Private passenger – petrol 12 months: $173.03</div>`;
  assert.deepEqual(parseMotorcycleRego(html, new Date("2026-10-15")), {
    upTo60: 431.52,
    from61To250: 456.24,
    from251To750: 606.29,
    over750: 816.45,
  });
  assert.throws(() => parseMotorcycleRego("<html>Access check</html>"));
});
