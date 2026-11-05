/**
 * Card Kingdom's public price list: every card they stock, with the cash
 * price they pay and how many copies they're buying right now. It is one
 * large file (~10 MB gzipped), refreshed about once a day, so the site
 * downloads it at most once per visit.
 */

export const BUYLIST_URL = 'https://api.cardkingdom.com/api/v2/pricelist';

/**
 * What Card Kingdom pays for one printing.
 *
 * @typedef {object} BuylistOffer
 * @property {number} priceCents near-mint cash price for one copy
 * @property {number} quantity   how many copies they're buying
 */

/**
 * @typedef {object} Buylist
 * @property {Map<string, BuylistOffer>} offers keyed by {@link offerKey}
 * @property {string} [updatedAt] when Card Kingdom built the list, e.g. "2026-11-05 09:11:52"
 */

/**
 * Downloads Card Kingdom's price list and keeps only the cards they're buying.
 *
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @returns {Promise<Buylist>}
 */
export async function fetchBuylist(fetchFn = fetch) {
  const response = await fetchFn(BUYLIST_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Card Kingdom request failed (${response.status}).`);
  const { meta, data } = await response.json();
  return { offers: indexBuylist(data), updatedAt: meta?.created_at };
}

/**
 * Indexes price-list items by Scryfall ID and foil, skipping anything Card
 * Kingdom isn't buying. If one printing is listed twice, the first wins.
 *
 * @param {Array<{ scryfall_id?: string, is_foil: string, price_buy: string, qty_buying: number }>} items
 * @returns {Map<string, BuylistOffer>}
 */
export function indexBuylist(items) {
  const offers = new Map();
  for (const item of items) {
    if (!item.scryfall_id || !(item.qty_buying > 0)) continue;
    const key = offerKey(item.scryfall_id, item.is_foil === 'true');
    if (offers.has(key)) continue;
    offers.set(key, { priceCents: Math.round(Number(item.price_buy) * 100), quantity: item.qty_buying });
  }
  return offers;
}

/**
 * @param {string} scryfallId
 * @param {boolean} foil
 */
export function offerKey(scryfallId, foil) {
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
 * @param {Map<string, BuylistOffer>} offers from {@link indexBuylist}
 * @returns {{ selling: PricedRow[], leftovers: import('./card-kingdom.js').CardKingdomRow[], totalCents: number }}
 */
export function splitByBuylist(rows, offers) {
  const selling = [];
  const leftovers = [];
  for (const row of rows) {
    const scryfallId = row.printing?.scryfallId;
    const offer = scryfallId ? offers.get(offerKey(scryfallId, row.foil)) : undefined;
    const sold = offer ? Math.min(row.quantity, offer.quantity) : 0;
    if (sold > 0) selling.push({ ...row, quantity: sold, priceCents: offer.priceCents });
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
