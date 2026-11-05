# ManaBox Seller

A small static site that converts a [ManaBox](https://manabox.app) export
(`.csv` or `.txt`) into a [Card Kingdom](https://www.cardkingdom.com) sell-list CSV.

## How it works

1. **Parse** the ManaBox file into `Card` objects (`js/manabox-csv.js`, `js/manabox-txt.js`).
2. **Find Scryfall IDs for `.txt` cards** (`js/scryfall.js`). CSV exports already have them and
   make no Scryfall requests. `.txt` exports only have set codes and collector numbers, so they're
   looked up with Scryfall's [collection endpoint](https://scryfall.com/docs/api/cards/collection),
   75 cards per request. Files dropped together share one lookup (`readDecks` in `js/convert.js`),
   and answers are kept in localStorage for a week (`js/stored-cache.js`). This keeps the site
   gentle on Scryfall's free API.
3. **Download Card Kingdom's buylist** (`js/card-kingdom-buylist.js`): their public price list
   (`api.cardkingdom.com/api/v2/pricelist`, about 10 MB gzipped, refreshed daily), once per visit,
   while step 2 runs. Each entry has a Scryfall ID, Card Kingdom's exact name and edition, the
   near-mint cash buy price, and how many copies they're buying.
4. **Name and price each card** from the buylist by Scryfall ID and foil (`js/card-kingdom.js`),
   e.g. `Ransom Note (0045)` in `Murders at Karlov Manor Commander Decks`. Cards Card Kingdom
   doesn't list keep their ManaBox name. If the buylist can't be downloaded, nothing is added
   and the page asks you to try again.
5. **Write two CSVs.** Cards Card Kingdom is buying go in the Card Kingdom CSV (no header,
   `name, set, TRUE/FALSE foil, quantity`) with prices and a total. Everything else, including
   copies beyond what Card Kingdom wants, goes in a leftovers CSV in ManaBox's format
   (`toManaboxCsv` in `js/manabox-csv.js`) to upload to CardConduit.

A checklist with spinners shows each step while it runs (`js/progress-steps.js`).

You can drop several exports at once, or add more after converting. Each file becomes a deck
in the page's list, and the download combines all of them, summing identical cards
(`js/sell-list.js`). Decks can be removed one at a time or cleared; nothing is saved between
page loads.

`samples/` holds canonical example files; the tests run against them.
`samples/card-kingdom-import-test/` holds real uploads to Card Kingdom and what they matched;
v3 matched every card, and the tests check both Blame Game exports still produce it from
`samples/card-kingdom-pricelist (Blame Game).json`, a slice of Card Kingdom's real price list.

## Development

No dependencies. Needs Node 22+ for tests.

```sh
npm test        # run tests (node --test)
npm run serve   # serve at http://localhost:8000 (ES modules need a server)
```

## Deployment

`.github/workflows/pages.yml` runs the tests and deploys to GitHub Pages on every push to
`main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.
