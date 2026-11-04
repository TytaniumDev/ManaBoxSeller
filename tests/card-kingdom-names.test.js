import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardKingdomEdition, cardKingdomTitle, findNamesWithSeveralVersions } from '../js/card-kingdom-names.js';

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

test('numbers cards that have several versions in their set', () => {
  assert.equal(cardKingdomTitle('Ransom Note', '45', true), 'Ransom Note (0045)');
});

test('leaves other card names alone', () => {
  assert.equal(cardKingdomTitle('Sol Ring', '237'), 'Sol Ring');
  assert.equal(cardKingdomTitle('Sol Ring', '237', false), 'Sol Ring');
});

test('finds names with several main printings, ignoring variants and promos', () => {
  const names = findNamesWithSeveralVersions([
    { name: 'Ransom Note', collector_number: '45' },
    { name: 'Ransom Note', collector_number: '46' },
    { name: 'Nelly', collector_number: '4' },
    { name: 'Nelly', collector_number: '300', frame_effects: ['extendedart'] },
    { name: 'Sol Ring', collector_number: '237' },
    { name: 'Sol Ring', collector_number: '400', border_color: 'borderless' },
    { name: 'Sol Ring', collector_number: '237p', promo: true },
  ]);
  assert.deepEqual([...names], ['Ransom Note']);
});
