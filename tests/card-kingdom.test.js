import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCardKingdomRows, toCardKingdomCsv } from '../js/card-kingdom.js';
import { parseManaboxCsv } from '../js/manabox-csv.js';
import { readSample } from './helpers.js';

const nelly = {
  name: 'Nelly Borca, Impulsive Accuser',
  setCode: 'MKC',
  setName: 'Murders at Karlov Manor Commander',
  collectorNumber: '4',
  finish: 'foil',
};

test('merges duplicates by name, set and foil', () => {
  const rows = toCardKingdomRows([
    { ...nelly, quantity: 1 },
    { ...nelly, quantity: 2 },
    { ...nelly, finish: 'normal', quantity: 1 },
  ]);
  assert.deepEqual(rows, [
    { name: nelly.name, edition: nelly.setName, foil: true, quantity: 3 },
    { name: nelly.name, edition: nelly.setName, foil: false, quantity: 1 },
  ]);
});

test('falls back to the set code when there is no set name', () => {
  const [row] = toCardKingdomRows([{ ...nelly, setName: undefined, quantity: 1 }]);
  assert.equal(row.edition, 'MKC');
});

test('converts the Blame Game CSV', () => {
  const { cards } = parseManaboxCsv(readSample('Blame Game.csv'));
  const rows = toCardKingdomRows(cards);
  assert.equal(rows.length, 86);
  const csv = toCardKingdomCsv(rows);
  assert.match(csv, /^"Nelly Borca, Impulsive Accuser",Murders at Karlov Manor Commander,TRUE,1$/m);
  assert.match(csv, /^Plains,Murders at Karlov Manor,FALSE,9$/m);
});
