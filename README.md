# ManaBox Seller

A small static site that converts a [ManaBox](https://manabox.app) export
(`.csv` or `.txt`) into a [Card Kingdom](https://www.cardkingdom.com) sell-list CSV.

## How it works

1. **Parse** the ManaBox file into `Card` objects (`js/manabox-csv.js`, `js/manabox-txt.js`).
2. **Identify each printing.** CSV exports already include Scryfall IDs. For `.txt`
   exports, the site asks the [Scryfall API](https://scryfall.com/docs/api/cards/collection)
   for them by set code and collector number (`js/scryfall.js`).
3. **Name it the Card Kingdom way.** Card Kingdom's set names differ from ManaBox's
   (e.g. `Murders at Karlov Manor Commander` vs `Murders at Karlov Manor Commander Decks`,
   and borderless/extended-art printings live in `... Variants` sets). A daily GitHub
   Action downloads Card Kingdom's public price list, which includes Scryfall IDs, and
   builds `data/card-kingdom-map.json` (`js/card-kingdom-map.js`).
4. **Write** the Card Kingdom CSV: no header, `name, set, TRUE/FALSE foil, quantity`,
   with duplicates merged (`js/card-kingdom.js`).

Cards Card Kingdom doesn't list keep their ManaBox set name and show a warning.

`samples/` holds canonical example files; the tests run against them.

## Development

No dependencies. Needs Node 22+ for tests and the map script.

```sh
npm test                 # run tests (node --test)
npm run build:map        # download Card Kingdom's price list → data/card-kingdom-map.json
npm run serve            # serve at http://localhost:8000 (ES modules need a server)
```

## Deployment

`.github/workflows/pages.yml` runs the tests, builds the map, and deploys to GitHub Pages on
every push to `main` and once a day. One-time setup: **Settings → Pages → Source: GitHub Actions**.
