import { readFileSync } from 'node:fs';

/** Reads a file from samples/ as text. */
export function readSample(fileName) {
  return readFileSync(new URL(`../samples/${fileName}`, import.meta.url), 'utf8');
}
