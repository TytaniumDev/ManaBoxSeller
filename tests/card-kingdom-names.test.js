import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardKingdomEdition, cardKingdomTitle } from '../js/card-kingdom-names.js';

test('adds "Decks" to precon Commander set names', () => {
  assert.equal(cardKingdomEdition('Murders at Karlov Manor Commander'), 'Murders at Karlov Manor Commander Decks');
  assert.equal(cardKingdomEdition('Outlaws of Thunder Junction Commander'), 'Outlaws of Thunder Junction Commander Decks');
});

test('leaves other set names alone', () => {
  for (const name of ['Murders at Karlov Manor', 'Commander 2019', 'Commander Legends', 'Commander']) {
    assert.equal(cardKingdomEdition(name), name);
  }
});

test('adds a 4-digit collector number to basic lands', () => {
  assert.equal(cardKingdomTitle('Mountain', '283'), 'Mountain (0283)');
  assert.equal(cardKingdomTitle('Snow-Covered Forest', '1234'), 'Snow-Covered Forest (1234)');
});

test('leaves other card names alone', () => {
  assert.equal(cardKingdomTitle('Sol Ring', '237'), 'Sol Ring');
});
