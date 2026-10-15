import ExcelJS from "exceljs";

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseElectricity, parseRuc } from "./parsers.ts";
import {
  electricityCandidates,
  fetchElectricity,
  sourceHtml,
  SourceAccessError,
} from "./sources.ts";

import { sourceUrls } from "../shared/market.ts";

const challenge =
  '<html><script src="/_Incapsula_Resource"></script><body></body></html>';
const report = async (date: string, price = 42.1) => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("QSDEP_Summary_Report");
  sheet.addRows([
    [`Nominal indicators on ${date}`],
    ["Location", "Retail"],
    ["New Zealand", price],
  ]);
  return Buffer.from(await book.xlsx.writeBuffer());
};

test("HTTP 200 access checks are identified before parsing government pages", async () => {
  await assert.rejects(
    () => sourceHtml(new Response(challenge)),
    SourceAccessError,
  );
  assert.equal(
    await sourceHtml(new Response("<h1>Licensing fees</h1>")),
    "<h1>Licensing fees</h1>",
  );
});

test("quarterly download candidates exclude future reports and cross year boundaries", () => {
  assert.deepEqual(
    electricityCandidates(new Date("2026-02-14")).map((c) => c.date),
    ["2025-11-15", "2025-08-15", "2025-05-15", "2025-02-15"],
  );
  const current = electricityCandidates(new Date("2026-10-15"));
  assert.equal(current[0].date, "2026-08-15");
  assert.ok(current[0].url.endsWith("qsdep-report-15Aug2026.xlsx"));
});

test("blocked release page still downloads verified official electricity report", async () => {
  const buffer = await report("15 August 2026");
  const requests: string[] = [];
  const result = await fetchElectricity(async (url) => {
    requests.push(url);
    if (url === sourceUrls.electricity) return new Response(challenge);
    if (url.endsWith("15Aug2026.xlsx"))
      return new Response(new Uint8Array(buffer));
    return new Response("Missing", { status: 404 });
  }, new Date("2026-10-15"));
  assert.equal(result.observation.date, "2026-08-15");
  assert.ok(Math.abs(result.observation.value - 0.421) < 1e-9);
  assert.equal(result.observation.status, "live");
  assert.match(result.notice!, /blocked automated access/);
  assert.match(result.notice!, /latest release could not be confirmed/);
  assert.equal(requests.length, 5);
});

test("accessible release index takes priority over filename candidates", async () => {
  const buffer = await report("15 August 2026");
  const requests: string[] = [];
  const result = await fetchElectricity(async (url) => {
    requests.push(url);
    return url === sourceUrls.electricity
      ? new Response(
          '<a href="/assets/current.xlsx">Quarterly Survey of Domestic Electricity Prices to 15 August 2026 [XLSX]</a>',
        )
      : new Response(new Uint8Array(buffer));
  });
  assert.equal(requests.length, 2);
  assert.equal(result.notice, undefined);
});

test("older direct reports retain their true date and wrong-date workbooks are rejected", async () => {
  const buffer = await report("15 May 2026", 40);
  await assert.rejects(
    () => parseElectricity(buffer, "2026-08-15"),
    /publication date/,
  );
  const result = await fetchElectricity(
    async (url) =>
      url.endsWith("15May2026.xlsx")
        ? new Response(new Uint8Array(buffer))
        : new Response(challenge),
    new Date("2026-10-15"),
  );
  assert.equal(result.observation.date, "2026-05-15");
  assert.match(result.notice!, /2026-05-15/);
});

test("no HTML access check is treated as a workbook", async () => {
  await assert.rejects(
    () =>
      fetchElectricity(
        async () => new Response(challenge),
        new Date("2026-10-15"),
      ),
    /quarterly downloads unavailable/,
  );
});

test("RUC table accepts currency symbols, spaced weights and en dashes", () => {
  assert.deepEqual(
    parseRuc(
      "<table><tr><td>Online NZTA app</td><td>$12.44</td></tr><tr><td>Counter sales at agents</td><td>$13.71</td></tr><tr><td>1</td><td>Powered vehicles with 2 axles</td><td>Up to 3,500 kg</td><td>$76.00</td></tr><tr><td>12</td><td>Plug-in petrol hybrid</td><td>1,001 – 3,500 kg</td><td>$38.00</td></tr></table>",
    ),
    { light: 76, phev: 38, online: 12.44, agent: 13.71 },
  );
});
