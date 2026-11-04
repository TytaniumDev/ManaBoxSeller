/**
 * Card Kingdom names some sets and cards differently from ManaBox/Scryfall.
 * Each rule here was checked against cardkingdom.com or a real import.
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

/** Frame effects Card Kingdom files under a separate "... Variants" edition. */
const VARIANT_FRAME_EFFECTS = new Set(['extendedart', 'showcase', 'inverted', 'etched']);

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
 * Card Kingdom adds a 4-digit collector number when a set has several
 * versions of the same card, e.g. "Mountain (0283)" or "Ransom Note (0045)".
 * Basic lands are always numbered.
 *
 * @param {string} name
 * @param {string} collectorNumber
 * @param {boolean} [hasSeveralVersions] from {@link findNamesWithSeveralVersions}
 * @returns {string}
 */
export function cardKingdomTitle(name, collectorNumber, hasSeveralVersions = false) {
  return hasSeveralVersions || BASIC_LANDS.has(name)
    ? `${name} (${collectorNumber.padStart(4, '0')})`
    : name;
}

/**
 * Finds card names that appear more than once among a set's main printings.
 * Borderless, extended-art, showcase and promo printings are ignored,
 * because Card Kingdom lists those in a separate "Variants" edition.
 *
 * @param {import('./scryfall.js').ScryfallPrinting[]} printings
 * @returns {Set<string>}
 */
export function findNamesWithSeveralVersions(printings) {
  const counts = new Map();
  for (const printing of printings.filter(isMainPrinting)) {
    counts.set(printing.name, (counts.get(printing.name) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

/** @param {import('./scryfall.js').ScryfallPrinting} printing */
function isMainPrinting(printing) {
  return (
    !printing.promo &&
    printing.border_color !== 'borderless' &&
    !(printing.frame_effects ?? []).some((effect) => VARIANT_FRAME_EFFECTS.has(effect))
  );
}
