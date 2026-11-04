import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScryfallIds, fetchSetPrintings } from '../js/scryfall.js';
import { convert } from '../js/convert.js';

/**
 * A fake fetch that answers Scryfall's /cards/collection and /cards/search
 * (`e:<set>` queries only) from a fixed list. Only collection calls are recorded.
 */
function fakeScryfall(cards) {
  const calls = [];
  const fetchFn = async (url, options) => {
    if (url.includes('/cards/search')) {
      const set = new URL(url).searchParams.get('q').replace('e:', '');
      const data = cards.filter((card) => card.set === set);
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
  return { fetchFn, calls };
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

test('fetches every page of a set', async () => {
  const pages = {
    first: { data: [{ name: 'A' }], has_more: true, next_page: 'https://api.scryfall.com/cards/search?page=2' },
    second: { data: [{ name: 'B' }], has_more: false },
  };
  const fetchFn = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.includes('page=2') ? pages.second : pages.first),
  });
  const { printingsBySet, warnings } = await fetchSetPrintings(['MKC', 'MKC'], fetchFn);
  assert.deepEqual(printingsBySet.get('MKC'), [{ name: 'A' }, { name: 'B' }]);
  assert.deepEqual(warnings, []);
});

test('warns instead of failing when a set cannot be loaded', async () => {
  const fetchFn = async () => ({ ok: false, status: 500 });
  const { printingsBySet, warnings } = await fetchSetPrintings(['MKC'], fetchFn);
  assert.equal(printingsBySet.size, 0);
  assert.equal(warnings.length, 1);
});

test('reuses sets from the cache instead of fetching them again', async () => {
  let requests = 0;
  const fetchFn = async () => {
    requests++;
    return { ok: true, status: 200, json: async () => ({ data: [{ name: 'A' }], has_more: false }) };
  };
  const cache = new Map();
  await fetchSetPrintings(['MKC'], fetchFn, cache);
  const { printingsBySet } = await fetchSetPrintings(['MKC'], fetchFn, cache);
  assert.equal(requests, 1);
  assert.deepEqual(printingsBySet.get('MKC'), [{ name: 'A' }]);
});
