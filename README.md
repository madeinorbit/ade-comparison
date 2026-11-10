# ade-comparison.com

A standalone Astro static site for finding and comparing agent development environments. The public origin is https://ade-comparison.com. The site has neutral CSS tokens until the owner chooses a design.

Use Node 22.19 or newer. This app is excluded from the root Bun workspace and owns its own npm lockfile. From this directory, without the surrounding monorepo:

```sh
npm ci
npm run build
npm test
npm run check
npm run preview
```

`npm run dev` starts the development server. `npm run build` checks the public data, renders every page and agent file, and copies the reviewed public media bundle into `dist/`. Serve `dist/` on any static host. No deployment, analytics, framework runtime, private package or catalog import is part of this app.

For a full browser check, install Chromium once, then run:

```sh
npx playwright install chromium
npm run test:browser
```

A system Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium`. The tests start and stop their own preview server on port 4329, or on `ADE_COMPARISON_TEST_PORT`. They check keyboard controls, source receipts, zero initial layout shift, URL restoration, comparison limits, accessible names and contrast with axe, 320px reflow, and the no-JavaScript fallback.

Run `npm run test:lighthouse` for the mobile Lighthouse gate. It starts a temporary static server with Brotli and gzip, as expected on the production host. An explicit preview URL can also be passed after `--`. Set `CHROME_PATH` if Chromium is not installed in a standard location. The gate requires performance and accessibility scores of 100, zero layout shift and a largest contentful paint below 800ms. Reports are written outside the source tree.

## Public inputs

The content input is `data/`, generated through the private publication boundary before it is delivered here. The app never invokes that boundary and never reads catalog files. `scripts/validate-data.mjs` independently checks exact public field shapes, receipt ownership, bitsets, unknown semantics and valid check dates. Overdue receipts remain available with their original check dates. Refreshing the build does not refresh a finding.

There is one separate input for images: `media/`, containing still screenshots and `index.json`. The index permits only `productId`, `path`, `sourcePage`, `retrievedAt`, `provenance`, `visualStatus`, `width` and `height`. It supports covered products only. Build and tests reject extra metadata such as private manifest notes or reviewer identities. The data exporter can replace `data/` without erasing this bundle.

The explicit preparation command below runs only in the private research repository, after a public-data refresh. It is not part of the portable site build:

```sh
npm run screenshots:import -- --source /absolute/path/to/catalog/competitive-intelligence/screenshots
```

The importer reads the screenshot manifest, accepts reviewed `accepted` and `fallback` records only, verifies each source digest, review digest and byte length, and writes bounded 960×600 still WebP previews. It strips private metadata. Failed validation preserves the previous bundle. Captions show provenance, fallback state, retrieval date and source. Images show appearance, not capability.

`npm run test:portable` copies this directory into a temporary directory, installs from its own lockfile, builds with a different origin and an unset public repository, runs the tests, and typechecks it. It then rebuilds the copy with a configured GitHub fixture repository and synthetic lifecycle notices for a covered product and a plain listing, runs the tests again, and checks that all identities remain rendered and that dates, scope and receipt locators survive. This covers both submission modes, including lifecycle receipt links. It removes the copy afterward.

When moving this app into a public repository, copy the whole directory with `data/`, `media/`, `LICENSE`, `DATA-LICENSE.md` and the lockfile. Run `npm ci` in that directory. Nothing needs the monorepo to build. For a fresh data snapshot, import a new sanitized package from its publisher.

## Configuration

`config.mjs` is the only configuration for the domain and public repository:

```sh
ADE_COMPARISON_BASE_URL=https://chosen-domain.example npm run build
ADE_COMPARISON_PUBLIC_REPOSITORY_URL=https://github.com/OWNER/REPO npm run build
```

The default origin is `https://ade-comparison.com`. `ADE_COMPARISON_BASE_URL` can override it for previews or portable builds. The public repository is undecided. Leave `ADE_COMPARISON_PUBLIC_REPOSITORY_URL` unset until it exists; the site then hides both GitHub submission links and displays one plain availability sentence on each ADE page and the Method page, with nothing repeated on receipts. The footer always links to the Method correction instructions. A configured destination must be an HTTPS GitHub repository root without credentials, query parameters or a fragment. These values are build-time configuration. `ADE_COMPARISON_AS_OF=YYYY-MM-DD` is available only for reproducing a historical data snapshot in tests; ordinary builds use the current UTC date.

Every ADE page, source receipt and the Method page offers **Report wrong data** and **Suggest a missing ADE** when the repository is configured. These are ordinary links to GitHub issue forms in `.github/ISSUE_TEMPLATE/`, with encoded page and receipt context. A correction also prefills the current product; a missing-ADE suggestion leaves the proposed product blank. Evidence fields stay empty. No submission backend or third-party script is needed. [CONTRIBUTING.md](CONTRIBUTING.md) explains the public-source rule and the private-catalog review and export process. Copy the templates to the root of the future public repository, enable Issues and keep them on its default branch.

