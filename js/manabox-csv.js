import { parseCsv } from './csv.js';
import { toFinish } from './card.js';

/** ManaBox CSV header names this parser reads. */
const COLUMNS = Object.freeze({
  name: 'Name',
  setCode: 'Set code',
  setName: 'Set name',
  collectorNumber: 'Collector number',
  finish: 'Foil',
  quantity: 'Quantity',
  scryfallId: 'Scryfall ID',
});

/**
 * Parses a ManaBox CSV export. Columns are looked up by header name,
 * so column order doesn't matter.
 *
 * @param {string} text
 * @returns {{ cards: import('./card.js').Card[], warnings: string[] }}
 */
export function parseManaboxCsv(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { cards: [], warnings: ['The file is empty.'] };

  const index = {};
  const missing = [];
  for (const [key, column] of Object.entries(COLUMNS)) {
    index[key] = header.indexOf(column);
    if (index[key] === -1) missing.push(column);
  }
  if (missing.length > 0) {
    return { cards: [], warnings: [`Missing ManaBox column(s): ${missing.join(', ')}.`] };
  }

  const cards = [];
  const warnings = [];
  rows.forEach((row, i) => {
    const line = i + 2; // 1-based, after the header
    const quantity = Number.parseInt(row[index.quantity], 10);
    const finish = toFinish(row[index.finish] ?? '');
    if (!Number.isInteger(quantity) || quantity < 1) {
      warnings.push(`Line ${line}: skipped, invalid quantity "${row[index.quantity]}".`);
      return;
    }
    if (!finish) {
      warnings.push(`Line ${line}: skipped, unknown foil value "${row[index.finish]}".`);
      return;
    }
    cards.push({
      name: row[index.name],
      setCode: row[index.setCode].toUpperCase(),
      setName: row[index.setName],
      collectorNumber: row[index.collectorNumber],
      finish,
      quantity,
      scryfallId: row[index.scryfallId] || undefined,
    });
  });
  return { cards, warnings };
}
