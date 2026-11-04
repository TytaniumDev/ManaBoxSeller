import { convert } from './convert.js';
import { combineDecks, deckName } from './sell-list.js';

const dropZone = document.querySelector('#drop-zone');
const fileInput = document.querySelector('#file-input');
const status = document.querySelector('#status');
const warningList = document.querySelector('#warnings');
const result = document.querySelector('#result');
const deckList = document.querySelector('#decks');
const preview = document.querySelector('#preview');
const downloadButton = document.querySelector('#download');
const clearButton = document.querySelector('#clear');

/** @type {import('./sell-list.js').Deck[]} */
let decks = [];
/** Scryfall printings already looked up this visit, shared by every conversion. */
const printingsCache = new Map();

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
  addFiles([...event.dataTransfer.files]);
});
fileInput.addEventListener('change', () => {
  addFiles([...fileInput.files]);
  fileInput.value = '';
});
downloadButton.addEventListener('click', () => {
  const { csv, fileName } = combineDecks(decks);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
});
clearButton.addEventListener('click', () => {
  decks = [];
  warningList.replaceChildren();
  status.textContent = '';
  render();
});

/**
 * Converts each file in turn and adds it to the sell list.
 *
 * @param {File[]} files
 */
async function addFiles(files) {
  if (files.length === 0) return;
  warningList.replaceChildren();
  const warnings = [];
  const failures = [];

  for (const file of files) {
    status.textContent = `Converting ${file.name}…`;
    try {
      const converted = await convert({ fileName: file.name, text: await file.text(), printingsCache });
      decks = [...decks, { name: deckName(file.name), rows: converted.rows }];
      warnings.push(...converted.warnings.map((text) => `${file.name}: ${text}`));
    } catch (error) {
      failures.push(`${file.name}: ${error.message}`);
    }
    render();
  }

  showWarnings([...failures, ...warnings]);
  status.textContent = summary();
}

function summary() {
  if (decks.length === 0) return '';
  const { rows } = combineDecks(decks);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const deckCount = decks.length === 1 ? '1 deck' : `${decks.length} decks`;
  return `${total} cards in ${rows.length} rows from ${deckCount}.`;
}

function render() {
  result.hidden = decks.length === 0;
  showDecks();
  showPreview(combineDecks(decks).rows);
}

function showDecks() {
  deckList.replaceChildren(
    ...decks.map((deck) => {
      const cardCount = deck.rows.reduce((sum, row) => sum + row.quantity, 0);
      const remove = Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: 'Remove',
        onclick: () => {
          decks = decks.filter((other) => other !== deck);
          status.textContent = summary();
          render();
        },
      });
      const li = Object.assign(document.createElement('li'), { textContent: `${deck.name} (${cardCount} cards) ` });
      li.append(remove);
      return li;
    }),
  );
}

/** @param {string[]} warnings */
function showWarnings(warnings) {
  warningList.replaceChildren(
    ...warnings.map((text) => Object.assign(document.createElement('li'), { textContent: text })),
  );
}

/** @param {import('./card-kingdom.js').CardKingdomRow[]} rows */
function showPreview(rows) {
  preview.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement('tr');
      for (const value of [row.name, row.edition, row.foil ? 'Yes' : '', row.quantity]) {
        tr.append(Object.assign(document.createElement('td'), { textContent: value }));
      }
      return tr;
    }),
  );
}
