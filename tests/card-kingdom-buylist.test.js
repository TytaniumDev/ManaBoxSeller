import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUYLIST_URL,
  fetchBuylist,
  indexBuylist,
  splitByBuylist,
  formatDollars,
  productKey,
} from '../js/card-kingdom-buylist.js';
import { toCardKingdomRows } from '../js/card-kingdom.js';
import { parseManaboxCsv } from '../js/manabox-csv.js';
import { readSample } from './helpers.js';

const item = (scryfallId, { foil = false, price = '0.25', buying = 8, variation = '' } = {}) => ({
  scryfall_id: scryfallId,
  name: `Card ${scryfallId}`,
  variation,
  edition: 'Murders at Karlov Manor',
  is_foil: String(foil),
  price_buy: price,
  qty_buying: buying,
});

const card = (scryfallId, quantity, foil = false) => ({
  name: `Card ${scryfallId}`,
  setCode: 'MKM',
  setName: 'Murders at Karlov Manor',
  collectorNumber: '1',
  finish: foil ? 'foil' : 'normal',
  quantity,
  scryfallId,
});

test('indexBuylist keys products by Scryfall ID and foil, prices in cents', () => {
  const products = indexBuylist([
    item('a', { price: '1.10', variation: '0045' }),
    item('a', { foil: true, price: '3.00', buying: 2 }),
    item('b', { buying: 0 }),
    { ...item('c'), scryfall_id: '' },
  ]);
  assert.deepEqual(
    [...products],
    [
      [productKey('a', false), { title: 'Card a (0045)', edition: 'Murders at Karlov Manor', priceCents: 110, buyQuantity: 8 }],
      [productKey('a', true), { title: 'Card a', edition: 'Murders at Karlov Manor', priceCents: 300, buyQuantity: 2 }],
      [productKey('b', false), { title: 'Card b', edition: 'Murders at Karlov Manor', priceCents: 25, buyQuantity: 0 }],
    ],
  );
});

test('indexBuylist keeps the first listing of a printing', () => {
  const products = indexBuylist([item('a', { price: '0.75' }), item('a', { price: '2.75' })]);
  assert.equal(products.get(productKey('a', false)).priceCents, 75);
});

test('splitByBuylist splits rows and totals the price', () => {
  const products = indexBuylist([
    item('a', { price: '1.10' }),
    item('b', { foil: true, price: '0.50' }),
    item('b', { buying: 0 }),
  ]);
  const rows = toCardKingdomRows([card('a', 2), card('b', 1), card('b', 1, true), card('c', 1)], products);
  const { selling, leftovers, totalCents } = splitByBuylist(rows);
  assert.deepEqual(
    selling.map((r) => [r.name, r.foil, r.quantity, r.priceCents]),
    [
      ['Card a', false, 2, 110],
      ['Card b', true, 1, 50],
    ],
  );
  assert.deepEqual(
    leftovers.map((r) => [r.name, r.foil, r.quantity]),
    [
      ['Card b', false, 1],
      ['Card c', false, 1],
    ],
  );
  assert.equal(totalCents, 270);
});

test('splitByBuylist sends copies beyond what Card Kingdom wants to the leftovers', () => {
  const rows = toCardKingdomRows([card('a', 5)], indexBuylist([item('a', { buying: 3 })]));
  const { selling, leftovers } = splitByBuylist(rows);
  assert.equal(selling[0].quantity, 3);
  assert.equal(leftovers[0].quantity, 2);
});

test('fetchBuylist downloads and indexes the price list', async () => {
  const requested = [];
  const fetchFn = async (url) => {
    requested.push(url);
    return Response.json({ meta: { created_at: '2026-11-05 09:11:52' }, data: [item('a')] });
  };
  const { products, updatedAt } = await fetchBuylist(fetchFn);
  assert.deepEqual(requested, [BUYLIST_URL]);
  assert.equal(updatedAt, '2026-11-05 09:11:52');
  assert.equal(products.size, 1);
});

test('fetchBuylist reports a failed request', async () => {
  const fetchFn = async () => new Response('', { status: 503 });
  await assert.rejects(fetchBuylist(fetchFn), /Card Kingdom request failed \(503\)/);
});

test('every Blame Game card can be looked up by Scryfall ID', () => {
  const { cards } = parseManaboxCsv(readSample('Blame Game.csv'));
  const products = indexBuylist(cards.map((c) => item(c.scryfallId, { foil: c.finish !== 'normal', buying: 99 })));
  const { leftovers, selling } = splitByBuylist(toCardKingdomRows(cards, products));
  assert.equal(leftovers.length, 0);
  assert.equal(selling.length, 86);
});

test('formatDollars', () => {
  assert.equal(formatDollars(7900), '$79.00');
  assert.equal(formatDollars(5), '$0.05');
});
