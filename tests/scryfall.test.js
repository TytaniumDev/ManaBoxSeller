import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScryfallIds } from '../js/scryfall.js';
import { readDecks } from '../js/convert.js';
import { readSample } from './helpers.js';

/**
 * A fake fetch that answers Scryfall's /cards/collection from a fixed list
 * and records each request's identifiers in `calls`.
 */
function fakeScryfall(cards) {
  const calls = [];
  const fetchFn = async (url, options) => {
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
  { ...mkc, id: 'nelly-id', collector_number: '4' },
  { ...mkc, id: 'ransom-45', collector_number: '45' },
];
const nelly = { name: 'Nelly', setCode: 'MKC', collectorNumber: '4', finish: 'foil', quantity: 1 };

test('fills in Scryfall IDs and set names by set code and collector number', async () => {
  const { fetchFn, calls } = fakeScryfall(scryfallCards);
  const { cards, warnings } = await resolveScryfallIds([nelly, { ...nelly }, { ...nelly, collectorNumber: '999' }], fetchFn);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 2, 'duplicate printings are requested once');
  assert.equal(cards[0].scryfallId, 'nelly-id');
  assert.equal(cards[1].setName, 'Murders at Karlov Manor Commander');
  assert.deepEqual(warnings, ['Nelly (MKC 999) wasn\'t found on Scryfall.']);
});

test('skips the network when every card already has a Scryfall ID', async () => {
  const { fetchFn, calls } = fakeScryfall([]);
  await resolveScryfallIds([{ ...nelly, scryfallId: 'id' }], fetchFn);
  assert.equal(calls.length, 0);
});

test('reuses cached printings instead of asking Scryfall again', async () => {
  const { fetchFn, calls } = fakeScryfall(scryfallCards);
  const cache = new Map();
  await resolveScryfallIds([nelly], fetchFn, cache);
  const { cards } = await resolveScryfallIds([nelly], fetchFn, cache);
  assert.equal(calls.length, 1);
  assert.equal(cards[0].scryfallId, 'nelly-id');
});

test('reports a failed Scryfall request', async () => {
  const fetchFn = async () => ({ ok: false, status: 500 });
  await assert.rejects(resolveScryfallIds([nelly], fetchFn), /Scryfall request failed \(500\)/);
});

test('reads several files with one shared lookup, keeping a bad file separate', async () => {
  const { fetchFn, calls } = fakeScryfall(scryfallCards);
  const { decks, warnings } = await readDecks(
    [
      { fileName: 'a.txt', text: '1 Nelly (MKC) 4 *F*\n' },
      { fileName: 'b.txt', text: '2 Ransom Note (MKC) 45\n' },
      { fileName: 'c.json', text: '' },
    ],
    { fetchFn },
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(warnings, []);
  assert.equal(decks[0].cards[0].scryfallId, 'nelly-id');
  assert.equal(decks[1].cards[0].scryfallId, 'ransom-45');
  assert.match(decks[2].error.message, /\.csv or \.txt/);
});

test('a CSV export needs no Scryfall requests', async () => {
  const { fetchFn, calls } = fakeScryfall([]);
  const { decks } = await readDecks([{ fileName: 'Blame Game.csv', text: readSample('Blame Game.csv') }], { fetchFn });
  assert.equal(calls.length, 0);
  assert.equal(decks[0].cards.length, 86);
});
