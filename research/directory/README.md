# ADE comparison public data contract

This channel turns eligible catalog findings into typed finder filters and a portable JSON package at `data/`. The public site is https://adecomparison.com. The [publication contract](../publication/README.md) still controls evidence, scope, dates and disclosure.

The directory builder consumes `buildPublication({ format: 'products', directory: true })`. It never reads product profiles or the register directly. The publication builder alone reads those inputs and returns public records. The directory option retains findings after their scheduled recheck and permits sourced first-party lifecycle notices. All other evidence, scope, contradiction and digest checks remain. The default publication contract, including the unused pair format, keeps its existing expiry and lifecycle review rules; the directory option cannot be used for pair exports. Site code reads generated JSON only. It must not import the directory builder or catalog helpers.

## Filters and receipts

`facets.json` defines 26 filters. A `tri-state` has `yes`, `no` or `unknown`. An `enum` has one declared option or `unknown`. An enum with `multiple: true` has a separate tri-state receipt for each option. This allows Windows to be unknown while macOS is yes. A missing mapping never implies no. A negative value needs an explicit sourced restriction, a bounded source inspection or a complete first-party list that omits the option, just like a negative catalog finding.

The definitions cover desktop OS, web and phone clients, CLI, coding agents, subscription reuse, execution location, isolation, concurrency, coordination, issues, triggers, shared prompting, roles, SSO, pull requests, review UI, license, self-hosting, telemetry controls, free access, starting price, pricing model, paid-plan price, lifecycle and laptop-independent execution. Their descriptions define the thresholds. A model provider is not a coding harness, a worktree is not a security sandbox, and a self-managed worker is not a self-hosted control plane. The starting-price options are public monthly USD brackets for the ADE alone. They exclude model and own-compute charges and do not convert currencies or annual prices.

The `paid-from` option `no-paid-plan` records an established absence of a paid ADE tier. It uses the same evidence threshold as `pricing-model:no-paid-plan`: the ADE is free and the checked first-party sources establish no paid tier. A free plan alongside paid plans does not qualify. Separate agent, model or compute charges do not create a paid ADE plan. Missing pricing evidence stays unknown, and contact sales requires an established paid offering. No paid plan does not match the paid-plan budget filters. Adding this single-choice option invalidates every paid-price digest; recheck each mapping against its eligible finding, clear its independent review and bind it to the revised definition. Preserve source check dates when reinterpreting existing findings.

The license facet distinguishes GPL-3.0 and AGPL-3.0 from their explicit `-or-later` variants. The base version-3 options include findings that say version 3 without granting later versions, including explicit `-only` findings. Preserve that exact wording and any component or hosted-service exceptions in the receipt. The open-source preset accepts Apache-2.0, MIT and all four listed copyleft options; Elastic License 2.0, Custom terms, Proprietary and unknown remain outside that selection. Adding options changes the definition digest for every license mapping. Recheck each interpretation, clear its review and bind it to the revised definition before rebuilding. A separate independent facet review is still required.

A multi-select filter can gain an option without clearing existing mappings. Each option has its own tri-state receipt, so a new option does not change what an existing one means. Mark the new option with `addedAt: 'YYYY-MM-DD'`; `facetReviewHash` leaves it out of the digest for mappings checked before that date, and a mapping checked on or after it binds the whole revised definition. The new option starts unknown for every product. Single-choice filters may not use `addedAt`, because a new choice can change an existing answer. `agents` gained `antigravity` this way on 2026-11-10.

Custom terms means vendor-authored terms. An established standard license outside the declared options stays unknown until the facet can represent it.

`products/<id>.json` in this directory holds the authored mappings for each covered product. The builder accepts additional products through the same contract, with no fixed product allowlist. Every covered product receives the same pass against all filter definitions; evidence gaps remain unknown rather than forcing equal known-value counts. Missing mappings generate unknown. A capability mapping contains:

```ts
type PrivateMapping<Value extends string> = {
  value: Exclude<Value, 'unknown'>
  claimId: string
  evidenceIds: string[]
  checkedAt: string
  rationale: string
  researcher: string
  contentHash: string
  review: null | {
    state: 'accepted' | 'changes-requested'
    reviewer: string
    date: string
    contentHash: string
    note?: string
  }
}
```

