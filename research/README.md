# ADE research catalog

This directory holds the full research behind adecomparison.com: the product register, the shared rubric, one research file per product with its evidence ledger and change history, the typed filter mappings, and the screenshot originals. `data/` at the repository root is generated from it. Counts change with every research pass, so read them from the files (or from `data/index.json`) rather than from this page.

Agents read `registry.json`, `criteria.json` and `products/<id>.json`. `registry.json` lists every known identity and its category; the [qualification reports](qualification-2026-11.md) give the first-party evidence behind each category. A full profile with 51 criterion rows can still be queued or mostly unknown.

The [screenshot library](screenshots/manifest.json) contains one sourced product view for every full-profile tool. Images live at `screenshots/<product-id>/home.<extension>`. The manifest records the page, direct asset URL, retrieval date, visible surface, task coverage, visual status and file digest. Visual review is bound to those digests, so replacing any image invalidates the review. Full validation rejects missing, changed or unregistered images and undocumented visual fallbacks.

```sh
node research/validate.mjs
node --test research/schema.test.mjs research/screenshot-library.test.mjs research/screenshots/contract.test.mjs
node --test research/publication/publication.test.mjs
node research/directory/build.mjs
node research/directory/build.mjs --check
node --test research/publication/directory.test.mjs
```

The same checks run through `npm run research:validate`, `npm run test:research`, `npm run data:build` and `npm run data:check`. Set `ADE_COMPARISON_PUBLICATION_DATE=YYYY-MM-DD` to rebuild a snapshot for a fixed date; without it the build uses today's UTC date. Use Node 22+ or Bun. No dependency installation is needed for the catalog itself.

Each claim has a stable product/criterion ID, atomic answers, scope, dates, evidence references, gaps and review state. Support states belong to the atomic answers. The criterion-level `support` field only marks a record as answered or unknown; it is not a quality score and is not published. Evidence distinguishes vendor claims, documentation, inspected code and observed tests. A source-only implementation is not proof of a released feature. An unknown is never a negative finding.

Use atomic support states for capability questions. The dated [review record](notes/review.json) gives claim-level cross-check coverage, roadmap scan coverage, unresolved contradictions and remaining hands-on work as of its date.

Researchers own separate product files. A different reviewer checks the evidence before facts become `public-reviewed`. Each full-profile pass also maintains its real product screenshot and provenance record. Changes append dated before/after records. Run validation before rebuilding. Details, screenshot selection rules and freshness requirements are in [AGENTS.md](AGENTS.md); the judgment rubric and evidence rules are in [comparison-framework.md](comparison-framework.md).

Cross-checks are done by agents working for the publisher. A human audit of a sample from each research batch, with a published error rate, is planned and not yet in place. Agent claim cross-checks do not complete hands-on recovery, multiplayer, fleet or shipping scenarios. The product files, rather than a page build date, record what was checked and when.

## Research depth and Podium

Podium's makers publish this catalog and have full access to Podium's source code, so `products/podium.json` cites more inspected source code than most other profiles. Every product uses the same 51 criteria, the same typed filters and the same source rule: a first-party source, meaning the product's own site, documentation, release notes or public repository code, can establish a value. Some of Podium's published values rest only on its public source code, as values of other open-source products do. The Finder ranks by confirmed answers to the requirements a reader picks, then by name. Deeper research can confirm more answers, so research depth can affect order. The number of sources behind a single answer does not.

## Publication

The [publication contract](publication/README.md) turns eligible findings into public records. It publishes fresh sourced candidates and independently reviewed findings with different labels, and leaves out internal-only claims, non-public evidence, change prose and review identities. Its pair-page format is not used by adecomparison.com.

The [adecomparison.com directory contract](directory/README.md) adds typed filters and the generated JSON package at `data/`. Mappings cite eligible public findings and evidence, expire with their receipts and carry separate digest-bound review state. The package holds covered products plus plain register listings, a compact bitset index, public change events, lifecycle notices, methodology and the publisher disclosure. Its build and on-disk security check reject fields outside the public allowlist. The site code reads this package alone.
