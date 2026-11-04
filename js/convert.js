import { parseManaboxCsv } from './manabox-csv.js';
import { parseManaboxTxt } from './manabox-txt.js';
import { resolveScryfallIds } from './scryfall.js';
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
 */
export async function convert({ fileName, text, fetchFn }) {
  const parsed = parserFor(fileName)(text);
  const resolved = await resolveScryfallIds(parsed.cards, fetchFn);
  const rows = toCardKingdomRows(resolved.cards);
  return {
    rows,
    csv: toCardKingdomCsv(rows),
    warnings: [...parsed.warnings, ...resolved.warnings],
  };
}
