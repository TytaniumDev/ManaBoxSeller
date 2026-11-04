import { convert } from './convert.js';

const dropZone = document.querySelector('#drop-zone');
const fileInput = document.querySelector('#file-input');
const status = document.querySelector('#status');
const warningList = document.querySelector('#warnings');
const result = document.querySelector('#result');
const preview = document.querySelector('#preview');
const downloadButton = document.querySelector('#download');

let download = { csv: '', fileName: '' };

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
  const [file] = event.dataTransfer.files;
  if (file) handleFile(file);
});
fileInput.addEventListener('change', () => {
  const [file] = fileInput.files;
  if (file) handleFile(file);
  fileInput.value = '';
});
downloadButton.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([download.csv], { type: 'text/csv' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: download.fileName });
  link.click();
  URL.revokeObjectURL(url);
});

/** @param {File} file */
async function handleFile(file) {
  result.hidden = true;
  warningList.replaceChildren();
  status.textContent = `Converting ${file.name}…`;
  try {
    const { rows, csv, warnings } = await convert({ fileName: file.name, text: await file.text() });

    download = { csv, fileName: file.name.replace(/\.[^.]+$/, '') + ' - Card Kingdom.csv' };
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    status.textContent = `${total} cards in ${rows.length} rows.`;
    showWarnings(warnings);
    showPreview(rows);
    result.hidden = false;
  } catch (error) {
    status.textContent = error.message;
  }
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
