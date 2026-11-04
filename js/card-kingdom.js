import { toCsv } from './csv.js';

/**
 * @typedef {object} CardKingdomRow
 * @property {string} name
 * @property {string} edition
 * @property {boolean} foil
 * @property {number} quantity
 */

/**
 * Converts cards to Card Kingdom sell-list rows, using the ManaBox/Scryfall
 * set name. Cards with the same name, set and foil are merged and their
 * quantities summed.
 *
 * @param {import('./card.js').Card[]} cards
 * @returns {CardKingdomRow[]}
 */
export function toCardKingdomRows(cards) {
  /** @type {Map<string, CardKingdomRow>} */
  const merged = new Map();

  for (const card of cards) {
    const row = {
      name: card.name,
      edition: card.setName ?? card.setCode,
      foil: card.finish !== 'normal',
      quantity: card.quantity,
    };
    const key = `${row.name}|${row.edition}|${row.foil}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += row.quantity;
    else merged.set(key, row);
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
