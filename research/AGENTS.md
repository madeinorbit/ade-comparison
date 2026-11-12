# ADE research catalog

This catalog follows the approved 51-criterion framework in [comparison-framework.md](comparison-framework.md). Apply the same evidence requirements to every product, including Podium, whose makers publish this catalog. Product categories describe workflows, not quality.

## Read and update

- Read `criteria.json` for IDs, full judgment text and frozen atomic questions. Each subquestion names one part of its criterion; the full judgment defines how to test and interpret it. Do not invent keys or change their meaning in a product profile. Rubric changes apply to every full profile.
- Canonical product records live in `products/<id>.json`. Each file owns its inline evidence ledger and change history. `schema.json` describes the structure; `validate.mjs` also enforces evidence, coverage and publication rules.
- Use `createUnknownProfile(metadata, options)` and `updateClaim(profile, criterionId, patch)` from `lib.mjs` when useful. Helpers keep unsourced questions unknown. Update only questions the source establishes.
- Full profiles must contain all 51 criterion records and every declared atomic answer. Empty qualification or watch records are valid. Coverage does not mean research is complete. `queued` means not investigated; `researching` means underway; `documented` means the assigned source pass is finished with gaps recorded; `reviewed` means another researcher checked its evidence and gaps for every sourced claim. Cross-check coverage is recorded on each claim, and a profile stays `documented` while any sourced claim awaits one.
- Scope findings to named product clients, plans, release/commit, operating systems and execution mode. A browser client, desktop app, underlying coding harness and managed runtime can have different capabilities. Preserve those differences in answers and scope.

## Evidence and review

Use first-party pages and code wherever possible. Record URL, title, locator, source date if known, retrieval date and a concise finding. Never treat a crawl date as a release date. A source URL is `https://...`, `http://...` or an explicitly non-public `internal-file:repo-relative/path`, which can never support a published finding. Do not copy whole sources.

At every source pass, check the product's official roadmap if one exists, changelog or release notes, relevant documentation and public repository issues. Record the dated search in `context.roadmapReview`: locations checked with URLs and results, cited announced changes with their criterion IDs, and access or search gaps. An empty announcement list only says that this pass found none in the recorded locations. Keep future plans out of current capability answers. Use `availability: announced` only for a dated, cited public announcement, and never treat it as a shipped feature. A roadmap change or release triggers an earlier freshness check for affected claims.
The validator requires this record before a full profile can be `documented` or `reviewed`.

Use `roadmapReview: { checkedAt, locations, announced, gaps }`. Each location has `{ url, result }`; use `url: null` when the location is inaccessible and name it in `result` and `gaps`. Each announcement has `{ criterionId, summary, sourceDate, targetDate, evidenceIds }`, with null dates when the source gives none. Cite an evidence-ledger ID for every announcement. Do not use an empty `locations` and `gaps` pair to imply a search happened.

Code inspection needs a pinned commit and file path, plus a locator and an explanation linking the code to an accessible feature. `source-inspected` describes inspected implementation, not a README claim. An observation needs method, configuration, fixture and result. A documentation or source check does not imply a successful hands-on test.

Every supported, partial or unsupported answer needs cited evidence. Unsupported requires an explicit restriction, a bounded test of the scoped release, or a complete first-party list that omits the option, as defined in the framework; missing search results remain unknown. Give unknowns a search/access gap in the answer and `unknownReason`. Partial results name the limitation. Reviewer acceptance is required for not-applicable. Keep contradictions visible.

Read atomic answers when judging a capability. A partly established criterion summary is not proof that all its parts work or that its unknown parts are missing. The criterion-level `support` field only marks a record as answered or unknown: set `partial` for any answered record that has an unknown or limited part. It is not a rating and is not exported to `data/`.

Keep observations separate from interpretation in the answer. Use dated product/company context for stars, X followers and funding, with its own source and uncertainty. Popularity and funding are not capability scores. Personal testing anecdotes without known date/configuration are leads only.

Research agents leave candidate public facts at `public-candidate` and internal facts at `internal-only`. A different reviewer can set `public-reviewed` only after checking source sufficiency, wording, scope and dates. That state requires public evidence and no unresolved contradiction. A non-public source alone never qualifies, for any product. A review state is permission to cite a fact, not permission to publish a page.

Record claim reviews as `{ reviewer, date, contentHash: claimReviewHash(profile, claim) }` using `lib.mjs` after checking the final claim and every row or atomic citation. The digest binds factual fields, scope, check and due dates, researcher identity and cited evidence. Direct factual or evidence edits invalidate the review. Clear it and return the claim to `public-candidate` or `internal-only` before obtaining another independent review; never regenerate a digest to carry an old review across changed content.

## Screenshot research contract

Every full-profile product must have one real product screenshot at `screenshots/<product-id>/home.<extension>` and one matching entry in `screenshots/manifest.json`. Qualification and watch records do not require an image. A source pass is complete only when the downloaded pixels, provenance and digest-bound visual review all validate.

Each product shows its primary work view: the surface where a user runs and follows agent work, not a settings, automation, marketing or social-card surface. The same view rule and preference ranking apply to every product, including the publisher's own. Record the chosen surface and the reason for it in that product's manifest note.

Apply this acceptance gate before ranking candidates. The image must show a readable, real product interface with meaningful work. Reject promotional headline or logo overlays, device montages, perspective mockups, conceptual UI cards, isolated widgets, and empty onboarding or composer views. First-party ownership is a source preference, not a quality exemption. Plain vendor background padding is acceptable only when the complete interface remains unobstructed and readable. Vendor sample data in a real interface is allowed when the note labels it; drawn or recreated UI is not.