The definition constrains `value`; it cannot be arbitrary text. A non-unknown mapping names one eligible finding and one or more namespaced evidence IDs cited by that finding, including its atomic answers. Evidence cited only by a different finding or product cannot support it. Announcements cannot establish any filter value. A removed or private-preview finding can only support `no`. A `yes` cannot rest on an `unsupported` finding, and a `no` cannot rest on a `supported` one. At least one cited source must have a retrieval date on or after the finding's `checkedAt`, so a recheck of other sources cannot freshen this value.

### Interpretation rules applied to every product

- **Unreleased platforms and clients.** When a first-party source explicitly says a client or platform is planned, coming soon, waitlisted, or in a private or invitation-only beta that is not publicly distributed, the option maps to `no`, citing that source. A public beta or a public TestFlight that anyone can join counts as available. A platform the sources simply do not mention stays unknown, unless the next rule applies.
- **Complete first-party lists.** When a current first-party source presents itself as the full list for one closed dimension, the options it omits map to `no`, citing that source. A download page that offers only macOS builds makes Windows and Linux `no`. A pricing page that lists every plan makes an absent pricing model `no`. The mapping's rationale names the list and says it omits the option. This covers `desktop-os`, `phone-client`, `execution`, `pricing-model` and, where a product has no generic adapter and states its supported agents as a fixed list, `agents`. A README that mentions one platform in passing, an example or a "such as" list is not complete. A first-party source that disagrees keeps the value unknown. Capability filters such as `coordinator`, `issue-tracking` or `multiplayer` never get `no` from silence.
- **Coordinator.** The facet asks whether a product-owned agent can delegate work to other agents and inspect or communicate with them. "Product-owned" means the product supplies the coordinator role and its delegation tools. The product designates a coordinator session, either its own agent or a third-party coding-agent CLI that the product starts or instructs through a skill, MCP server, CLI or prompt it ships. Tools shipped by the product then let that coordinator delegate work to other agent sessions, either by starting them or by assigning work to sessions already running, and inspect or message them. This follows the definition, which asks for delegation, not for starting sessions. Whoever builds the underlying model loop does not matter. These do not count: a harness's own subagent feature that the product only displays, and orchestration that a user assembles from generic commands without a product-supplied coordinator role. The shared availability gate applies. Beta and experimental features count when a user can turn them on in the scoped release. A feature that cannot currently be enabled, such as one whose switch the product's documentation marks as unavailable, cannot support `yes`.

Lifecycle is a direct projection of the already typed `publicLifecycle.status`. It copies the lifecycle gate's verification status. A sourced candidate needs a public first-party announcement on the product website or repository; it receives no cross-check badge. An independently reviewed notice must retain its valid digest, so an evidence edit invalidates its review at that gate. It adds no interpretation and needs no second mapping review. Do not author parallel `lifecycle-status` mappings. Generated lifecycle receipts use the reserved claim ID `<product-id>:lifecycle` and the notice's evidence. That ID never resolves for an authored mapping, so a lifecycle notice cannot support a capability filter. An absent, private, contradicted or otherwise ineligible notice remains unknown, never active. Overdue notices stay published. Sourced notices use `crossCheckedAt: null`; independently reviewed notices keep their cross-check date. This projection covers every eligible listed product, including products without capability mappings.

`facetReviewHash(product, facetId, option, entry, definition)` in [facets.mjs](facets.mjs) hashes the definition, typed mapping, public finding and cited evidence. It includes source wording, locators, dates, URLs, scope and the mapping researcher. It excludes `contentHash` and `review`. Object-key reformatting does not change the digest. Use `null` for `option` on scalar filters. Set `entry.contentHash` only after checking that the cited public finding establishes this exact value. A changed definition, finding, source or mapping invalidates the digest and produces unknown until a new source pass records the revised mapping. Do not blindly regenerate hashes after a catalog refresh.

Mapping checks cannot predate their finding's check or follow the build date. Passing `nextCheckAt` never removes a finding, a typed value or its citations. The original `checkedAt` and scheduled recheck date remain in the package. The site shows a plain age such as 'checked 3 weeks ago'; only checks more than six calendar months old get a quiet 'may be outdated' note. A rebuild never extends a source or mapping check. Source, scope, contradiction, digest or interpretation changes can still remove values.

A digest-valid capability mapping starts as `sourced`, even when its catalog finding was cross-checked. A different agent must separately check the typed interpretation, scope, citations and dates at the source, then record an accepted review with the same digest. A mapping counts as `agent-cross-checked` only when both its public finding and its own review pass. A missing, self-authored, future-dated or outdated review cannot add that label. A `changes-requested` review with the current digest makes the value unknown until a revision changes the digest. Put the reason in its private `note`. A review of a mapping whose own `contentHash` is stale records the current digest, so the rejection binds to the finding the reviewer read. Reviewer and researcher identities, rationale, notes, review workflow and hashes never enter the public package.

