/**
 * Downloads Card Kingdom's public price list and writes the compact
 * Scryfall ID → Card Kingdom name/edition map the site loads.
 *
 * Usage: npm run build:map [output path]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildCardKingdomMap } from '../js/card-kingdom-map.js';

const PRICELIST_URL = 'https://api.cardkingdom.com/api/v2/pricelist';
const outputPath = process.argv[2] ?? 'data/card-kingdom-map.json';

const response = await fetch(PRICELIST_URL);
if (!response.ok) throw new Error(`Card Kingdom price list request failed (${response.status}).`);
const pricelist = await response.json();

if (!Array.isArray(pricelist.data) || pricelist.data.length === 0) {
  throw new Error('Card Kingdom price list had no "data" array.');
}
const map = buildCardKingdomMap(pricelist);
const count = Object.keys(map.cards).length;
if (count === 0) {
  throw new Error(
    `None of ${pricelist.data.length} products had a scryfall_id. Fields seen: ${Object.keys(pricelist.data[0]).join(', ')}`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(map));
console.log(`Wrote ${count} printings across ${map.editions.length} editions to ${outputPath}.`);
