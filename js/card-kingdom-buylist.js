/**
 * Card Kingdom's public price list: every card they stock, with their exact
 * name and edition, the cash price they pay, and how many copies they're
 * buying right now. It is one large file (~10 MB gzipped), refreshed about
 * once a day, so the site downloads it at most once per visit.
 */

export const BUYLIST_URL = 'https://api.cardkingdom.com/api/v2/pricelist';

/**
 * One printing as Card Kingdom lists it.
 *
 * @typedef {object} CardKingdomProduct
 * @property {string} title       e.g. "Ransom Note (0045)"
 * @property {string} edition     e.g. "Murders at Karlov Manor Commander Decks"
 * @property {number} priceCents  near-mint cash price for one copy
 * @property {number} buyQuantity how many copies they're buying; 0 if none
 */

/**
 * @typedef {object} Buylist
 * @property {Map<string, CardKingdomProduct>} products keyed by {@link productKey}
 * @property {string} [updatedAt] when Card Kingdom built the list, e.g. "2026-11-05 09:11:52"
 */

/**
 * Downloads Card Kingdom's price list.
 *
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @returns {Promise<Buylist>}
 */
export async function fetchBuylist(fetchFn = fetch) {
  const response = await fetchFn(BUYLIST_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Card Kingdom request failed (${response.status}).`);
  const { meta, data } = await response.json();
  return { products: indexBuylist(data), updatedAt: meta?.created_at };
}

/**
 * @typedef {object} PriceListItem one entry of Card Kingdom's price list
 * @property {string} [scryfall_id]
 * @property {string} name
 * @property {string} variation e.g. "0045" or "" for none
 * @property {string} edition
 * @property {string} is_foil   "true" or "false"
 * @property {string} price_buy e.g. "0.25"
 * @property {number} qty_buying
 */

/**
 * Indexes price-list items by Scryfall ID and foil. Items without a
 * Scryfall ID are skipped; if one printing is listed twice, the first wins.
 *
 * @param {PriceListItem[]} items
 * @returns {Map<string, CardKingdomProduct>}
 */
export function indexBuylist(items) {
  const products = new Map();
  for (const item of items) {
    if (!item.scryfall_id) continue;
    const key = productKey(item.scryfall_id, item.is_foil === 'true');
    if (products.has(key)) continue;
    products.set(key, {
      title: item.variation ? `${item.name} (${item.variation})` : item.name,
      edition: item.edition,
      priceCents: Math.round(Number(item.price_buy) * 100),
      buyQuantity: item.qty_buying > 0 ? item.qty_buying : 0,
    });
  }
  return products;
}

/**
 * @param {string} scryfallId
 * @param {boolean} foil
 */
export function productKey(scryfallId, foil) {
  return `${scryfallId}|${foil ? 'foil' : 'normal'}`;
}

/**
 * A sell-list row Card Kingdom will buy, with its price for one copy.
 *
 * @typedef {import('./card-kingdom.js').CardKingdomRow & { priceCents: number }} PricedRow
 */

/**
 * Splits sell-list rows into what Card Kingdom is buying and what's left
 * over. Card Kingdom only buys up to the quantity it lists, so any extra
 * copies of a card go to the leftovers.
 *
 * @param {import('./card-kingdom.js').CardKingdomRow[]} rows
 * @returns {{ selling: PricedRow[], leftovers: import('./card-kingdom.js').CardKingdomRow[], totalCents: number }}
 */
export function splitByBuylist(rows) {
  const selling = [];
  const leftovers = [];
  for (const row of rows) {
    const sold = row.product ? Math.min(row.quantity, row.product.buyQuantity) : 0;
    if (sold > 0) selling.push({ ...row, quantity: sold, priceCents: row.product.priceCents });
    if (row.quantity > sold) leftovers.push({ ...row, quantity: row.quantity - sold });
  }
  const totalCents = selling.reduce((sum, row) => sum + row.priceCents * row.quantity, 0);
  return { selling, leftovers, totalCents };
}

/**
 * @param {number} cents
 * @returns {string} e.g. "$79.00"
 */
export function formatDollars(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
