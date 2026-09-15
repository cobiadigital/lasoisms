# Lassoisms

A one-screen web app: it opens on a random Ted Lasso quote, and every tap gives
you another. A dock at the bottom lets you filter which characters are in the mix.

## What's here

```
public/
  index.html            app shell
  styles.css            AFC Richmond kit styling (blue / gold / cream)
  app.js                shuffle-bag randomizer, filters, share
  quotes.json           the quote dataset — edit this file to add lines
  manifest.webmanifest  add-to-home-screen support
  icon.svg              BELIEVE sign icon
wrangler.jsonc          Cloudflare Workers static-assets config
```

No build step, no framework, no runtime dependencies. The page is three static
files plus a JSON dataset.

## Behaviour

- **Tap / click anywhere** (or swipe sideways, or press space / arrow keys) for the next quote.
- **Shuffle bag:** every quote in the current filter shows once before any repeats.
- **Character filter:** tap the pill at the bottom to open multi-select chips, each
  showing how many quotes that character has. "Everyone" toggles all on or off.
  Your selection is remembered in `localStorage`.
- **Share button** (top right) uses the native share sheet on mobile and falls
  back to copying the quote to the clipboard.
- Respects `prefers-reduced-motion` and iOS safe-area insets.

## Editing the quotes

`public/quotes.json` is the whole dataset:

```json
{
  "order": ["Ted Lasso", "Roy Kent", "..."],
  "quotes": [
    { "character": "Ted Lasso", "quote": "Be curious, not judgmental." }
  ]
}
```

Add an object to `quotes` and it appears immediately — counts, chips and the
character list are all derived from the data at load time. A character that
isn't in `order` still shows up, just after the ordered ones.

Currently 214 quotes across 27 characters, 156 of them verified.

### The `verified` flag

Each quote carries `"verified": true|false`, written by `tools/verify_quotes.py`, which checks
two independent sources:

1. The [Ted Lasso fan wiki](https://tedlasso.fandom.com), fetched live through its MediaWiki
   API and matched as overlapping five-word windows. It is mostly plot summary, so it quotes
   dialogue only here and there.
2. Any `.tsv` under `tools/sources/` (`speaker<TAB>quote`), transcribed from published quote
   compilations. `megapost.tsv` holds the lines transcribed from the *330+ Ted Lasso Quotes*
   megapost at Minimize My Mess, compiled by its author from the episode transcripts.

A quote is verified if **either** source confirms it. `false` means neither did, **not** that
the line is wrong. Treat unverified lines as remembered-but-unconfirmed.

```
python3 tools/verify_quotes.py            # both sources
python3 tools/verify_quotes.py --dry-run  # report without writing
python3 tools/verify_quotes.py --offline  # skip the wiki fetch
```

It only ever rewrites flags; it never adds or edits quote text.

### Attribution conflicts

Cross-checking the two sources caught three lines credited to the wrong person, all since
corrected: the "tall Yodas" line is Jamie's rather than Ted's, the "truth will set you free"
line belongs to Dr. Sharon and was duplicated under Ted, and the "Jamie Tartt" chant is sung
by the crowd. If you spot another, fix `character` in `quotes.json`.

### On sourcing

English Wikiquote has no Ted Lasso article, and the fan wiki's HTML and the transcript sites
all refuse automated requests, so nothing here was scraped. The dataset is a hand-curated core
plus the megapost lines, which are short excerpts credited to their compiler above.

## Deploying (Cloudflare Workers Builds)

This repo is set up for a dashboard-connected Worker, so a push to the branch
deploys it. In the Cloudflare dashboard, under **Workers & Pages → your Worker →
Settings → Build**:

- **Build command:** `npm run build` (or leave empty — there is nothing to build)
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** `/`

No secrets or environment variables are needed. `wrangler.jsonc` declares
`public/` as the asset directory, and with no Worker script the assets are served
directly from Cloudflare's edge.

To run it locally instead: `npm install && npm run dev`.

## Legal note

Quotes are short excerpts from *Ted Lasso* (Apple TV+), reproduced for
commentary and fandom. This project isn't affiliated with, endorsed by, or
sponsored by Apple, Warner Bros., or the show's creators, and it uses no logos
or marks.
