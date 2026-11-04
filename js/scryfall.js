const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const SEARCH_URL = 'https://api.scryfall.com/cards/search';
const BATCH_SIZE = 75; // Scryfall's limit per request
const BATCH_DELAY_MS = 100; // Scryfall asks for at most ~10 requests/second

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
 * Fetches every printing in each of the given sets. Sets already in `cache`
 * are not fetched again, and newly loaded sets are added to it, so passing
 * the same cache to later calls skips repeat downloads.
 *
 * @param {string[]} setCodes
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @param {Map<string, ScryfallPrinting[]>} [cache] set code → printings
 * @returns {Promise<{ printingsBySet: Map<string, ScryfallPrinting[]>, warnings: string[] }>}
 */
export async function fetchSetPrintings(setCodes, fetchFn = fetch, cache = new Map()) {
  const printingsBySet = new Map();
  const warnings = [];
  let fetched = 0;
  for (const setCode of new Set(setCodes)) {
    if (cache.has(setCode)) {
      printingsBySet.set(setCode, cache.get(setCode));
      continue;
    }
    if (fetched++ > 0) await delay(BATCH_DELAY_MS);
    try {
      const printings = await fetchAllPages(searchUrl(setCode), fetchFn);
      cache.set(setCode, printings);
      printingsBySet.set(setCode, printings);
    } catch (error) {
      warnings.push(`Couldn't load set ${setCode} from Scryfall (${error.message}); its card names may not match Card Kingdom.`);
    }
  }
  return { printingsBySet, warnings };
}

function searchUrl(setCode) {
  const params = new URLSearchParams({ q: `e:${setCode.toLowerCase()}`, unique: 'prints' });
  return `${SEARCH_URL}?${params}`;
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
