# ManaBox Seller

A small static site that converts a [ManaBox](https://manabox.app) export
(`.csv` or `.txt`) into a [Card Kingdom](https://www.cardkingdom.com) sell-list CSV.

## How it works

1. **Parse** the ManaBox file into `Card` objects (`js/manabox-csv.js`, `js/manabox-txt.js`).
2. **Look up the deck on Scryfall** (`js/scryfall.js`). A batched search asks for every
   version of the deck's card names in their sets, e.g. `(e:mkc (!"Ransom Note" or !"Plains"))`,
   a few requests per deck at most. `.txt` exports only have set codes, so their set names come
   from the same results; the [collection endpoint](https://scryfall.com/docs/api/cards/collection)
   is only used for any card the search missed. Files dropped together share one lookup
   (`convertAll` in `js/convert.js`), and answers are kept in localStorage for a week
   (`js/stored-cache.js`), so converting the same cards again makes no requests. This keeps the
   site gentle on Scryfall's free API.
3. **Translate names** to Card Kingdom's conventions (`js/card-kingdom-names.js`):
   precon sets like `Murders at Karlov Manor Commander` become `... Commander Decks`, and
   cards with several versions in one set (basic lands, or e.g. the four Ransom Note arts in
   Blame Game) get a 4-digit collector number, e.g. `Mountain (0283)`, `Ransom Note (0045)`.
   Step 2's search results tell the site which cards need this.
4. **Write** the Card Kingdom CSV: no header, `name, set, TRUE/FALSE foil, quantity`,
   with duplicates merged (`js/card-kingdom.js`).
5. **Check Card Kingdom's buylist** (`js/card-kingdom-buylist.js`). The page downloads Card
   Kingdom's public price list (`api.cardkingdom.com/api/v2/pricelist`, about 10 MB gzipped,
   refreshed daily) once per visit, alongside the Scryfall lookups, and matches cards by
   Scryfall ID and foil. Cards Card Kingdom is buying go in the CK CSV with their near-mint cash
   price and a total; everything else, including copies beyond what CK wants, goes in a
   leftovers CSV in ManaBox's format (`toManaboxCsv` in `js/manabox-csv.js`) to upload to
   CardConduit. If the download fails, every card stays in the CK CSV. A checklist with
   spinners shows each step while it runs (`js/progress-steps.js`).

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
