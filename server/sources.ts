import { discoverWorkbook, parseElectricity } from "./parsers.ts";

import type { Observation } from "../shared/market.ts";
import { sourceUrls } from "../shared/market.ts";

export class SourceAccessError extends Error {
  constructor() {
    super("Source returned an automated access check instead of data");
    this.name = "SourceAccessError";
  }
}
export const assertSourceContent = (text: string) => {
  if (
    /_Incapsula_Resource|incapsula incident|verify you are human|just a moment|cf-chl-|captcha/i.test(
      text,
    ) &&
    !/<(?:main|table|article)\b/i.test(text)
  )
    throw new SourceAccessError();
};
export const sourceHtml = async (response: Response) => {
  const html = await response.text();
  assertSourceContent(html);
  return html;
};

// MBIE's public quarterly assets can remain accessible when its HTML index is blocked.
// A candidate is accepted only when the workbook's nominal report declares that date.
export const electricityCandidates = (now = new Date()) => {
  const dates: Date[] = [];
  for (let year = now.getUTCFullYear(); dates.length < 4; year--)
    for (const month of [10, 7, 4, 1]) {
      const date = new Date(Date.UTC(year, month, 15));
      if (date <= now && dates.length < 4) dates.push(date);
    }
  return dates.map((date) => ({
    date: date.toISOString().slice(0, 10),
    url: `https://www.mbie.govt.nz/assets/Data-Files/Energy/nz-energy-quarterly-and-energy-in-nz/qsdep-report-15${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]}${date.getUTCFullYear()}.xlsx`,
  }));
};
export const fetchElectricity = async (
  fetchSource: (url: string) => Promise<Response>,
  now = new Date(),
): Promise<{ observation: Observation; notice?: string }> => {
  const download = async (candidate: { url: string; date: string }) => {
    const buffer = Buffer.from(
      await (await fetchSource(candidate.url)).arrayBuffer(),
    );
    if (buffer.subarray(0, 2).toString() !== "PK") {
      assertSourceContent(buffer.toString("utf8"));
      throw new Error("MBIE download was not an XLSX workbook");
    }
    return parseElectricity(buffer, candidate.date);
  };
  let indexFailure: unknown;
  try {
    const candidate = discoverWorkbook(
      await sourceHtml(await fetchSource(sourceUrls.electricity)),
    );
    return { observation: await download(candidate) };
  } catch (error) {
    indexFailure = error;
  }
  const attempts = await Promise.allSettled(
    electricityCandidates(now).map(download),
  );
  // Candidates are newest first. Never call an older file the latest release.
  const available = attempts.find((result) => result.status === "fulfilled");
  if (available?.status === "fulfilled")
    return {
      observation: available.value,
      notice: `Electricity release page ${indexFailure instanceof SourceAccessError ? "blocked automated access" : "could not be read"}. Using the official workbook dated ${available.value.date}; the latest release could not be confirmed.`,
    };
  throw new Error(
    `Electricity release page and quarterly downloads unavailable: ${String(indexFailure)}`,
  );
};
