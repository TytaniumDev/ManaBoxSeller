import { mergeRows, toCardKingdomCsv } from './card-kingdom.js';

/**
 * One converted ManaBox export.
 *
 * @typedef {object} Deck
 * @property {string} name  file name without its extension, e.g. "Blame Game"
 * @property {import('./card-kingdom.js').CardKingdomRow[]} rows
 */

/**
 * Strips the extension from a file name to get the deck's name.
 *
 * @param {string} fileName
 */
export function deckName(fileName) {
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * Combines several converted decks into one Card Kingdom sell list,
 * summing quantities of identical cards across decks.
 *
 * @param {Deck[]} decks
 */
export function combineDecks(decks) {
  const rows = mergeRows(decks.flatMap((deck) => deck.rows));
  const fileName =
    decks.length === 1 ? `${decks[0].name} - Card Kingdom.csv` : `Card Kingdom sell list (${decks.length} decks).csv`;
  return { rows, csv: toCardKingdomCsv(rows), fileName };
}
