# Browser research instructions (554-queue working doc — DELETE BEFORE MERGE)

Rendered fetching is available and mandatory whenever `curl`/`wget` return a JS
shell instead of content. Tested 2026-11-12 on `https://thinkrail.ai/` (HTTP 200,
real title, full rendered text, links, PNG screenshot).

## Environment (same machine, same HOME for all delegates)

- Node: `node` should be on PATH; fallback `export PATH="$HOME/.local/bin:$PATH"`.
- Driver: `require('/home/mgw/src/podium/node_modules/playwright-core')` by absolute
  path. Do NOT `cd` into that checkout, do NOT `npm install` anything.
- Engine: `/home/mgw/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`
  (headless shell — the full Chromium and WebKit builds have unresolvable system
  deps on this host: `libasound.so.2` for Chromium, dozens for WebKit, no sudo).
- Extra shared lib (user-space, no root needed):
  `export LD_LIBRARY_PATH="$HOME/.cache/ade-browser-libs/usr/lib/x86_64-linux-gnu"`
- Helper: `browser-fetch.cjs` at this branch root wraps all of the above:
  `LD_LIBRARY_PATH=... node browser-fetch.cjs "<url>" /tmp/<id>-<page> [--dismiss-cookies]`

## How to use it

1. Fetch `curl -sL` first; if the body is a JS shell (`<div id="root">`, `__NEXT_DATA__`
   with no copy, "enable JavaScript", …), switch to `browser-fetch.cjs`.
2. Read the JSON: `finalUrl` (redirects matter for identity evidence), `status`,
   `title`, `text`, `links`. Open the PNG screenshot and confirm with your own eyes
   what the page shows — never trust extracted text alone for the visual-status call.
3. Consent dialogs (e.g. Cookiebot): pass `--dismiss-cookies`, prefer Deny, and note
   the dialog in the answer's search/access notes. Re-screenshot after dismissal for
   screenshot candidates.
4. Evidence ledger: browser-fetched pages are cited like any first-party page — URL,
   title, locator (section/heading visible on the rendered page), source date if
   shown, **retrieval date (the day you fetched)**, concise finding. A crawl or fetch
   date is never a release date.
5. Screenshots for the catalog: the catalog needs the *product UI*, not marketing
   pages. If no downloadable product screenshot passes the acceptance gate in
   `research/AGENTS.md`, record `visualStatus: fallback` honestly with the searched
   first-party locations — do not promote marketing art.

## FAIL LOUDLY — this overrides everything else

If ANY retrieval or tool fails, STOP work on that product and report. Never silently
work around it, never convert a tool failure into an `unknown` answer and move on:

- `curl`/`wget` failures (DNS, TLS, 403/bot-wall, timeouts, rate limits).
- `browser-fetch.cjs` exiting non-zero (`BROWSER_FAIL`), blank renders, CAPTCHAs,
  login walls on public pages.
- GitHub API failures or rate limiting (`gh`/API: check `X-RateLimit-Remaining`).
- Missing prerequisites: no `node`, missing playwright-core path, missing
  headless-shell binary, missing `~/.cache/ade-browser-libs`.
- Any page that exists for other products but not this one (suspected bot-wall).

Report = mail the coordinator issue with: product, exact command, exact error output,
what you already tried, what tool/access you need. Then stop that product and wait.
An `unknown` support state is ONLY for "searched genuine first-party locations and
the source says nothing" — with the searched locations recorded. A failed fetch is
an access gap that blocks the product, not an `unknown` answer.
