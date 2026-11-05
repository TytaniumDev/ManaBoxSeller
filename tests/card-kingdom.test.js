import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCardKingdomRows, toCardKingdomCsv } from '../js/card-kingdom.js';
import { productKey, indexBuylist } from '../js/card-kingdom-buylist.js';
import { parseManaboxCsv } from '../js/manabox-csv.js';
import { parseManaboxTxt } from '../js/manabox-txt.js';
import { resolveScryfallIds } from '../js/scryfall.js';
import { readSample } from './helpers.js';

const nelly = {
  name: 'Nelly Borca, Impulsive Accuser',
  setCode: 'MKC',
  setName: 'Murders at Karlov Manor Commander',
  collectorNumber: '4',
  finish: 'foil',
  scryfallId: 'nelly-id',
};
const nellyFoil = {
  title: 'Nelly Borca, Impulsive Accuser',
  edition: 'Murders at Karlov Manor Commander Decks',
  priceCents: 38,
  buyQuantity: 8,
};
const ransom = { ...nelly, name: 'Ransom Note', collectorNumber: '45', finish: 'normal', scryfallId: 'ransom-45' };
const products = new Map([
  [productKey('nelly-id', true), nellyFoil],
  [productKey('ransom-45', false), { ...nellyFoil, title: 'Ransom Note (0045)', buyQuantity: 0 }],
]);

test("uses Card Kingdom's name and edition for each printing", () => {
  const rows = toCardKingdomRows([{ ...ransom, quantity: 2 }], products);
  assert.deepEqual(
    rows.map((row) => [row.name, row.edition, row.foil, row.quantity]),
    [['Ransom Note (0045)', 'Murders at Karlov Manor Commander Decks', false, 2]],
  );
});

test('merges duplicates by name, set and foil, keeping the source card and product', () => {
  const rows = toCardKingdomRows([{ ...nelly, quantity: 1 }, { ...nelly, quantity: 2 }], products);
  assert.deepEqual(rows, [
    {
      name: nelly.name,
      edition: 'Murders at Karlov Manor Commander Decks',
      foil: true,
      quantity: 3,
      printing: nelly,
      product: nellyFoil,
    },
  ]);
});

test("keeps ManaBox's name and set for cards Card Kingdom doesn't list", () => {
  const [nonFoil] = toCardKingdomRows([{ ...nelly, finish: 'normal', quantity: 1 }], products);
  assert.equal(nonFoil.name, nelly.name);
  assert.equal(nonFoil.edition, 'Murders at Karlov Manor Commander');
  assert.equal(nonFoil.product, undefined);

  const [noId] = toCardKingdomRows([{ ...nelly, scryfallId: undefined, setName: undefined, quantity: 1 }], products);
  assert.equal(noId.edition, 'MKC');
});

test('writes the Card Kingdom CSV with quoted names', () => {
  const csv = toCardKingdomCsv(toCardKingdomRows([{ ...nelly, quantity: 1 }], products));
  assert.equal(csv, '"Nelly Borca, Impulsive Accuser",Murders at Karlov Manor Commander Decks,TRUE,1\n');
});

test('names Blame Game exactly like the import Card Kingdom fully matched, from .csv and .txt', async () => {
  const { products } = indexBuylistSample();
  const expected = readSample('card-kingdom-import-test/Blame Game - Card Kingdom (v3).csv');
  const sorted = (csv) => csv.trim().split('\n').sort();

  const csvCards = parseManaboxCsv(readSample('Blame Game.csv')).cards;
  assert.deepEqual(sorted(toCardKingdomCsv(toCardKingdomRows(csvCards, products))), sorted(expected));

  // The .txt export has no Scryfall IDs; answer the lookup from the .csv's.
  const fetchFn = async (url, options) => ({
    ok: true,
    json: async () => ({
      data: JSON.parse(options.body).identifiers.flatMap(({ set, collector_number }) => {
        const match = csvCards.find((c) => c.setCode.toLowerCase() === set && c.collectorNumber === collector_number);
        return match ? [{ set, collector_number, id: match.scryfallId, set_name: match.setName }] : [];
      }),
    }),
  });
  const { cards: txtCards } = await resolveScryfallIds(parseManaboxTxt(readSample('Blame Game.txt')).cards, fetchFn);
  assert.deepEqual(sorted(toCardKingdomCsv(toCardKingdomRows(txtCards, products))), sorted(expected));
});

/** Card Kingdom's real price-list entries for the Blame Game cards. */
function indexBuylistSample() {
  const { data } = JSON.parse(readSample('card-kingdom-pricelist (Blame Game).json'));
  return { products: indexBuylist(data) };
}
