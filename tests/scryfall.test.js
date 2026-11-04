import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScryfallIds } from '../js/scryfall.js';
import { convert } from '../js/convert.js';

/** A fake fetch that answers Scryfall's /cards/collection from a fixed list. */
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

const scryfallCards = [{ id: 'nelly-id', set: 'mkc', collector_number: '4', set_name: 'Murders at Karlov Manor Commander' }];

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
  const result = await convert({ fileName: 'deck.TXT', text: '// COMMANDER\n1 Nelly Borca, Impulsive Accuser (MKC) 4 *F*\n', fetchFn });
  assert.equal(result.csv, '"Nelly Borca, Impulsive Accuser",Murders at Karlov Manor Commander,TRUE,1\n');
  assert.deepEqual(result.warnings, []);
});

test('rejects other file types', async () => {
  await assert.rejects(convert({ fileName: 'deck.json', text: '' }), /\.csv or \.txt/);
});
