import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCardKingdomMap, findCardKingdomPrinting } from '../js/card-kingdom-map.js';
import { toCardKingdomRows, toCardKingdomCsv } from '../js/card-kingdom.js';
import { parseManaboxCsv } from '../js/manabox-csv.js';
import { readSample } from './helpers.js';

const NELLY = '2ef59aa9-f5e1-413a-869b-d287db95efd0';
const pricelist = {
  data: [
    { scryfall_id: NELLY, name: 'Nelly Borca, Impulsive Accuser', variation: '', edition: 'Murders at Karlov Manor Commander Decks', is_foil: 'true' },
    { scryfall_id: NELLY, name: 'Nelly Borca, Impulsive Accuser', variation: '', edition: 'Murders at Karlov Manor Commander Decks', is_foil: 'false' },
    { scryfall_id: 'sol', name: 'Sol Ring', variation: 'Borderless', edition: 'Example Variants', is_foil: false },
    { scryfall_id: 'signet', name: 'Arcane Signet', variation: '', edition: 'Example', is_foil: true },
    { scryfall_id: '', name: 'Sealed product', edition: 'Example', is_foil: false },
  ],
};
const map = buildCardKingdomMap(pricelist, new Date('2026-11-04T00:00:00Z'));

test('builds a compact map keyed by Scryfall ID and finish', () => {
  assert.equal(map.updatedAt, '2026-11-04T00:00:00.000Z');
  assert.deepEqual(map.editions, ['Murders at Karlov Manor Commander Decks', 'Example Variants', 'Example']);
  assert.equal(Object.keys(map.cards).length, 4);
});

test('finds printings, naming variants and falling back from etched to foil', () => {
  assert.deepEqual(findCardKingdomPrinting(map, NELLY, 'foil'), {
    name: 'Nelly Borca, Impulsive Accuser',
    edition: 'Murders at Karlov Manor Commander Decks',
  });
  assert.deepEqual(findCardKingdomPrinting(map, 'sol', 'normal'), { name: 'Sol Ring (Borderless)', edition: 'Example Variants' });
  assert.equal(findCardKingdomPrinting(map, 'signet', 'etched').edition, 'Example');
  assert.equal(findCardKingdomPrinting(map, 'sol', 'foil'), undefined);
});

test('merges duplicates and uses the map, warning for unknown printings', () => {
  const card = { name: 'Nelly Borca, Impulsive Accuser', setCode: 'MKC', setName: 'Murders at Karlov Manor Commander', collectorNumber: '4', finish: 'foil', scryfallId: NELLY };
  const { rows, warnings } = toCardKingdomRows(
    [
      { ...card, quantity: 1 },
      { ...card, quantity: 2 },
      { ...card, finish: 'normal', scryfallId: 'unknown', quantity: 1 },
    ],
    map,
  );
  assert.deepEqual(rows, [
    { name: 'Nelly Borca, Impulsive Accuser', edition: 'Murders at Karlov Manor Commander', foil: false, quantity: 1 },
    { name: 'Nelly Borca, Impulsive Accuser', edition: 'Murders at Karlov Manor Commander Decks', foil: true, quantity: 3 },
  ]);
  assert.equal(warnings.length, 1);
});

test('converts the Blame Game CSV without a map using ManaBox set names', () => {
  const { cards } = parseManaboxCsv(readSample('Blame Game.csv'));
  const { rows, warnings } = toCardKingdomRows(cards, undefined);
  assert.deepEqual(warnings, []);
  assert.equal(rows.length, 86);
  const csv = toCardKingdomCsv(rows);
  assert.match(csv, /^"Nelly Borca, Impulsive Accuser",Murders at Karlov Manor Commander,TRUE,1$/m);
  assert.match(csv, /^Plains,Murders at Karlov Manor,FALSE,9$/m);
});