Among images that pass the gate, prefer, in order: a populated default home or overview with chat; a populated board, inbox or task list; an active workspace with a work list; then a single active task as a documented fallback. Task-state variety breaks ties but never justifies the wrong product area. `several-tasks` means at least two distinct visible work items. `multiple-states` means at least two items with at least two unambiguous visible states.

Use first-party marketing, documentation, release or repository assets. A third-party mirror is allowed only when no downloadable first-party image can be found. If no candidate passes the acceptance gate, keep the best real product fallback only when the manifest records `visualStatus: fallback`, the rejected limitation and the first-party locations searched. Do not describe a fallback as accepted coverage; future passes must continue the search.

Open and inspect the downloaded image itself. Do not infer quality from its filename, page copy or metadata. Record the visible navigation or view title and at least two named work items or state labels in the note when they exist. Store the unmodified source image at its original resolution and aspect ratio. Do not generate, recreate, beautify or crop it. Redact only secrets or private customer data and record the redaction.

For each image, record the exact presenting page, direct asset URL, retrieval date, provenance, visible view type, task-state coverage, visual status, limitations, file size and SHA-256 digest. The manifest's visual review must be bound to the reviewed image digests; any replacement invalidates that review until the new pixels are inspected. Mechanical byte and provenance validation does not establish visual acceptance. Screenshots are appearance and workflow-context evidence only and do not prove that a capability works. Run full validation after every replacement.

## Changes and freshness

Append a concise change record with date, author, reason, affected claim IDs and evidence. Later changes also record before/after values. Use `product-change`, `research-correction`, `rubric-change` or `freshness-recheck`; first evidence collection uses `initial-research`. Preserve earlier reasons in Git and change records.

Changing a factual answer, its scope or its evidence invalidates the previous review. Reset affected claims to `public-candidate` or `internal-only` with `review: null`, then obtain another independent review. `updateClaim` resets review on factual patches unless the caller explicitly supplies a new review; direct JSON or evidence-ledger edits must do the same.
After a research batch, regenerate `notes/review.json` with `node research/notes/review-summary.mjs` so its coverage counts, unresolved IDs and data hash describe the current catalog. Do not hand-edit it. Never use a page build date as a source-check date.

Set `nextReviewAt`: ordinarily at most 14 days for price, availability and fast-moving claims; 30 days for normal capabilities; 90 days for stable architecture/licenses. Recheck sooner after relevant releases or corrections. A working URL alone does not refresh a claim. Review due dates before using public facts. `validateProfile(profile, { publicationDate: 'YYYY-MM-DD' })` rejects expired public facts for a publishing check.

Agent-readable comparisons use the separate generated publication contract in `publication/README.md`. They may expose only the export from `publication/build.mjs`; never import raw product profiles into a site route. Sourced candidates may appear before independent review, but the page must label them as awaiting review and keep them distinct from independently reviewed findings. The all-pairs page format is kept with its tests and is not rendered by adecomparison.com. Never hand-edit a generated factual row.

adecomparison.com uses the [directory contract](directory/README.md) for typed filters and the generated package in `data/`. Author capability mappings only from eligible `buildPublication({ format: 'products' })` findings and their namespaced citations. Every non-unknown mapping needs a matching `facetReviewHash`; source or interpretation changes make it unknown until rechecked. A catalog claim review does not cross-check the typed mapping. A different agent must accept a separate digest-bound facet review. Lifecycle status projects the already typed `publicLifecycle` notice and reuses its independent digest-bound review, including for products without capability coverage. Unknown never becomes no, and an absent lifecycle notice never means active. Public evidence contains a finding and locator, not necessarily a verbatim quote. Keep register product files to identity-only listings when they lack capability mappings; public lifecycle receipts live separately. Site code consumes the generated JSON and never imports catalog files. Rebuild and scan this package before each site build; never hand-edit its factual output.

## Checks

From the repository root:

```sh
node research/validate.mjs
node --test research/schema.test.mjs research/screenshot-library.test.mjs research/screenshots/contract.test.mjs
node --test research/publication/publication.test.mjs
node research/directory/build.mjs
node research/directory/build.mjs --check
node --test research/publication/directory.test.mjs
```

Pass product paths to `validate.mjs` to validate a research batch. These scripts are dependency-free and also run with Bun. No running server is required.

## Product lifecycle

Use the optional top-level `lifecycle` contract in `publication/README.md` for sourced sunset notices. Omission means unknown, never active. Keep the company or hosted-service scope separate from local open-source continuation and capability support. A lifecycle change does not rewrite feature answers. Unknown shutdown dates stay null; relative wind-down wording does not establish an exact deadline or a hands-on result.

Research leaves a lifecycle notice `public-candidate` with `review: null`. Public lifecycle notices require an independent review, fresh resolved public evidence and no contradictions. After checking the wording, scope, continuation and dates, record `review.contentHash` using `lifecycleReviewHash(profile)` from `lib.mjs`. Factual or cited-evidence edits invalidate that review; `updateLifecycle` clears it on factual patches. Record lifecycle changes in history with an empty `claimIds` array and the relevant evidence. Human and agent exports must use `publicLifecycle(profile, date)` and include its evidence references in source selection. Candidate capability findings may publish under their existing rules; lifecycle candidates do not publish.