### Source rechecks through the authoring helper

Run `node research/directory/author.mjs apply <spec.json>` to apply a source pass. When rechecking an existing finding, put explicit dates in its claim patch, alongside the evidence IDs and atomic answers established by that pass:

```json
{
  "claims": {
    "OWN-02": {
      "checkedAt": "2026-11-13",
      "nextReviewAt": "2026-12-13",
      "evidenceIds": ["hosting-recheck"]
    }
  }
}
```

`checkedAt` must be a real calendar date on or before the pass date. An answered finding needs a cited, resolved public source retrieved on or after that check date. New evidence accepts `retrievedAt`, defaulting to the pass date; it cannot follow the pass date, and `sourceDate` cannot follow retrieval. Record a new evidence entry for a source recheck and keep older entries' dates and atomic citation scope.

`nextReviewAt` must be a real calendar date on or after `checkedAt`. If omitted on a recheck, it defaults to the helper's criterion review interval from `checkedAt`. An existing answered finding requires explicit `checkedAt` to change its deadline. Without either date, an existing finding keeps both dates, even when the pass adds an atomic answer or a mapping. Previously unknown findings still default to the pass date and criterion interval.

The helper clears the changed claim's independent review and leaves untouched atomic answers and citations intact. A mapping must cite a source retrieved on or after the finding's check date; a new date on another atomic answer cannot refresh an older citation. Rebind only mappings checked against the revised finding. Validation finishes before either product file is written. Building the package never advances these dates.

Public scalar cells have this shape; an enum set maps each option ID to one such cell:

```ts
type Cell<Value extends string> = {
  value: Value | 'unknown'
  verificationStatus: 'sourced' | 'agent-cross-checked' | 'unknown'
  claimId: string | null
  evidenceIds: string[]
  checkedAt: string | null
  crossCheckedAt: string | null
  nextCheckAt: string | null
}
```

An unknown cell has null references and dates and an empty evidence list. Resolve a known cell's `claimId` in the product's `claims` for its wording, plan, client, version, limitations and check dates. A public claim carries support states on its atomic `questions` only. The catalog's criterion-level support marker is not exported. Resolve `evidenceIds` in `sources` for the public URL, retrieval date, finding and locator. The `finding` field can summarize a source. It is not a promised verbatim quote. Never rename it to `quote` or put quotation marks around it as though the source said those exact words.

## Generated files

| File | Contents |
| --- | --- |
| `index.json` | Compact product identities and filter bitsets. |
| `products/<id>.json` | One record for every register identity. Covered records contain public claims, sources, lifecycle and facet receipts. |
| `facets.json` | The typed definitions, copied verbatim. |
| `status-log.json` | Current eligible change events with date, type, product ID, claim IDs and evidence IDs. |
| `lifecycle-notices.json` | Eligible scoped notices for every full-profile product, including continuation, stated dates and public sources. |
| `methodology.json` | Rubric version, verification meanings, freshness constants, limitations, ranking rules and publisher disclosure. |

A covered record may add `githubStars: { value, observedAt, evidenceIds }` from the profile's `context.marketContext.githubStars`. It is exported only when every cited source is public, retrieved by the build date and points at the product's own repository (`github.com/<owner>/<repo>` or `api.github.com/repos/<owner>/<repo>`, matching `identity.repository`). Those sources join the record's `sources`. A missing count is not zero. Stars measure repository attention, not users or capability; the site offers them as an optional order, never as a score.

Other register product files contain exactly `id`, `name`, `website` and `researchStatus: 'not-researched'`. A missing website is null. The publication boundary selects only the first register source URL as the listing website. It does not export `scopeNote`, category, origin, profile metadata or any claim. Their capability filter bits remain unknown. A published first-party lifecycle notice appears in `lifecycle-notices.json` with its own sources and a `facet` receipt even when the product has no capability coverage. Resolve lifecycle index bits through that notice; the plain product file still contains no claims.

