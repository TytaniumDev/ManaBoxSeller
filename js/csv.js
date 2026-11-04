/**
 * Minimal RFC 4180 CSV reading and writing. Knows nothing about cards.
 */

/**
 * Parses CSV text into rows of string cells.
 * Handles quoted cells, escaped quotes ("") and CRLF line endings.
 * Blank lines are skipped.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      endCell();
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Serialises rows to CSV, quoting only cells that need it.
 *
 * @param {Array<Array<string | number>>} rows
 * @returns {string}
 */
export function toCsv(rows) {
  return rows.map((row) => row.map(formatCell).join(',')).join('\n') + '\n';
}

function formatCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
