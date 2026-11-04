import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScryfallIds, fetchPrintingsByName, buildNameQueries } from '../js/scryfall.js';
import { convert } from '../js/convert.js';

/** Reads the set/name pairs back out of a buildNameQueries query. */
function parseNameQuery(query) {
  const pairs = [];
  for (const [, set, names] of query.matchAll(/e:(\w+) ([^]*?)(?=\) or \(e:|\)$)/g)) {
    for (const [, name] of names.matchAll(/!"((?:[^"\\]|\\.)*)"/g)) pairs.push({ set, name: name.replaceAll('\\"', '"') });
  }
  return pairs;
}

/**
 * A fake fetch that answers Scryfall's /cards/collection and /cards/search
 * (name queries from buildNameQueries) from a fixed list. Collection calls
 * are recorded in `calls`, searches in `searches`.
 */
function fakeScryfall(cards) {
  const calls = [];
  const searches = [];
  const fetchFn = async (url, options) => {
    if (url.includes('/cards/search')) {
      const pairs = parseNameQuery(new URL(url).searchParams.get('q'));
      searches.push(pairs);
      const data = cards.filter((card) => pairs.some((pair) => pair.set === card.set && pair.name === card.name));
      return data.length === 0
        ? { ok: false, status: 404 }
        : { ok: true, status: 200, json: async () => ({ data, has_more: false }) };
    }
    const { identifiers } = JSON.parse(options.body);
    calls.push(identifiers);
    const data = cards.filter((card) =>
      identifiers.some((id) => id.set === card.set && id.collector_number === card.collector_number),
    );
    return { ok: true, json: async () => ({ data }) };
  };
  return { fetchFn, calls, searches };
}

const mkc = { set: 'mkc', set_name: 'Murders at Karlov Manor Commander' };
const scryfallCards = [
  { ...mkc, id: 'nelly-id', name: 'Nelly Borca, Impulsive Accuser', collector_number: '4' },
  { ...mkc, id: 'ransom-45', name: 'Ransom Note', collector_number: '45' },
  { ...mkc, id: 'ransom-46', name: 'Ransom Note', collector_number: '46' },
  { ...mkc, id: 'nelly-ext', name: 'Nelly Borca, Impulsive Accuser', collector_number: '300', frame_effects: ['extendedart'] },
];

test('fills in Scryfall IDs and set names by set code and collector number', async () => {
  const { fetchFn, calls } = fakeScryfall(scryfallCards);
  const card = { name: 'Nelly', setCode: 'MKC', collectorNumber: '4', finish: 'foil', quantity: 1 };
  const { cards, warnings } = await resolveScryfallIds([card, { ...card }, { ...card, collectorNumber: '999' }], fetchFn);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 2, 'duplicate printings are requested once');
  assert.equal(cards[0].scryfallId, 'nelly-id');
  assert.equal(cards[1].setName, 'Murders at Karlov Manor Commander');
  assert.equal(warnings.length, 1);
});

test('skips the network when every card already has a Scryfall ID', async () => {
  const { fetchFn, calls } = fakeScryfall([]);
  await resolveScryfallIds([{ name: 'x', setCode: 'A', collectorNumber: '1', finish: 'normal', quantity: 1, scryfallId: 'id' }], fetchFn);
  assert.equal(calls.length, 0);
});

test('converts a TXT export end to end', async () => {
  const { fetchFn } = fakeScryfall(scryfallCards);
  const text = '// COMMANDER\n1 Nelly Borca, Impulsive Accuser (MKC) 4 *F*\n\n1 Ransom Note (MKC) 45\n';
  const result = await convert({ fileName: 'deck.TXT', text, fetchFn });
  assert.equal(
    result.csv,
    '"Nelly Borca, Impulsive Accuser",Murders at Karlov Manor Commander Decks,TRUE,1\n' +
      'Ransom Note (0045),Murders at Karlov Manor Commander Decks,FALSE,1\n',
  );
  assert.deepEqual(result.warnings, []);
});

test('rejects other file types', async () => {
  await assert.rejects(convert({ fileName: 'deck.json', text: '' }), /\.csv or \.txt/);
});

test('fetches every page of a search', async () => {
  const pages = {
    first: { data: [{ set: 'mkc', name: 'A' }], has_more: true, next_page: 'https://api.scryfall.com/cards/search?page=2' },
    second: { data: [{ set: 'mkc', name: 'A', collector_number: '2' }], has_more: false },
  };
  const fetchFn = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.includes('page=2') ? pages.second : pages.first),
  });
  const { printingsBySet, warnings } = await fetchPrintingsByName([{ setCode: 'MKC', name: 'A' }], fetchFn);
  assert.equal(printingsBySet.get('MKC').length, 2);
  assert.deepEqual(warnings, []);
});

test('looks up only the deck\'s names, once each, and reuses the cache', async () => {
  const { fetchFn, searches } = fakeScryfall(scryfallCards);
  const deck = [
    { setCode: 'MKC', name: 'Ransom Note' },
    { setCode: 'MKC', name: 'Ransom Note' },
    { setCode: 'MKC', name: 'Not On Scryfall' },
  ];
  const cache = new Map();
  const { printingsBySet } = await fetchPrintingsByName(deck, fetchFn, cache);
  assert.deepEqual(searches, [[{ set: 'mkc', name: 'Ransom Note' }, { set: 'mkc', name: 'Not On Scryfall' }]]);
  assert.deepEqual(printingsBySet.get('MKC').map((p) => p.collector_number), ['45', '46']);

  await fetchPrintingsByName(deck, fetchFn, cache);
  assert.equal(searches.length, 1, 'second call is served from the cache');
});

test('warns instead of failing when a search fails', async () => {
  const fetchFn = async () => ({ ok: false, status: 500 });
  const { printingsBySet, warnings } = await fetchPrintingsByName([{ setCode: 'MKC', name: 'A' }], fetchFn);
  assert.equal(printingsBySet.size, 0);
  assert.equal(warnings.length, 1);
});

test('builds name queries grouped by set and split by length', () => {
  const cards = [
    { setCode: 'MKC', name: 'Ransom Note' },
    { setCode: 'MKC', name: 'Plains' },
    { setCode: 'MKM', name: 'Say "Hi"' },
  ];
  assert.deepEqual(
    buildNameQueries(cards).map((q) => q.text),
    ['(e:mkc (!"Ransom Note" or !"Plains")) or (e:mkm !"Say \\"Hi\\"")'],
  );
  const split = buildNameQueries(cards, 40);
  assert.ok(split.length > 1);
  assert.ok(split.every((q) => q.text.length <= 40));
  assert.deepEqual(split.flatMap((q) => q.cards), cards);
  for (const query of split) assert.deepEqual(parseNameQuery(query.text), query.cards.map((c) => ({ set: c.setCode.toLowerCase(), name: c.name })));
});
