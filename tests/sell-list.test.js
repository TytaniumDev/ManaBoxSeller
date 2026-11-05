import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineDecks, deckName } from '../js/sell-list.js';

const row = (name, quantity, foil = false) => ({ name, edition: 'Murders at Karlov Manor', foil, quantity });

test('deckName strips the extension', () => {
  assert.equal(deckName('Blame Game.txt'), 'Blame Game');
  assert.equal(deckName('My.Deck.csv'), 'My.Deck');
});

test('a single deck keeps its name in the file name', () => {
  const { rows, fileName } = combineDecks([{ name: 'Blame Game', rows: [row('Shock', 1)] }]);
  assert.deepEqual(rows, [row('Shock', 1)]);
  assert.equal(fileName, 'Blame Game - Card Kingdom.csv');
});

test('names the leftovers file after the decks', () => {
  assert.equal(combineDecks([{ name: 'Blame Game', rows: [] }]).leftoversFileName, 'Blame Game - Leftovers.csv');
  assert.equal(
    combineDecks([
      { name: 'A', rows: [] },
      { name: 'B', rows: [] },
    ]).leftoversFileName,
    'Leftovers (2 decks).csv',
  );
});

test('combines decks, summing identical cards and keeping foils separate', () => {
  const first = { name: 'A', rows: [row('Shock', 1), row('Mountain (0283)', 7)] };
  const second = { name: 'B', rows: [row('Shock', 2), row('Shock', 1, true)] };
  const { rows, csv, fileName } = combineDecks([first, second]);

  assert.deepEqual(rows, [row('Mountain (0283)', 7), row('Shock', 3), row('Shock', 1, true)]);
  assert.equal(
    csv,
    'Mountain (0283),Murders at Karlov Manor,FALSE,7\nShock,Murders at Karlov Manor,FALSE,3\nShock,Murders at Karlov Manor,TRUE,1\n',
  );
  assert.equal(fileName, 'Card Kingdom sell list (2 decks).csv');
  assert.equal(first.rows[0].quantity, 1, 'does not mutate the decks');
});
