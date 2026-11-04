/**
 * Matches a ManaBox text line such as:
 *   1 Nelly Borca, Impulsive Accuser (MKC) 4 *F*
 * Groups: quantity, name, set code, collector number, foil marker.
 */
const LINE = /^(\d+)\s+(.+?)\s+\(([A-Za-z0-9]+)\)\s+(\S+)(?:\s+\*(F|E)\*)?$/;

/**
 * Parses a ManaBox text export. "// SECTION" lines and blank lines are
 * ignored. The text format has no set names or Scryfall IDs; those are
 * filled in later by the Scryfall lookup.
 *
 * @param {string} text
 * @returns {{ cards: import('./card.js').Card[], warnings: string[] }}
 */
export function parseManaboxTxt(text) {
  const cards = [];
  const warnings = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('//')) return;

    const match = LINE.exec(line);
    if (!match) {
      warnings.push(`Line ${i + 1}: skipped, couldn't read "${line}".`);
      return;
    }
    const [, quantity, name, setCode, collectorNumber, marker] = match;
    cards.push({
      name,
      setCode: setCode.toUpperCase(),
      collectorNumber,
      finish: marker === 'F' ? 'foil' : marker === 'E' ? 'etched' : 'normal',
      quantity: Number(quantity),
    });
  });
  return { cards, warnings };
}
