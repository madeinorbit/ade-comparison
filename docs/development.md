# Development

How to build, test, configure and deploy adecomparison.com. For what the site is, see the [README](../README.md).

A standalone Astro static site for finding and comparing agent development environments. The public origin is https://adecomparison.com. The code and data live at https://github.com/madeinorbit/ade-comparison.

Use Node 22.19 or newer. The app owns its npm lockfile:

```sh
npm ci
npm run build
npm test
npm run check
npm run preview
```

`npm run dev` starts the development server. `npm run build` checks the public data, renders every page and agent file, and copies the reviewed public media bundle into `dist/`. Serve `dist/` on any static host; the production host is Cloudflare Workers static assets (see [Deploy](#deploy)). No analytics, framework runtime, private package or catalog import is part of this app.

For a full browser check, install Chromium once, then run:

```sh
npx playwright install chromium
npm run test:browser
```

A system Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium`. The tests start and stop their own preview server on port 4329, or on `ADE_COMPARISON_TEST_PORT`. They check keyboard controls, source receipts, zero initial layout shift, URL restoration, comparison limits, accessible names and contrast with axe, 320px reflow, and the no-JavaScript fallback.

Run `npm run test:lighthouse` for the mobile Lighthouse gate. It starts a temporary static server with Brotli and gzip, as expected on the production host. An explicit preview URL can also be passed after `--`. Set `CHROME_PATH` if Chromium is not installed in a standard location. The gate requires performance and accessibility scores of 100, zero layout shift and a largest contentful paint below 800ms. Reports are written outside the source tree.

## Public inputs

The content input is `data/`, generated from the research catalog in [`research/`](../research/README.md) by `npm run data:build` (`npm run data:check` verifies that the committed package matches the catalog). The site build never runs that builder and never reads catalog files. `scripts/validate-data.mjs` independently checks exact public field shapes, receipt ownership, bitsets, unknown semantics and valid check dates. Overdue receipts remain available with their original check dates. Refreshing the build does not refresh a finding.

There is one separate input for images: `media/`, containing still screenshots and `index.json`. The index permits only `productId`, `path`, `sourcePage`, `retrievedAt`, `provenance`, `visualStatus`, `width` and `height`. It supports covered products only. Build and tests reject extra metadata such as private manifest notes or reviewer identities. The data exporter can replace `data/` without erasing this bundle.

The explicit preparation commands below run after a catalog change. They are not part of the portable site build:

```sh
ADE_COMPARISON_PUBLICATION_DATE=YYYY-MM-DD npm run data:build   # omit the date to use today
npm run screenshots:import                                     # reads research/screenshots by default; --source <dir> overrides
```

The importer reads the screenshot manifest, accepts reviewed `accepted` records only (catalog fallbacks document a search gap and are skipped), verifies each source digest, review digest and byte length, and writes bounded 960×600 still WebP previews. It strips manifest notes and reviewer metadata. Failed validation preserves the previous bundle. Captions show provenance, retrieval date and source. Images show appearance, not capability.

`npm run test:portable` copies this directory into a temporary directory, installs from its own lockfile, builds with a different origin and an unset public repository, runs the tests, and typechecks it. It then rebuilds the copy with a configured GitHub fixture repository and synthetic lifecycle notices for a covered product and a plain listing, runs the tests again, and checks that all identities remain rendered and that dates, scope and receipt locators survive. This covers both submission modes, including lifecycle receipt links. It removes the copy afterward.

The site needs only `data/`, `media/`, `LICENSE`, `DATA-LICENSE.md` and the lockfile to build. For a fresh data snapshot, rebuild `data/` from `research/`.

## Configuration

`config.mjs` is the only configuration for the domain and public repository:

```sh
ADE_COMPARISON_BASE_URL=https://chosen-domain.example npm run build
ADE_COMPARISON_PUBLIC_REPOSITORY_URL=https://github.com/OWNER/REPO npm run build
```

The default origin is `https://adecomparison.com`. `ADE_COMPARISON_BASE_URL` can override it for previews or portable builds. The public repository is https://github.com/madeinorbit/ade-comparison; both workflows in `.github/workflows/` set `ADE_COMPARISON_PUBLIC_REPOSITORY_URL` to it, so the deployed site shows the submission links. A build without it, such as a local or portable build, hides both GitHub submission links and displays one plain availability sentence on each ADE page and the Method page, with nothing repeated on receipts. The footer always links to the Method correction instructions. A configured destination must be an HTTPS GitHub repository root without credentials, query parameters or a fragment. These values are build-time configuration. `ADE_COMPARISON_AS_OF=YYYY-MM-DD` is available only for reproducing a historical data snapshot in tests; ordinary builds use the current UTC date.

Every ADE page, source receipt and the Method page offers **Report wrong data** and **Suggest a missing ADE** when the repository is configured. These are ordinary links to GitHub issue forms in `.github/ISSUE_TEMPLATE/`, with encoded page and receipt context. A correction also prefills the current product; a missing-ADE suggestion leaves the proposed product blank. Evidence fields stay empty. No submission backend or third-party script is needed. [CONTRIBUTING.md](../CONTRIBUTING.md) explains the public-source rule and how a correction moves through `research/` into `data/`. The forms work while Issues stay enabled and the templates stay on the default branch.

Receipt actions include known filters, lifecycle notices and status-event sources. Unknown cells link to the Method explanation; the product page also offers correction actions. Their correction links preserve the specific receipt or event anchor and work without JavaScript.

## Pages and state

- `/` has requirements, nine presets and instant packed-bitset filtering. All results are rendered into HTML at build time.
- `/matrix/` has sticky row and column headers and differences-only filtering for researched products. Unresearched names remain separate plain listings.
- `/compare/` compares 2 to 4 products, including screenshots and source links. `/compare/<id>-vs-<id>/` pages are generated only when both sides have at least 20 public findings and at least 6 filters typed on both sides. Each holds only its two products; another selection loads `/compare/`.
- `/ade/<id>/` exists for every identity. Covered products have filter and narrative receipts. Other names have no capability claims. A published shutdown notice comes directly under the heading. Plain listings without a notice are `noindex` and stay out of the sitemap.
- `/status/` shows eligible shutdown notices and cited change events, one entry per product and day. Historical events link to current findings; they are not a historical snapshot.
- `/method/` includes the full publisher disclosure, verification meanings, unknowns and research gaps, ranking, source age and correction rules.
- `/llms.txt`, `/products/<id>.json`, `/products/<id>.md`, `/data/*.json` and a copyable prompt support agents. `/products/<id>.json` adds `lifecycleNotice`, so a plain listing still carries its shutdown dates. Every ADE page has its own OG metadata. Researched and noticed products have their own PNG card, plain listings use the site card. Cards are rendered at build time by sharp and need a system font on the build host. The sitemap uses the configured origin.

Finder query parameters are `use`, `must`, `nice`, `q` and `products`. Requirements use typed column keys such as `desktop-os:windows`. Fits confirms every must-have. Fits kind of confirms a strict majority of them. Fits but shutting down contains otherwise qualifying products with published shutdown or acquisition notices. Within each group, products sort by must-haves met, then preferences met, then name. With no must-haves, all researched ADEs appear. Unknown never enters the no bitset or appears as a failed requirement. Products below the threshold remain in name search and Browse all ADEs. Explanations of missing evidence, unknowns and research coverage live on Method. No overall score or vendor-specific tie-break exists.

The phone preset accepts any phone client through the `any-phone-client` requirement. The Parallel local agents preset requires parallel runs and treats other workflow needs as preferences. No preset hides a product. Published shutdown products automatically use the third result group. There is no inclusion toggle. The directory search and ADE pages retain them and their dated notices. A first-party sourced notice is enough to publish before an independent cross-check; the badge is optional additional verification.

Compare uses `products=id,id` and `diff=1`; Matrix accepts any researched product selection. Invalid and duplicate product IDs are ignored. Back and forward restore state. Static hosting cannot render arbitrary query states on the server: without JavaScript, all default Finder listings, ADE receipts, the Matrix and generated pair pages remain readable. The no-JavaScript notice explains that instant controls need JavaScript.

## Design replacement

All presentation lives in `src/styles/tokens.css`, `site.css`, `sheet.css` and `og.css`. There are no component style blocks or inline component styles. Fonts are self-hosted from `public/fonts/` (SIL Open Font License texts beside them), the publisher logo is `public/brand/podium-logo.svg`, and the few short transitions are turned off under `prefers-reduced-motion`. No font, script or asset loads from a third-party origin. Token and CSS replacement can change the final visual direction without rewriting the data or filtering logic. OG cards use the same tokens and `og.css` in a small SVG endpoint.

The site's behavior follows earlier design prototypes for three fit groups, visible gaps, receipt scope and shutdown handling. It does not import the prototypes' data, notices, ranking tie-breaks or styling.

## Deploy

Production runs as a Cloudflare Worker that serves `dist/` as static assets, with no Worker script. `wrangler.jsonc` attaches it to `adecomparison.com` as a Custom Domain, turns off `workers.dev` and preview URLs, and enables Workers Logs. The build writes `dist/_headers` (`scripts/headers.mjs`) with a Content-Security-Policy that allows the inline scripts only by hash, plus HSTS, `nosniff`, frame denial, a referrer policy and a permissions policy. Unknown paths return `404.html` with status 404, and `/page` redirects to `/page/`.

`.github/workflows/deploy.yml` runs on every push to `main`: `data:check`, `research:validate`, `test:research`, build, unit tests, `wrangler deploy`, then `scripts/smoke-production.mjs`, which compares the live pages with the build and checks the headers, the trailing-slash redirect and the 404 page. A manual run on another branch runs the same checks, builds, tests and runs `wrangler deploy --dry-run` without secrets. `.github/workflows/ci.yml` runs the same catalog checks, the build, unit tests and browser tests on every pull request. Third-party actions are pinned to commit SHAs.

The build uploads about 5,850 files. The largest is about 1.6 MB. Cloudflare allows 20,000 files per version on the Free plan, 100,000 on Paid, and 25 MiB per file.

The repository variable `SITE_URL` (`https://adecomparison.com`) tells the smoke check which origin to test. The Cloudflare token is passed only to the `wrangler deploy` step.

Before the first deploy, the owner does these steps once:

1. **Add the domain.** Add `adecomparison.com` to the Cloudflare account as a zone and point the registrar's nameservers to Cloudflare. Remove any existing `A`, `AAAA` or `CNAME` record for the apex; the first deploy creates the Custom Domain record and its certificate.
2. **Create the API token.** In the Cloudflare dashboard, go to **Manage Account > Account API Tokens > Create Token** and use the **Edit Cloudflare Workers** template. Restrict **Account Resources** to this account and **Zone Resources** to `adecomparison.com`. The template includes the two permissions the deploy needs: **Account > Workers Scripts: Edit**, which also creates the Worker on the first deploy, and **Zone > Workers Routes: Edit**, which attaches the Custom Domain.
3. **Create the GitHub environment and secrets.** In the GitHub repository, go to **Settings > Environments > New environment**, name it `production`, limit deployment branches to `main`, and add a required reviewer (a manual **Run workflow** on `main` deploys too). Add two environment secrets there:
   - `CLOUDFLARE_API_TOKEN`: the token from step 2.
   - `CLOUDFLARE_ACCOUNT_ID`: the account ID from the Cloudflare dashboard (**Account home**, or the Workers overview sidebar).
4. **Set `SITE_URL`.** Add a repository variable `SITE_URL` with the live origin (the `workers.dev` address during the interim setup, then `https://adecomparison.com`).
5. **Deploy.** Push to `main`, or run **Actions > Deploy > Run workflow** on `main`.

Optional: to send `www.adecomparison.com` to the apex, add a proxied DNS record `www AAAA 100::` and a redirect rule from the **Redirect from WWW to Root** template under **Rules > Redirect Rules**. This is zone configuration, not part of the Worker.

Check the configuration locally without credentials:

```sh
npm run build
npx wrangler deploy --dry-run
npx wrangler dev   # serves dist/ with the production headers at http://localhost:8787
```

## Verification and launch dependencies

`npm test` requires a fresh build with the same configuration environment. Test files run sequentially so the 16ms filtering check does not compete with file scans and image tests. It gates the total home HTML, CSS and transitive JavaScript payload at less than 50,000 gzip and Brotli bytes, excluding images. It also checks the Dataset, canonical URLs, sitemap, every local link and fragment, per-product OG tags, pair eligibility, neutrality, URL parsing, shutdown grouping, retained overdue receipts, six-month age notes and public-field rejection. Submission tests parse the actual YAML forms, verify required evidence fields and vendor rules, reject unsafe repository settings, and check every ADE page and receipt for the expected links or fallback. The bitset test exercises 300 products with a p95 below 16ms.

The checked-in snapshot carries reviewed notices for Conductor and Jules. Never write notices by hand or copy them from a prototype: they come from the data package. Portable checks also use synthetic fixtures, which stay out of the public data.

Findings and typed values stay published after `nextCheckAt`. The site shows the original checked date and a relative age. Only data checked more than six calendar months ago gets a quiet "may be outdated" note. JavaScript updates ages from those dates when a page opens; the static fallback shows the age at build time. Rebuilding never pretends that evidence was rechecked. Sourced values display normally; cross-checked values may add a small badge. Security, citation, contradiction, digest and interpretation checks still apply.

Code is Apache-2.0. Public JSON is CC BY 4.0. Screenshots retain third-party rights. See the included license files.
