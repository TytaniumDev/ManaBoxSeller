const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const BATCH_SIZE = 75; // Scryfall's limit per request
const BATCH_DELAY_MS = 100; // Scryfall asks for at most ~10 requests/second

/**
 * What this site keeps from a Scryfall card.
 *
 * @typedef {object} ScryfallPrinting
 * @property {string} id
 * @property {string} set_name
 */

/**
 * Fills in `scryfallId` and `setName` for cards that don't have a
 * Scryfall ID yet (i.e. cards from a .txt export), using the printing's
 * set code and collector number. CSV exports already have IDs, so they
 * make no requests.
 *
 * Answers are stored in `cache`; pass the same cache to later calls to
 * skip printings already looked up.
 *
 * @param {import('./card.js').Card[]} cards
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @param {Pick<Map<string, ScryfallPrinting>, 'has' | 'get' | 'set'>} [cache]
 *   "set|collector number" → printing, e.g. a Map or a StoredCache
 * @returns {Promise<{ cards: import('./card.js').Card[], warnings: string[] }>}
 */
export async function resolveScryfallIds(cards, fetchFn = fetch, cache = new Map()) {
  const identifiers = uniqueBy(
    cards.filter((card) => !card.scryfallId && !cache.has(printingKey(card))),
    printingKey,
  ).map((card) => ({ set: card.setCode.toLowerCase(), collector_number: card.collectorNumber }));

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
      cache.set(printingKey({ setCode: card.set, collectorNumber: card.collector_number }), {
        id: card.id,
        set_name: card.set_name,
      });
    }
  }

  const warnings = [];
  const resolved = cards.map((card) => {
    if (card.scryfallId) return card;
    const match = cache.get(printingKey(card));
    if (!match) {
      warnings.push(`${card.name} (${card.setCode} ${card.collectorNumber}) wasn't found on Scryfall.`);
      return card;
    }
    return { ...card, scryfallId: match.id, setName: match.set_name };
  });
  return { cards: resolved, warnings };
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
