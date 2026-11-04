import { parseManaboxCsv } from './manabox-csv.js';
import { parseManaboxTxt } from './manabox-txt.js';
import { resolveScryfallIds, fetchSetPrintings } from './scryfall.js';
import { findNamesWithSeveralVersions } from './card-kingdom-names.js';
import { toCardKingdomRows, toCardKingdomCsv } from './card-kingdom.js';

/**
 * Picks the ManaBox parser for a file name.
 *
 * @param {string} fileName
 */
export function parserFor(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return parseManaboxCsv;
  if (extension === 'txt') return parseManaboxTxt;
  throw new Error('Please choose a ManaBox .csv or .txt export.');
}

/**
 * Converts a ManaBox export to a Card Kingdom sell-list CSV.
 *
 * @param {object} input
 * @param {string} input.fileName
 * @param {string} input.text
 * @param {typeof fetch} [input.fetchFn]
 * @param {Map<string, import('./scryfall.js').ScryfallPrinting[]>} [input.setCache]
 *   reuse across calls so each set is only downloaded from Scryfall once
 */
export async function convert({ fileName, text, fetchFn, setCache }) {
  const parsed = parserFor(fileName)(text);
  const resolved = await resolveScryfallIds(parsed.cards, fetchFn);
  const sets = await fetchSetPrintings(resolved.cards.map((card) => card.setCode), fetchFn, setCache);
  const severalVersionsBySet = new Map(
    [...sets.printingsBySet].map(([setCode, printings]) => [setCode, findNamesWithSeveralVersions(printings)]),
  );
  const rows = toCardKingdomRows(resolved.cards, severalVersionsBySet);
  return {
    rows,
    csv: toCardKingdomCsv(rows),
    warnings: [...parsed.warnings, ...resolved.warnings, ...sets.warnings],
  };
}
