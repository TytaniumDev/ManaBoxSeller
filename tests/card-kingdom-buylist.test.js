import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUYLIST_URL,
  fetchBuylist,
  indexBuylist,
  splitByBuylist,
  formatDollars,
  offerKey,
} from '../js/card-kingdom-buylist.js';
import { toCardKingdomRows } from '../js/card-kingdom.js';
import { parseManaboxCsv } from '../js/manabox-csv.js';
import { readSample } from './helpers.js';

const item = (scryfallId, { foil = false, price = '0.25', buying = 8 } = {}) => ({
  scryfall_id: scryfallId,
  is_foil: String(foil),
  price_buy: price,
  qty_buying: buying,
});

const row = (scryfallId, quantity, foil = false) => ({
  name: `Card ${scryfallId}`,
  edition: 'Murders at Karlov Manor',
  foil,
  quantity,
  printing: { name: `Card ${scryfallId}`, setCode: 'MKM', collectorNumber: '1', finish: foil ? 'foil' : 'normal', scryfallId },
});

test('indexBuylist keeps only cards Card Kingdom is buying, in cents', () => {
  const offers = indexBuylist([
    item('a', { price: '1.10' }),
    item('a', { foil: true, price: '3.00', buying: 2 }),
    item('b', { buying: 0 }),
    { ...item('c'), scryfall_id: '' },
  ]);
  assert.deepEqual(
    [...offers],
    [
      [offerKey('a', false), { priceCents: 110, quantity: 8 }],
      [offerKey('a', true), { priceCents: 300, quantity: 2 }],
    ],
  );
});

test('indexBuylist keeps the first listing of a printing', () => {
  const offers = indexBuylist([item('a', { price: '0.75' }), item('a', { price: '2.75' })]);
  assert.equal(offers.get(offerKey('a', false)).priceCents, 75);
});

test('splitByBuylist splits rows and totals the price', () => {
  const offers = indexBuylist([item('a', { price: '1.10' }), item('b', { foil: true, price: '0.50' })]);
  const { selling, leftovers, totalCents } = splitByBuylist(
    [row('a', 2), row('b', 1), row('b', 1, true), row('c', 1)],
    offers,
  );
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
  const offers = indexBuylist([item('a', { buying: 3 })]);
  const { selling, leftovers } = splitByBuylist([row('a', 5)], offers);
  assert.equal(selling[0].quantity, 3);
  assert.equal(leftovers[0].quantity, 2);
});

test('splitByBuylist treats rows without a Scryfall ID as leftovers', () => {
  const { selling, leftovers } = splitByBuylist([{ ...row('a', 1), printing: undefined }], indexBuylist([item('a')]));
  assert.equal(selling.length, 0);
  assert.equal(leftovers.length, 1);
});

test('fetchBuylist downloads and indexes the price list', async () => {
  const requested = [];
  const fetchFn = async (url) => {
    requested.push(url);
    return Response.json({ meta: { created_at: '2026-11-05 09:11:52' }, data: [item('a')] });
  };
  const { offers, updatedAt } = await fetchBuylist(fetchFn);
  assert.deepEqual(requested, [BUYLIST_URL]);
  assert.equal(updatedAt, '2026-11-05 09:11:52');
  assert.equal(offers.size, 1);
});

test('fetchBuylist reports a failed request', async () => {
  const fetchFn = async () => new Response('', { status: 503 });
  await assert.rejects(fetchBuylist(fetchFn), /Card Kingdom request failed \(503\)/);
});

test('every Blame Game card can be looked up by Scryfall ID', () => {
  const { cards } = parseManaboxCsv(readSample('Blame Game.csv'));
  const rows = toCardKingdomRows(cards);
  const offers = indexBuylist(rows.map((r) => item(r.printing.scryfallId, { foil: r.foil, buying: 99 })));
  const { leftovers, selling } = splitByBuylist(rows, offers);
  assert.equal(leftovers.length, 0);
  assert.equal(selling.length, 86);
});

test('formatDollars', () => {
  assert.equal(formatDollars(7900), '$79.00');
  assert.equal(formatDollars(5), '$0.05');
});