Receipt actions include known filters, lifecycle notices and status-event sources. Unknown cells link to the Method explanation; the product page also offers correction actions. Their correction links preserve the specific receipt or event anchor and work without JavaScript.

## Pages and state

- `/` has requirements, eight presets and instant packed-bitset filtering. All results are rendered into HTML at build time.
- `/matrix/` has sticky row and column headers and differences-only filtering for researched products. Unresearched names remain separate plain listings.
- `/compare/` compares 2 to 4 products, including screenshots and source links. `/compare/<id>-vs-<id>/` pages are generated only when both sides have at least 20 public findings and at least 6 filters typed on both sides. Each holds only its two products; another selection loads `/compare/`.
- `/ade/<id>/` exists for every identity. Covered products have filter and narrative receipts. Other names have no capability claims. A published shutdown notice comes directly under the heading. Plain listings without a notice are `noindex` and stay out of the sitemap.
- `/status/` shows eligible shutdown notices and cited change events, one entry per product and day. Historical events link to current findings; they are not a historical snapshot.
- `/method/` includes the full publisher disclosure, verification meanings, unknowns and research gaps, ranking, source age and correction rules.
- `/llms.txt`, `/products/<id>.json`, `/products/<id>.md`, `/data/*.json` and a copyable prompt support agents. `/products/<id>.json` adds `lifecycleNotice`, so a plain listing still carries its shutdown dates. Every ADE page has its own OG metadata. Researched and noticed products have their own PNG card, plain listings use the site card. Cards are rendered at build time by sharp and need a system font on the build host. The sitemap uses the configured origin.

Finder query parameters are `use`, `must`, `nice`, `q` and `products`. Requirements use typed column keys such as `desktop-os:windows`. Fits confirms every must-have. Fits kind of confirms a strict majority of them. Fits but shutting down contains otherwise qualifying products with published shutdown or acquisition notices. Within each group, products sort by must-haves met, then preferences met, then name. With no must-haves, all researched ADEs appear. Unknown never enters the no bitset or appears as a failed requirement. Products below the threshold remain in name search and Browse all ADEs. Explanations of missing evidence, unknowns and research coverage live on Method. No overall score or vendor-specific tie-break exists.

The phone preset accepts any phone client through the `any-phone-client` requirement. The Leaving Conductor preset requires parallel runs and treats other workflow needs as preferences. Conductor remains the baseline and stays out of those matching results. Search still finds it. Published shutdown products automatically use the third result group. There is no inclusion toggle. The directory search and ADE pages retain them and their dated notices. A first-party sourced notice is enough to publish before an independent cross-check; the badge is optional additional verification.

Compare uses `products=id,id` and `diff=1`; Matrix accepts any researched product selection. Invalid and duplicate product IDs are ignored. Back and forward restore state. Static hosting cannot render arbitrary query states on the server: without JavaScript, all default Finder listings, ADE receipts, the Matrix and generated pair pages remain readable. The no-JavaScript notice explains that instant controls need JavaScript.

## Design replacement

All presentation lives in `src/styles/tokens.css` , `site.css` and `og.css`. There are no component style blocks, inline component styles, external fonts, decorative assets or motion. Token and CSS replacement can change the final visual direction without rewriting the data or filtering logic. OG cards use the same tokens and `og.css` in a small SVG endpoint.

The behavior reference is `docs/design/ade-comparison-directions` in the private repository. The site reuses the three fit groups, visible gaps, receipt scope and shutdown handling as concepts. It does not import the prototypes' data, notices, ranking tie-breaks or styling.

## Verification and launch dependencies

`npm test` requires a fresh build with the same configuration environment. Test files run sequentially so the 16ms filtering check does not compete with file scans and image tests. It gates the total home HTML, CSS and transitive JavaScript payload at less than 50,000 gzip and Brotli bytes, excluding images. It also checks the Dataset, canonical URLs, sitemap, every local link and fragment, per-product OG tags, pair eligibility, neutrality, URL parsing, shutdown grouping, retained overdue receipts, six-month age notes and public-field rejection. Submission tests parse the actual YAML forms, verify required evidence fields and vendor rules, reject unsafe repository settings, and check every ADE page and receipt for the expected links or fallback. The bitset test exercises 300 products with a p95 below 16ms.

The checked-in snapshot carries reviewed notices for Conductor and Jules. Never write notices by hand or copy them from a prototype: they come from the data package. Portable checks also use synthetic fixtures, which stay out of the public data.

Findings and typed values stay published after `nextCheckAt`. The site shows the original checked date and a relative age. Only data checked more than six calendar months ago gets a quiet "may be outdated" note. JavaScript updates ages from those dates when a page opens; the static fallback shows the age at build time. Rebuilding never pretends that evidence was rechecked. Sourced values display normally; cross-checked values may add a small badge. Security, citation, contradiction, digest and interpretation checks still apply.

Code is Apache-2.0. Public JSON is CC BY 4.0. Screenshots retain third-party rights. See the included license files. Publication and final design remain owner decisions.
