import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManaboxCsv } from '../js/manabox-csv.js';
import { parseManaboxTxt } from '../js/manabox-txt.js';
import { readSample } from './helpers.js';

const csv = parseManaboxCsv(readSample('Blame Game.csv'));
const txt = parseManaboxTxt(readSample('Blame Game.txt'));

const total = (cards) => cards.reduce((sum, card) => sum + card.quantity, 0);
const byPrinting = (cards) =>
  cards
    .map(({ name, setCode, collectorNumber, finish, quantity }) => ({ name, setCode, collectorNumber, finish, quantity }))
    .sort((a, b) => a.name.localeCompare(b.name));

test('parses the Blame Game CSV without warnings', () => {
  assert.deepEqual(csv.warnings, []);
  assert.equal(csv.cards.length, 86);
  assert.equal(total(csv.cards), 100);
});

test('reads every CSV field for a quoted, foil card', () => {
  assert.deepEqual(csv.cards.find((card) => card.name.startsWith('Nelly')), {
    name: 'Nelly Borca, Impulsive Accuser',
    setCode: 'MKC',
    setName: 'Murders at Karlov Manor Commander',
    collectorNumber: '4',
    finish: 'foil',
    quantity: 1,
    scryfallId: '2ef59aa9-f5e1-413a-869b-d287db95efd0',
  });
});

test('parses the Blame Game TXT, skipping the // COMMANDER section line', () => {
  assert.deepEqual(txt.warnings, []);
  assert.equal(total(txt.cards), 100);
  assert.deepEqual(txt.cards[0], {
    name: 'Nelly Borca, Impulsive Accuser',
    setCode: 'MKC',
    collectorNumber: '4',
    finish: 'foil',
    quantity: 1,
  });
});

test('TXT and CSV exports describe the same cards', () => {
  assert.deepEqual(byPrinting(txt.cards), byPrinting(csv.cards));
});

test('CSV reports missing columns', () => {
  assert.match(parseManaboxCsv('Name,Quantity\nSol Ring,1').warnings[0], /Missing ManaBox column/);
});

test('TXT warns about unreadable lines instead of failing', () => {
  const { cards, warnings } = parseManaboxTxt('1 Sol Ring (C21) 263\nnot a card\n2 Arcane Signet (C21) 236 *E*');
  assert.equal(cards.length, 2);
  assert.equal(cards[1].finish, 'etched');
  assert.deepEqual(warnings, ['Line 2: skipped, couldn\'t read "not a card".']);
});
