import { toCsv } from './csv.js';
import { cardKingdomEdition, cardKingdomTitle } from './card-kingdom-names.js';

/**
 * @typedef {object} CardKingdomRow
 * @property {string} name
 * @property {string} edition
 * @property {boolean} foil
 * @property {number} quantity
 * @property {Omit<import('./card.js').Card, 'quantity'>} [printing]
 *   the ManaBox card this row came from, used to look it up on Card Kingdom's
 *   buylist and to write leftovers back out in ManaBox's format
 */

/**
 * Converts cards to Card Kingdom sell-list rows, translating names to
 * Card Kingdom's conventions. Cards with the same name, set and foil are
 * merged and their quantities summed.
 *
 * @param {import('./card.js').Card[]} cards
 * @param {Map<string, Set<string>>} [severalVersionsBySet] set code → names
 *   with several versions in that set, from findNamesWithSeveralVersions
 * @returns {CardKingdomRow[]}
 */
export function toCardKingdomRows(cards, severalVersionsBySet = new Map()) {
  return mergeRows(
    cards.map(({ quantity, ...printing }) => ({
      name: cardKingdomTitle(
        printing.name,
        printing.collectorNumber,
        severalVersionsBySet.get(printing.setCode)?.has(printing.name),
      ),
      edition: printing.setName ? cardKingdomEdition(printing.setName) : printing.setCode,
      foil: printing.finish !== 'normal',
      quantity,
      printing,
    })),
  );
}

/**
 * Merges rows with the same name, edition and foil by summing their
 * quantities, and sorts the result by name then edition. Used both within
 * one deck and to combine several decks into one sell list.
 *
 * @param {CardKingdomRow[]} rows
 * @returns {CardKingdomRow[]}
 */
export function mergeRows(rows) {
  /** @type {Map<string, CardKingdomRow>} */
  const merged = new Map();

  for (const row of rows) {
    const key = `${row.name}|${row.edition}|${row.foil}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += row.quantity;
    else merged.set(key, { ...row });
  }

  return [...merged.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.edition.localeCompare(b.edition),
  );
}

/**
 * Formats rows as a Card Kingdom sell-list CSV: no header,
 * columns name, edition, foil (TRUE/FALSE), quantity.
 *
 * @param {CardKingdomRow[]} rows
 * @returns {string}
 */
export function toCardKingdomCsv(rows) {
  return toCsv(rows.map((row) => [row.name, row.edition, row.foil ? 'TRUE' : 'FALSE', row.quantity]));
}
