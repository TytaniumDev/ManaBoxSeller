import { parseManaboxCsv } from './manabox-csv.js';
import { parseManaboxTxt } from './manabox-txt.js';
import { resolveScryfallIds, fetchPrintingsByName, fillFromPrintings } from './scryfall.js';
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
 * Converts several ManaBox exports to Card Kingdom sell-list rows at once.
 * Every file's cards share the same Scryfall lookups, so dropping several
 * decks together costs about as many requests as one.
 *
 * A file that can't be read gets an `error` instead of rows; the others
 * still convert.
 *
 * @param {Array<{ fileName: string, text: string }>} files
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn]
 * @param {Pick<Map<string, import('./scryfall.js').ScryfallPrinting[]>, 'has' | 'get' | 'set'>} [options.printingsCache]
 *   reuse across calls so each card name is only looked up on Scryfall once
 */
export async function convertAll(files, { fetchFn, printingsCache } = {}) {
  const parsed = files.map(({ fileName, text }) => {
    try {
      return { fileName, ...parserFor(fileName)(text) };
    } catch (error) {
      return { fileName, error, cards: [], warnings: [] };
    }
  });
  const allCards = parsed.flatMap((file) => file.cards);

  const sets = await fetchPrintingsByName(allCards, fetchFn, printingsCache);
  // The name search usually covers .txt cards' set names too; the
  // collection lookup only runs for any it missed.
  const resolved = await resolveScryfallIds(fillFromPrintings(allCards, sets.printingsBySet), fetchFn);
  const severalVersionsBySet = new Map(
    [...sets.printingsBySet].map(([setCode, printings]) => [setCode, findNamesWithSeveralVersions(printings)]),
  );

  let offset = 0;
  const decks = parsed.map(({ fileName, error, cards, warnings }) => {
    const deckCards = resolved.cards.slice(offset, (offset += cards.length));
    if (error) return { fileName, error };
    return { fileName, rows: toCardKingdomRows(deckCards, severalVersionsBySet), warnings };
  });
  return { decks, warnings: [...sets.warnings, ...resolved.warnings] };
}

/**
 * Converts one ManaBox export to a Card Kingdom sell-list CSV.
 *
 * @param {object} input
 * @param {string} input.fileName
 * @param {string} input.text
 * @param {typeof fetch} [input.fetchFn]
 */
export async function convert({ fileName, text, fetchFn }) {
  const { decks, warnings } = await convertAll([{ fileName, text }], { fetchFn });
  const [deck] = decks;
  if (deck.error) throw deck.error;
  return { rows: deck.rows, csv: toCardKingdomCsv(deck.rows), warnings: [...deck.warnings, ...warnings] };
}
