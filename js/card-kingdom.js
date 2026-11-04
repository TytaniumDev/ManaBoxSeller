import { toCsv } from './csv.js';
import { findCardKingdomPrinting } from './card-kingdom-map.js';

/**
 * @typedef {object} CardKingdomRow
 * @property {string} name
 * @property {string} edition
 * @property {boolean} foil
 * @property {number} quantity
 */

/**
 * Converts cards to Card Kingdom sell-list rows. Cards that end up with the
 * same name, edition and foil are merged and their quantities summed.
 *
 * Cards missing from the Card Kingdom map keep their ManaBox/Scryfall name
 * and set name, and produce a warning so they can be checked by hand.
 *
 * @param {import('./card.js').Card[]} cards
 * @param {import('./card-kingdom-map.js').CardKingdomMap | undefined} map
 * @returns {{ rows: CardKingdomRow[], warnings: string[] }}
 */
export function toCardKingdomRows(cards, map) {
  /** @type {Map<string, CardKingdomRow>} */
  const merged = new Map();
  const warnings = [];

  for (const card of cards) {
    const printing = map && card.scryfallId
      ? findCardKingdomPrinting(map, card.scryfallId, card.finish)
      : undefined;
    if (map && !printing) {
      warnings.push(
        `${card.name} (${card.setCode} ${card.collectorNumber}, ${card.finish}) isn't in Card Kingdom's list; using "${card.setName ?? card.setCode}".`,
      );
    }

    const row = {
      name: printing?.name ?? card.name,
      edition: printing?.edition ?? card.setName ?? card.setCode,
      foil: card.finish !== 'normal',
      quantity: card.quantity,
    };
    const key = `${row.name}|${row.edition}|${row.foil}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += row.quantity;
    else merged.set(key, row);
  }

  const rows = [...merged.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.edition.localeCompare(b.edition),
  );
  return { rows, warnings };
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