The index sorts every product by name, with ID breaking ties. Its bitsets use base64 bytes, the first row in the least significant bit of byte zero. `bitsets.columns` uses a scalar tri-state filter ID or `<facet-id>:<option-id>`. Each column has `yes`, `no` and `crossChecked` bitsets. Unknown has neither yes nor no set. On scalar enums a known choice sets yes for that choice and no for the other choices; an unknown choice sets neither for every option. `crossChecked` describes verification, not whether a requirement matches. There is no overall score or publisher-specific order. Finder uses Fits for all must-haves confirmed, Fits kind of for a strict majority confirmed, and Fits but shutting down for otherwise qualifying products with published shutdown or acquisition notices. Within each group it sorts by must-haves met, then preferences met, then name. With no requirements selected, all researched products appear, with published notices in the third group. Unknown never counts as a failure. Products below the threshold remain in name search and Browse all ADEs. Explanations of unknowns, gaps and research coverage live on Method, outside the main views.

Covered product identities and their index rows may add one field, `formerNames: string[]`, for search. Private `former-names.json` names the eligible rename finding and its namespaced citations. The builder requires explicit current-name/former-name wording in that public finding and current evidence cited by it. Ineligible rename findings remove the field; age alone does not. Paradev's former name Superset uses this path; private aliases are never copied. Identity-only listings keep their four-field shape.

Status events come from catalog change records. The exporter keeps only references still belonging to current public findings. It discards private summary prose, authors, before/after values and page references. Events with no eligible citations disappear. Lifecycle-only events require an eligible notice and its citations. These are research and product-change events, not a complete historical archive and not proof of a hands-on test. The site can resolve their claim IDs to current public wording. It must not imply that today's answer is the exact historical before/after value.

`methodology.publisher.disclosure` preserves the existing publication disclosure verbatim. Apply the same gates and filter definitions to every product. No sponsored placement, affiliate link or vendor call to action belongs in the results.

## Build and security checks

From the repository root:

```sh
node research/directory/build.mjs
node research/directory/build.mjs --check
node --test research/publication/publication.test.mjs research/publication/directory.test.mjs
```

The `ADE_COMPARISON_PUBLICATION_DATE=YYYY-MM-DD` override supports reproducible snapshots and tests. Ordinary builds use the current UTC date. `ADE_COMPARISON_PRIVATE_MARKERS` adds a regular expression of maintainer-specific markers to the public-package scan. The checked-in package is a snapshot. Rebuild before each site build to apply evidence and review changes; age alone never invalidates it. The site and the catalog live in the same repository, but the site build reads only `data/`; a catalog change reaches the site only through `npm run data:build`.

The build checks an allowlist of public fields and rejects private keys, private hosts, secret-bearing query parameters, internal-file and private file-serving URLs, private filesystem paths, internal ticket references, internal-only text and known researcher/reviewer/author identities. Every shape check also proves each filter value resolves to its claim and citations and that lifecycle cells match their notices. The identity and text check runs inside the publication builder; it returns no raw catalog data to the directory builder. Text already permitted by a public finding is public even if another private record repeats it. The scanner uses the same directory opt-in when computing approved output. On a given date, private text is every catalog string outside that output, including contradicted findings and ineligible lifecycle notices. Retained overdue findings are public; context and review identities are not exported to `data/`. Whole-field copies always fail. Inside longer text, the scan matches phrases of six or more words and any phrase containing a digit, because short common words recur in authored public text. Dates, URLs, schema enums, record IDs, and exact filter IDs and labels are structure rather than private text. Filter descriptions and methodology text get no exemption and are scanned like everything else.

A failed check preserves the prior package. The suite scans the real catalog years beyond its scheduled recheck dates and proves that retained findings remain safe. It also tests the unchanged default publication policy with all findings expired. Check both the generated objects and what reached the disk before replacing the prior package. A successful rebuild replaces the whole output directory to remove obsolete files.

`--check` reads the existing files and also rebuilds the package from the catalog at its `generatedAt` date, failing on any difference, so a hand-edited value with a matching bit cannot pass. It rejects package and check dates after the current date. Passing a scheduled recheck date does not make a valid snapshot fail. It also rejects extra files, symlinks, missing product records and any bytes other than the builder's exact serialization, and it verifies field types and checks every bit against its receipt. After editing the catalog, rebuild the package or `--check` fails. The tests scan the committed package and inject private fields, prose, identities and internal URLs into fixtures to prove the checks fail. They also cover directory retention, unchanged default publication expiry, sourced lifecycle notices, digest changes, citation ownership, separate reviews, status sanitation and unknown bitsets. Keep these checks beside the existing publication suite.
