/**
 * Card Kingdom names some sets and cards differently from ManaBox/Scryfall.
 * Each rule here was checked against cardkingdom.com.
 */

const BASIC_LANDS = new Set([
  'Plains',
  'Island',
  'Swamp',
  'Mountain',
  'Forest',
  'Wastes',
  'Snow-Covered Plains',
  'Snow-Covered Island',
  'Snow-Covered Swamp',
  'Snow-Covered Mountain',
  'Snow-Covered Forest',
  'Snow-Covered Wastes',
]);

/**
 * Converts a ManaBox/Scryfall set name to Card Kingdom's edition name.
 *
 * Precon Commander sets are "<Set> Commander" on Scryfall but
 * "<Set> Commander Decks" on Card Kingdom, e.g.
 * "Murders at Karlov Manor Commander" → "Murders at Karlov Manor Commander Decks".
 *
 * @param {string} setName
 * @returns {string}
 */
export function cardKingdomEdition(setName) {
  return /\S Commander$/.test(setName) ? `${setName} Decks` : setName;
}

/**
 * Converts a card name to Card Kingdom's title.
 *
 * Card Kingdom tells basic land printings apart by a 4-digit collector
 * number, e.g. Mountain #283 → "Mountain (0283)".
 *
 * @param {string} name
 * @param {string} collectorNumber
 * @returns {string}
 */
export function cardKingdomTitle(name, collectorNumber) {
  return BASIC_LANDS.has(name) ? `${name} (${collectorNumber.padStart(4, '0')})` : name;
}
