import { readDecks } from './convert.js';
import { combineDecks, deckName } from './sell-list.js';
import { StoredCache } from './stored-cache.js';
import { fetchBuylist, splitByBuylist, formatDollars } from './card-kingdom-buylist.js';
import { toCardKingdomRows, toCardKingdomCsv } from './card-kingdom.js';
import { toManaboxCsv } from './manabox-csv.js';
import { ProgressSteps } from './progress-steps.js';

const dropZone = document.querySelector('#drop-zone');
const fileInput = document.querySelector('#file-input');
const stepList = document.querySelector('#steps');
const status = document.querySelector('#status');
const warningList = document.querySelector('#warnings');
const result = document.querySelector('#result');
const deckList = document.querySelector('#decks');
const sellingSummary = document.querySelector('#selling-summary');
const sellingTable = document.querySelector('#selling');
const leftoversSummary = document.querySelector('#leftovers-summary');
const leftoversTable = document.querySelector('#leftovers');
const downloadButton = document.querySelector('#download');
const downloadLeftoversButton = document.querySelector('#download-leftovers');
const clearButton = document.querySelector('#clear');

/** @type {import('./sell-list.js').Deck[]} */
let decks = [];
/**
 * Scryfall IDs for .txt cards, kept for a week across visits so repeat
 * decks don't hit Scryfall again (Scryfall asks clients to cache for at
 * least a day).
 */
const idCache = new StoredCache('scryfall-ids-v1', 7 * 24 * 60 * 60 * 1000);
/**
 * Card Kingdom's buylist, downloaded once per visit. Every deck in the
 * list was named and priced from it.
 *
 * @type {import('./card-kingdom-buylist.js').Buylist | undefined}
 */
let buylist;

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
  const { selling, fileName } = sellList();
  download(toCardKingdomCsv(selling), fileName);
});
downloadLeftoversButton.addEventListener('click', () => {
  const { leftovers, leftoversFileName } = sellList();
  download(toManaboxCsv(leftovers.map((row) => ({ ...row.printing, quantity: row.quantity }))), leftoversFileName);
});
clearButton.addEventListener('click', () => {
  decks = [];
  warningList.replaceChildren();
  stepList.hidden = true;
  status.textContent = '';
  render();
});

/**
 * Reads the files, looks up any .txt cards on Scryfall while Card Kingdom's
 * buylist downloads (the first time), then names and prices every card
 * from the buylist and adds the decks to the sell list.
 *
 * @param {File[]} files
 */
async function addFiles(files) {
  if (files.length === 0) return;
  warningList.replaceChildren();
  status.textContent = '';
  const steps = new ProgressSteps(stepList);
  const readStep = steps.add(files.length === 1 ? `Read ${files[0].name}` : `Read ${files.length} files`);
  const hasTxt = files.some((file) => /\.txt$/i.test(file.name));
  const scryfallStep = hasTxt ? steps.add('Look up .txt cards on Scryfall') : undefined;
  const buylistStep = steps.add(
    buylist ? 'Card Kingdom buylist already downloaded' : 'Download Card Kingdom buylist (about 10 MB)',
  );
  const matchStep = steps.add('Match cards to Card Kingdom’s names and prices');

  try {
    const inputs = await readStep.run(() =>
      Promise.all(files.map(async (file) => ({ fileName: file.name, text: await file.text() }))),
    );
    const readAll = () => readDecks(inputs, { idCache });
    const [read] = await Promise.all([scryfallStep ? scryfallStep.run(readAll) : readAll(), loadBuylist(buylistStep)]);

    matchStep.start();
    const failures = [];
    const warnings = [...read.warnings];
    for (const deck of read.decks) {
      if (deck.error) {
        failures.push(`${deck.fileName}: ${deck.error.message}`);
        continue;
      }
      decks = [...decks, { name: deckName(deck.fileName), rows: toCardKingdomRows(deck.cards, buylist.products) }];
      warnings.push(...deck.warnings.map((text) => `${deck.fileName}: ${text}`));
    }
    matchStep.done();
    showWarnings([...failures, ...warnings]);
  } catch (error) {
    showWarnings([`${error.message} Nothing was added; try the files again.`]);
  }
  render();
  status.textContent = summary();
}

/** @param {import('./progress-steps.js').Step} step */
async function loadBuylist(step) {
  if (buylist) {
    step.done();
    return;
  }
  buylist = await step.run(async () => {
    try {
      return await fetchBuylist();
    } catch (error) {
      throw new Error(`Couldn't download Card Kingdom's buylist (${error.message}).`);
    }
  });
}

/** The combined decks, split by what Card Kingdom is buying. */
function sellList() {
  const combined = combineDecks(decks);
  return { ...combined, ...splitByBuylist(combined.rows) };
}

function summary() {
  if (decks.length === 0) return '';
  const { rows } = combineDecks(decks);
  const deckCount = decks.length === 1 ? '1 deck' : `${decks.length} decks`;
  return `${countCards(rows)} cards in ${rows.length} rows from ${deckCount}.`;
}

function render() {
  result.hidden = decks.length === 0;
  showDecks();

  if (decks.length === 0) return;
  const { selling, leftovers, totalCents } = sellList();
  sellingSummary.textContent = `${countCards(selling)} cards for ${formatDollars(totalCents)} cash (near mint, prices from ${buylist.updatedAt ?? 'today'}).`;
  downloadButton.disabled = selling.length === 0;
  showRows(sellingTable, selling, (row) => [formatDollars(row.priceCents)]);

  leftoversSummary.textContent = `${countCards(leftovers)} cards Card Kingdom isn't buying, in ManaBox's CSV format.`;
  downloadLeftoversButton.disabled = leftovers.length === 0;
  showRows(leftoversTable, leftovers);
}

function showDecks() {
  deckList.replaceChildren(
    ...decks.map((deck) => {
      const remove = Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: 'Remove',
        onclick: () => {
          decks = decks.filter((other) => other !== deck);
          status.textContent = summary();
          render();
        },
      });
      const li = Object.assign(document.createElement('li'), {
        textContent: `${deck.name} (${countCards(deck.rows)} cards) `,
      });
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

/**
 * @template {import('./card-kingdom.js').CardKingdomRow} Row
 * @param {HTMLTableSectionElement} body
 * @param {Row[]} rows
 * @param {(row: Row) => Array<string | number>} [extraCells]
 */
function showRows(body, rows, extraCells = () => []) {
  body.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement('tr');
      for (const value of [row.name, row.edition, row.foil ? 'Yes' : '', row.quantity, ...extraCells(row)]) {
        tr.append(Object.assign(document.createElement('td'), { textContent: value }));
      }
      return tr;
    }),
  );
}

/** @param {Array<{ quantity: number }>} rows */
function countCards(rows) {
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

/**
 * @param {string} text
 * @param {string} fileName
 */
function download(text, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}
