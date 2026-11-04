# ManaBox Seller

A small static site that converts a [ManaBox](https://manabox.app) export
(`.csv` or `.txt`) into a [Card Kingdom](https://www.cardkingdom.com) sell-list CSV.

## How it works

1. **Parse** the ManaBox file into `Card` objects (`js/manabox-csv.js`, `js/manabox-txt.js`).
2. **Fill in set names for `.txt` exports.** The text format only has set codes, so the site
   asks the [Scryfall API](https://scryfall.com/docs/api/cards/collection) for each printing by
   set code and collector number (`js/scryfall.js`). CSV exports already include set names.
3. **Translate names** to Card Kingdom's conventions (`js/card-kingdom-names.js`):
   precon sets like `Murders at Karlov Manor Commander` become `... Commander Decks`, and
   cards with several versions in one set (basic lands, or e.g. the four Ransom Note arts in
   Blame Game) get a 4-digit collector number, e.g. `Mountain (0283)`, `Ransom Note (0045)`.
   The site loads each set's printings from Scryfall to know which cards need this.
4. **Write** the Card Kingdom CSV: no header, `name, set, TRUE/FALSE foil, quantity`,
   with duplicates merged (`js/card-kingdom.js`).

You can drop several exports at once, or add more after converting. Each file becomes a deck
in the page's list, and the download combines all of them, summing identical cards
(`js/sell-list.js`). Decks can be removed one at a time or cleared; nothing is saved between
page loads.

`samples/` holds canonical example files; the tests run against them.
`samples/card-kingdom-import-test/` holds a real upload to Card Kingdom and what it matched.

## Development

No dependencies. Needs Node 22+ for tests.

```sh
npm test        # run tests (node --test)
npm run serve   # serve at http://localhost:8000 (ES modules need a server)
```

## Deployment

`.github/workflows/pages.yml` runs the tests and deploys to GitHub Pages on every push to
`main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.
