import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../js/csv.js';
import { readSample } from './helpers.js';

test('parses quoted cells with commas', () => {
  assert.deepEqual(parseCsv('"Sedris, the Traitor King",Shards of Alara,FALSE,1\n'), [
    ['Sedris, the Traitor King', 'Shards of Alara', 'FALSE', '1'],
  ]);
});

test('parses escaped quotes and CRLF, skipping blank lines', () => {
  assert.deepEqual(parseCsv('a,"say ""hi"""\r\n\r\nb,c'), [
    ['a', 'say "hi"'],
    ['b', 'c'],
  ]);
});

test('reads the Card Kingdom sample as four columns per row', () => {
  const rows = parseCsv(readSample('CardKingdomSample.csv'));
  assert.equal(rows.length, 5);
  for (const row of rows) assert.equal(row.length, 4);
});

test('writes CSV, quoting only when needed', () => {
  assert.equal(toCsv([['Sedris, the Traitor King', 'Shards of Alara', 'FALSE', 1], ['Bayou', '3rd Edition', 'FALSE', 1]]),
    '"Sedris, the Traitor King",Shards of Alara,FALSE,1\nBayou,3rd Edition,FALSE,1\n');
  assert.equal(toCsv([['a "b"']]), '"a ""b"""\n');
});

test('round-trips through parse and write', () => {
  const rows = [['x, y', 'z "q"', '1']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});
