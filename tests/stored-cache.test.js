import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoredCache } from '../js/stored-cache.js';

function fakeStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
}

const DAY = 24 * 60 * 60 * 1000;

test('saves entries and loads them in a new cache', async () => {
  const storage = fakeStorage();
  const first = new StoredCache('test', DAY, storage);
  first.set('MKC|Ransom Note', [{ collector_number: '45' }]);
  await Promise.resolve(); // let the queued save run

  const second = new StoredCache('test', DAY, storage);
  assert.ok(second.has('MKC|Ransom Note'));
  assert.deepEqual(second.get('MKC|Ransom Note'), [{ collector_number: '45' }]);
});

test('drops entries older than the max age', () => {
  const storage = fakeStorage();
  storage.setItem('test', JSON.stringify({ old: { at: Date.now() - 2 * DAY, value: 1 }, fresh: { at: Date.now(), value: 2 } }));
  const cache = new StoredCache('test', DAY, storage);
  assert.equal(cache.has('old'), false);
  assert.equal(cache.get('fresh'), 2);
});

test('works in memory when storage is missing or broken', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  for (const storage of [undefined, broken]) {
    const cache = new StoredCache('test', DAY, storage);
    cache.set('a', 1);
    assert.equal(cache.get('a'), 1);
  }
});
