import { convertAll } from './convert.js';
import { combineDecks, deckName } from './sell-list.js';
import { StoredCache } from './stored-cache.js';
import { fetchBuylist, splitByBuylist, formatDollars } from './card-kingdom-buylist.js';
import { toCardKingdomCsv } from './card-kingdom.js';
import { toManaboxCsv } from './manabox-csv.js';
import { ProgressSteps } from './progress-steps.js';

const dropZone = document.querySelector('#drop-zone');
const fileInput = document.querySelector('#file-input');
const stepList = document.querySelector('#steps');
const status = document.querySelector('#status');
const warningList = document.querySelector('#warnings');
const result = document.querySelector('#result');
const deckList = document.querySelector('#decks');
const sellingHeading = document.querySelector('#selling-heading');
const sellingSummary = document.querySelector('#selling-summary');
const sellingTable = document.querySelector('#selling');
const leftoversSection = document.querySelector('#leftovers-section');
const leftoversSummary = document.querySelector('#leftovers-summary');
const leftoversTable = document.querySelector('#leftovers');
const downloadButton = document.querySelector('#download');
const downloadLeftoversButton = document.querySelector('#download-leftovers');
const clearButton = document.querySelector('#clear');

/** @type {import('./sell-list.js').Deck[]} */
let decks = [];
/**
 * Scryfall lookups, kept for a week across visits so repeat decks don't
 * hit Scryfall again (Scryfall asks clients to cache for at least a day).
 */
const printingsCache = new StoredCache('scryfall-printings-v1', 7 * 24 * 60 * 60 * 1000);
/**
 * Card Kingdom's buylist, downloaded once per visit. Undefined until it
 * loads, or if it couldn't be loaded (then everything goes in the CK list).
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
 * Converts the files together, so they share Scryfall lookups, and adds
 * them to the sell list. Card Kingdom's buylist downloads alongside the
 * Scryfall lookups the first time.
 *
 * @param {File[]} files
 */
async function addFiles(files) {
  if (files.length === 0) return;
  warningList.replaceChildren();
  status.textContent = '';
  const steps = new ProgressSteps(stepList, [
    files.length === 1 ? `Read ${files[0].name}` : `Read ${files.length} files`,
    'Look up cards on Scryfall',
    buylist ? 'Card Kingdom buylist already downloaded' : 'Download Card Kingdom buylist (about 10 MB)',
    'Check which cards Card Kingdom is buying',
  ]);
  const warnings = [];

  try {
    const inputs = await steps.run(0, () =>
      Promise.all(files.map(async (file) => ({ fileName: file.name, text: await file.text() }))),
    );
    const [converted] = await Promise.all([
      steps.run(1, () => convertAll(inputs, { printingsCache })),
      loadBuylist(steps, 2).catch((error) => {
        warnings.push(`Couldn't download Card Kingdom's buylist (${error.message}); every card is in the Card Kingdom list.`);
      }),
    ]);

    steps.start(3);
    warnings.push(...converted.warnings);
    const failures = [];
    for (const deck of converted.decks) {
      if (deck.error) {
        failures.push(`${deck.fileName}: ${deck.error.message}`);
        continue;
      }
      decks = [...decks, { name: deckName(deck.fileName), rows: deck.rows }];
      warnings.push(...deck.warnings.map((text) => `${deck.fileName}: ${text}`));
    }
    render();
    if (buylist) steps.done(3);
    else steps.fail(3, 'Couldn’t check which cards Card Kingdom is buying');
    showWarnings([...failures, ...warnings]);
  } catch (error) {
    showWarnings([...warnings, error.message]);
    render();
  }
  status.textContent = summary();
}

/**
 * @param {ProgressSteps} steps
 * @param {number} step
 */
async function loadBuylist(steps, step) {
  if (buylist) {
    steps.done(step);
    return;
  }
  buylist = await steps.run(step, () => fetchBuylist());
}

/** The combined decks, split by what Card Kingdom is buying. */
function sellList() {
  const combined = combineDecks(decks);
  if (!buylist) return { ...combined, selling: combined.rows, leftovers: [], totalCents: undefined };
  return { ...combined, ...splitByBuylist(combined.rows, buylist.offers) };
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

  const { selling, leftovers, totalCents } = sellList();
  sellingHeading.textContent = buylist ? 'Card Kingdom is buying' : 'Card Kingdom sell list';
  sellingSummary.textContent =
    totalCents === undefined
      ? `${countCards(selling)} cards. Prices unavailable.`
      : `${countCards(selling)} cards for ${formatDollars(totalCents)} cash (near mint, prices from ${buylist.updatedAt ?? 'today'}).`;
  downloadButton.disabled = selling.length === 0;
  showRows(sellingTable, selling, (row) => [formatDollars(row.priceCents)]);

  leftoversSection.hidden = !buylist;
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
