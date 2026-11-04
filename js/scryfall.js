const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const SEARCH_URL = 'https://api.scryfall.com/cards/search';
const BATCH_SIZE = 75; // Scryfall's limit per request
const BATCH_DELAY_MS = 100; // Scryfall asks for at most ~10 requests/second
const MAX_QUERY_LENGTH = 900; // keeps search URLs well within Scryfall's limits

/**
 * Fills in `scryfallId` and `setName` for cards that don't have a
 * Scryfall ID yet (i.e. cards from a .txt export), using the printing's
 * set code and collector number.
 *
 * @param {import('./card.js').Card[]} cards
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @returns {Promise<{ cards: import('./card.js').Card[], warnings: string[] }>}
 */
export async function resolveScryfallIds(cards, fetchFn = fetch) {
  const pending = cards.filter((card) => !card.scryfallId);
  const identifiers = uniqueBy(pending, printingKey).map((card) => ({
    set: card.setCode.toLowerCase(),
    collector_number: card.collectorNumber,
  }));

  /** @type {Map<string, { id: string, set_name: string }>} */
  const found = new Map();
  for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
    if (i > 0) await delay(BATCH_DELAY_MS);
    const response = await fetchFn(COLLECTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: identifiers.slice(i, i + BATCH_SIZE) }),
    });
    if (!response.ok) throw new Error(`Scryfall request failed (${response.status}).`);
    const { data } = await response.json();
    for (const card of data) {
      found.set(printingKey({ setCode: card.set, collectorNumber: card.collector_number }), card);
    }
  }

  const warnings = [];
  const resolved = cards.map((card) => {
    if (card.scryfallId) return card;
    const match = found.get(printingKey(card));
    if (!match) {
      warnings.push(`${card.name} (${card.setCode} ${card.collectorNumber}) wasn't found on Scryfall.`);
      return card;
    }
    return { ...card, scryfallId: match.id, setName: match.set_name };
  });
  return { cards: resolved, warnings };
}

/**
 * @typedef {object} ScryfallPrinting
 * @property {string} name
 * @property {string} collector_number
 * @property {string} [border_color]
 * @property {string[]} [frame_effects]
 * @property {boolean} [promo]
 */

/**
 * Fetches every printing of the given cards' names within their sets, e.g.
 * all four Ransom Notes in MKC, so callers can tell which names have several
 * versions in a set. Only the deck's own names are requested, packed into as
 * few searches as fit Scryfall's query length.
 *
 * Results are stored in `cache` per set and name; pass the same cache to
 * later calls to skip names that were already looked up.
 *
 * @param {Array<{ setCode: string, name: string }>} cards
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @param {Map<string, ScryfallPrinting[]>} [cache] "SET|name" → printings
 * @returns {Promise<{ printingsBySet: Map<string, ScryfallPrinting[]>, warnings: string[] }>}
 */
export async function fetchPrintingsByName(cards, fetchFn = fetch, cache = new Map()) {
  const wanted = uniqueBy(cards, nameKey).map(({ setCode, name }) => ({ setCode, name }));
  const missing = wanted.filter((card) => !cache.has(nameKey(card)));
  const warnings = [];

  for (const [i, query] of buildNameQueries(missing).entries()) {
    if (i > 0) await delay(BATCH_DELAY_MS);
    try {
      const params = new URLSearchParams({ q: query.text, unique: 'prints' });
      const printings = await fetchAllPages(`${SEARCH_URL}?${params}`, fetchFn);
      for (const card of query.cards) cache.set(nameKey(card), []);
      for (const printing of printings) {
        cache.get(nameKey({ setCode: printing.set, name: printing.name }))?.push(printing);
      }
    } catch (error) {
      warnings.push(`Couldn't load card versions from Scryfall (${error.message}); some names may not match Card Kingdom.`);
    }
  }

  const printingsBySet = new Map();
  for (const card of wanted) {
    const printings = cache.get(nameKey(card));
    if (!printings) continue;
    if (!printingsBySet.has(card.setCode)) printingsBySet.set(card.setCode, []);
    printingsBySet.get(card.setCode).push(...printings);
  }
  return { printingsBySet, warnings };
}

/**
 * Packs set/name pairs into Scryfall search queries of at most `maxLength`
 * characters, e.g. `(e:mkc (!"Ransom Note" or !"Plains")) or (e:mkm !"Shock")`.
 *
 * @param {Array<{ setCode: string, name: string }>} cards
 * @param {number} [maxLength]
 * @returns {Array<{ text: string, cards: Array<{ setCode: string, name: string }> }>}
 */
export function buildNameQueries(cards, maxLength = MAX_QUERY_LENGTH) {
  const queries = [];
  let batch = [];
  for (const card of cards) {
    if (batch.length > 0 && queryText([...batch, card]).length > maxLength) {
      queries.push({ text: queryText(batch), cards: batch });
      batch = [];
    }
    batch.push(card);
  }
  if (batch.length > 0) queries.push({ text: queryText(batch), cards: batch });
  return queries;
}

function queryText(cards) {
  const namesBySet = Map.groupBy(cards, (card) => card.setCode.toLowerCase());
  return [...namesBySet]
    .map(([set, group]) => {
      const names = group.map((card) => `!"${card.name.replaceAll('"', '\\"')}"`);
      return `(e:${set} ${names.length > 1 ? `(${names.join(' or ')})` : names[0]})`;
    })
    .join(' or ');
}

function nameKey({ setCode, name }) {
  return `${setCode.toUpperCase()}|${name}`;
}

/** Follows Scryfall's `next_page` links and returns every card. */
async function fetchAllPages(url, fetchFn) {
  const cards = [];
  for (let next = url; next; ) {
    if (cards.length > 0) await delay(BATCH_DELAY_MS);
    const response = await fetchFn(next, { headers: { Accept: 'application/json' } });
    if (response.status === 404) break; // Scryfall's "no cards found"
    if (!response.ok) throw new Error(`status ${response.status}`);
    const page = await response.json();
    cards.push(...page.data);
    next = page.has_more ? page.next_page : undefined;
  }
  return cards;
}

function printingKey({ setCode, collectorNumber }) {
  return `${setCode.toLowerCase()}|${collectorNumber}`;
}

function uniqueBy(items, keyFn) {
  return [...new Map(items.map((item) => [keyFn(item), item])).values()];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
