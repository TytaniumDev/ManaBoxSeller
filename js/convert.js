import { parseManaboxCsv } from './manabox-csv.js';
import { parseManaboxTxt } from './manabox-txt.js';
import { resolveScryfallIds } from './scryfall.js';

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
 * Reads several ManaBox exports into cards, each with a Scryfall ID.
 * .txt exports have no IDs, so their cards are looked up on Scryfall
 * together, in as few requests as possible.
 *
 * A file that can't be read gets an `error` instead of cards; the others
 * are still read.
 *
 * @param {Array<{ fileName: string, text: string }>} files
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchFn]
 * @param {Parameters<typeof resolveScryfallIds>[2]} [options.idCache]
 *   reuse across calls so each printing is only looked up on Scryfall once
 */
export async function readDecks(files, { fetchFn, idCache } = {}) {
  const parsed = files.map(({ fileName, text }) => {
    try {
      return { fileName, ...parserFor(fileName)(text) };
    } catch (error) {
      return { fileName, error, cards: [], warnings: [] };
    }
  });

  const resolved = await resolveScryfallIds(
    parsed.flatMap((file) => file.cards),
    fetchFn,
    idCache,
  );

  let offset = 0;
  const decks = parsed.map(({ fileName, error, cards, warnings }) => {
    const deckCards = resolved.cards.slice(offset, (offset += cards.length));
    return error ? { fileName, error } : { fileName, cards: deckCards, warnings };
  });
  return { decks, warnings: resolved.warnings };
}
