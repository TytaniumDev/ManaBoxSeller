/**
 * Builds and reads the Scryfall ID → Card Kingdom (name, edition) map.
 *
 * The map is generated from Card Kingdom's public price list
 * (https://api.cardkingdom.com/api/v2/pricelist) by
 * scripts/build-card-kingdom-map.js, and is shaped like:
 *
 *   {
 *     "updatedAt": "2026-11-04T00:00:00.000Z",
 *     "editions": ["Murders at Karlov Manor Commander Decks", ...],
 *     "cards": { "<scryfallId>|<finish>": ["<name>", <editionIndex>], ... }
 *   }
 *
 * Editions are stored once and referenced by index to keep the file small.
 */

/**
 * @typedef {object} CardKingdomMap
 * @property {string} updatedAt
 * @property {string[]} editions
 * @property {Record<string, [string, number]>} cards
 *
 * @typedef {{ name: string, edition: string }} CardKingdomPrinting
 */

/**
 * Converts the raw price list JSON into a CardKingdomMap.
 *
 * @param {{ data: Array<Record<string, unknown>> }} pricelist
 * @param {Date} [now]
 * @returns {CardKingdomMap}
 */
export function buildCardKingdomMap(pricelist, now = new Date()) {
  const editions = [];
  const editionIndex = new Map();
  const cards = {};

  for (const product of pricelist.data) {
    const scryfallId = product.scryfall_id;
    if (typeof scryfallId !== 'string' || scryfallId === '') continue;

    const key = mapKey(scryfallId, productFinish(product));
    if (key in cards) continue;

    const edition = String(product.edition);
    if (!editionIndex.has(edition)) {
      editionIndex.set(edition, editions.length);
      editions.push(edition);
    }
    cards[key] = [productTitle(product), editionIndex.get(edition)];
  }
  return { updatedAt: now.toISOString(), editions, cards };
}

/**
 * Looks up how Card Kingdom names a printing. Etched foils fall back to
 * the plain foil entry when Card Kingdom doesn't list them separately.
 *
 * @param {CardKingdomMap} map
 * @param {string} scryfallId
 * @param {import('./card.js').Finish} finish
 * @returns {CardKingdomPrinting | undefined}
 */
export function findCardKingdomPrinting(map, scryfallId, finish) {
  const entry =
    map.cards[mapKey(scryfallId, finish)] ??
    (finish === 'etched' ? map.cards[mapKey(scryfallId, 'foil')] : undefined);
  if (!entry) return undefined;
  const [name, edition] = entry;
  return { name, edition: map.editions[edition] };
}

function mapKey(scryfallId, finish) {
  return `${scryfallId}|${finish}`;
}

/** Card Kingdom sends is_foil as a boolean or the string "true"/"false". */
function productFinish(product) {
  const isFoil = product.is_foil === true || product.is_foil === 'true';
  if (!isFoil) return 'normal';
  return /etched/i.test(String(product.variation ?? '')) ? 'etched' : 'foil';
}

/**
 * Card Kingdom shows variants as "Name (Variation)", e.g.
 * "Sol Ring (Borderless)". Plain printings have an empty variation.
 */
function productTitle(product) {
  const name = String(product.name);
  const variation = String(product.variation ?? '').trim();
  return variation === '' || name.includes(`(${variation})`) ? name : `${name} (${variation})`;
}
