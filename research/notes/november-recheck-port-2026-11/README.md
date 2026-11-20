# November recheck port (2026-11-12)

Facts from podium-cloud's 2026-11-11 recheck of its older 56-profile catalog copy that this catalog did not have yet. Each fact was re-read at its primary source on 2026-11-12 before it was ported. Every touched claim is `public-candidate` with `review: null` and researcher `researcher-ade-25`, and needs an independent review. Each product has a change record. The scripts in this folder applied the batches through `port.mjs` and are kept for provenance; do not run them again, because they refuse to add evidence IDs that already exist.

Scope agreed with the PDM-148 coordinator: product changes and newer dated facts only. The deeper atom backfill is a separate task (counts below).

## Ported

| Product | Claims | Facts |
|---|---|---|
| capy | ACC-01/02/03, PLAN-05/06, RUN-01/03, TEAM-02/05, SHIP-06, OWN-06 | 0.8.0 (Nov 10): Google Workspace SSO add-on, SAML/OIDC by contact, required MFA and passkeys, image and video comments, PR guides, stack badges, Issues Display menu, voice input, Fable 5.2/Morph/Ramp Router, 14-day clearing of sleeping workspaces. ACC-03 Claude-subscription contradiction cleared: the download page no longer says Claude cannot connect. |
| github-copilot | OWN-03/04/06/08/09, RUN-01/03/07 | AI Credits details ($0.01 per credit, base and flex, no carry-over, discounts), legacy premium requests only on annual Pro/Pro+, seat prices, Copilot access via Enterprise and $10 Standalone (Oct 28), cloud sandbox as the default with no one-hour limit (Oct 28), sandbox rates and payer, Free limits, training on interaction data by default, app v1.2.0 and CLI v1.0.109 (Nov 10). |
| amp | ACC-01/03, PLAN-03/07, COORD-02/05, RUN-06, TEAM-01/06, OWN-06 | Spaces (Nov 6), app OS minimums including Linux, iOS still on TestFlight and Android a direct APK (mobile_apps supported → partial), five accounts per device, releases through Boxes (Nov 10). |
| antigravity | RUN-01, ACC-05, OWN-06 | Remote Agents rollout finished in 2.30.0 (Nov 9) for Ultra and paid Pro; CLI 1.5.0 `agy acp` and `--remote-agent`, 1.5.4 Auto mode for ACP. |
| factory | OWN-06 | Cloud Machines deprecated in favour of Environments (v1.7.0, Nov 10); latest v1.9.0 (Nov 11). |
| superset (Paradev) | RUN-01, OWN-06 | Cloud workspaces out of beta in 2.0.6 (Nov 8) on Team and Ultra. |
| kiro | TEAM-03, RUN-07, OWN-06 | Approve for me and the permission-mode menu (IDE 1.4.154, Web), Enterprise Management preview, `/usage` session credits (CLI 3.1.0), releases through CLI 3.2.1. |
| zed-delta | RUN-01, RUN-04, ACC-01, ACC-03, OWN-06 | Cloud Runners launched Nov 11 on every Zed plan except Student (managed_cloud partial → supported), with sizes, fair-use billing, pause rules and a one-hour terminal limit. Stale private-beta wording replaced; whether Personal Runners are still gated is unknown. Releases through 0.25.0. |
| conductor | OWN-06 | 0.94.0 (Nov 9). |
| opencode | OWN-06 | v2.2.7 (Nov 10). |
| omnara | OWN-04 | 5% service fee on managed credits; startup credits. |
| claude-code | OWN-06 | v2.1.322 (Nov 10). |
| verdent | OWN-04, OWN-08 | Contradiction: the pricing FAQ still advertises a 100-credit trial that the v2.18 changelog retires. Trial atoms changed from unsupported to partial. |

## Contradictions

- **Capy sleeping workspaces**: the 0.8.0 changelog clears them after more than 14 days; docs.capy.ai/machines still says 30 days. Recorded on RUN-01 and RUN-03.
- **Verdent trial**: the pricing FAQ says the free trial includes 100 credits; the v2.18 changelog says the Free Trial and welcome credits are retired. Recorded on OWN-04 and OWN-08.
- **Orchestrator.inc llms.txt**: llms.txt still marks "Collaborate on cloud agents" and SSO as Enterprise coming soon, while the pricing FAQ and v0.14.10 describe shared Cloud sessions. This catalog already recorded it on TEAM-01, and llms.txt was unchanged on 2026-11-12, so nothing changed here.
- **Corrections to the source recheck**: Copilot CLI v1.0.110-x builds are pre-releases, and v1.0.109 is the latest release. Factory's latest release is v1.9.0, not v1.8.0. Delta Cloud Runners were still private beta in this catalog, although the brief listed them as already ported.

## Not ported

- Kiro CLI 3.0.0 retiring the Classic interface and the desktop app, and Kiro credit pooling: the current changelog page starts at Nov 4, so I could not re-read these entries.
- T3 Code v0.1.9: the release page showed only v0.1.10 pre-releases.
- Release-only freshness bumps with no capability change (Codex, Zed 1.28.1, OpenHands 1.39, Paseo pre-release, Intent, Synara, Solenta, Augment pre-release): left to the regular freshness pass.

## Atom backfill (separate task)

These are the atoms that podium-cloud answers and this catalog still leaves unknown, counted after this port: github-copilot 256, amp 207, factory 201, buzz 199, devin 166, lanes 154, cmux 144, cline 137, kiro 118, jules 110, codex 104, jean 102, code-layer 97, intent 92, augment-code 92, emdash 85, omnigent 78, maestro 74, linzumi 51, omnara 38, ona 30, qm 29, synara 28, opencode 27, openhands 15, conductor 15, agent-orchestrator 13, solenta 11, openspec 11, unpeel 9, zed-delta 8, superconductor 7, cursor 7, xum 6, proliferate 6, orca 6, zed 5, warp 5, replicas 5, superset 4, zenflow 3, zencoder 3, verdent 3, super-engineering 3, jetbrains-air 2, claude-code 2, rookery 1, podium 1.

## Effect on the public directory

`data/` was rebuilt (`npm run data:build`). Each touched claim lost its review, so every typed facet that cites one of those claims fell back to unknown until a different agent reviews the claim and its facet digest again. That is 63 cells in all: amp 8, antigravity 4, capy 15, github-copilot 11, omnara 6, superset 5, verdent 7, zed-delta 7. The cross-checked claim count dropped across the 13 touched products. Do not deploy this branch until that review has rebound the facets, unless losing those cells for a while is acceptable.

`test:research` result: 80 of 81 pass. `directory.test.mjs` test 34 ("returned launch interpretations retain their corrected scope and citations") fails because it pins Paradev's `isolation.worktree` evidence. That facet cites `superset:RUN-01`, which this port changed, so the cell is now unknown. HEAD passes 81 of 81. I did not change the test. It should pass again once the RUN-01 facet is re-reviewed.

## Independent review (reviewer-ade-25, 2026-11-12)

I re-read every cited 2026-11-12 source for the 49 ported claims. Each ported fact matches its source. Nothing passed unchanged, because the port has four systematic defects. `review-corrections.mjs` and `review-checkdates.mjs` correct them. Every touched claim is back at `public-candidate` with `review: null` and researcher `reviewer-ade-25`, so a third agent must review it.

- **Check dates (all 44 claims that already had findings).** `port.mjs` moved each whole claim's `checkedAt` to 2026-11-12 although only the patched atoms were re-read. The repo's convention (`author.mjs applyPass`) keeps the earlier date. This is also why every facet fell to unknown: the facet gate refuses a mapping whose own sources predate its finding's check. The earlier dates are restored, and `nextReviewAt` is the earlier of the two.
- **Dropped atom citations (Capy 9 claims, Copilot RUN-01).** The port replaced atom `evidenceIds` with only the new sources but kept the earlier facts in the answers. The earlier sources are re-cited.
- **Stale limitations (Copilot 8, Amp 5, Factory, Kiro 2, Omnara).** The limitation lists still said "did not establish" the atoms the port had just answered. They now name only atoms that remain unknown.
- **Stale answers and facts.** Amp ACC-01 still said Linux availability was not stated. The Antigravity RUN-01 and OWN-06 answers described a gradual rollout and old releases. Paradev OWN-06 named desktop-v2.0.5 as latest; GitHub shows desktop-v2.0.8 (Nov 10), added as `nov12r-releases`. Claude Code OWN-06 named v2.1.319. Delta ACC-01 said it was not stated whether Cloud Runners run shell turns from the web; the doc says they do (`nov12r-cloud-runners-web`). Capy TEAM-02: pricing lists the audit log on every plan, not only Enterprise. Five Amp claims added by the port had no surface scope.

The contradictions are confirmed at source and stay open. Capy RUN-01 and RUN-03 (14 vs 30 days) and Verdent OWN-04 and OWN-08 (100-credit trial) cannot be reviewed while they are open.

**Facets.** 65 typed mappings on touched claims had fallen to unknown. I checked each value against the current finding and its sources, recorded the digest, and accepted the facet review. 53 now publish as `sourced`. They become `agent-cross-checked` once a third agent reviews the cited claims and re-runs `author.mjs review-facets`. Capy `agents:claude-code` was unknown before the port because of a 2026-11-07 changes-requested review. That review's objection, that the download page said Claude cannot connect, no longer holds, so the mapping is accepted with a note. 12 mappings stay unknown because the publication boundary drops contradicted findings: Capy execution local, own-server and vendor-cloud plus laptop-independent (RUN-01), and Verdent's seven pricing cells on OWN-04 and OWN-08 (`free-tier` was already unknown).

Follow-ups not done here: Delta now has GA Cloud Runners, but its `execution:vendor-cloud` and `laptop-independent` facets have no mapping. Adding one needs a researcher and a separate reviewer.

## Second independent review (reviewer2-ade-25, 2026-11-12)

I re-read the 2026-11-12 sources cited by the 45 corrected claims that can be reviewed: the Capy changelog, download, pricing table and models doc; the GitHub Copilot changelog entries, billing and plan docs, plans page, training post, app release and CLI releases API; Amp apps, Spaces and chronicle; the Antigravity changelog; Factory release notes; the Paradev changelog source and releases API; the Kiro changelog; Delta's Cloud Runners doc, blog, pricing and release notes; and the Conductor, OpenCode, Omnara and Claude Code release or pricing pages. I also checked each correction against the earlier review. 44 claims pass and are `public-reviewed`.

- **Corrected (1):** Antigravity OWN-06. The changelog now has a full CLI 1.5.5 entry, dated Nov 10, 2026 and labelled Latest. The answer said only that the table of contents lists 1.5.5 and named 1.5.4 as the newest release. `review2-corrections.mjs` updates the answer, `release_activity` and the scope version, and adds `nov12r2-cl-cli-1-5-5`. The claim is back at `public-candidate` with researcher `reviewer2-ade-25` and needs another review. No typed facet cites it.
- **Held (4):** Capy RUN-01 and RUN-03 and Verdent OWN-04 and OWN-08 still have their open contradictions and stay `public-candidate`.
- **Notes, no change:** Antigravity ACC-05 was already overdue (`nextReviewAt` 2026-11-08) before the port, and only its `cli` atom was re-read. Delta's Cloud Runners doc now describes Personal Runner settings with no beta gate. The claim still says the gate was not re-established, which is conservative but not wrong. Kiro TEAM-03 atoms name Kiro Web and Crew, while the claim scope is CLI and IDE, as it was before the port. The Amp `apps` surface name ("Amp web, Mac and iOS") is now narrower than the documented apps.

**Facets.** `author.mjs review-facets` cross-checked the 53 mappings that the first review rebound: Capy 12, GitHub Copilot 11, Amp 8, Antigravity 4, Paradev 5, Delta 7 and Omnara 6. The 12 mappings on contradicted claims stay unknown: Capy execution local, own-server, vendor-cloud and laptop-independent (RUN-01), plus Verdent's eight pricing mappings on OWN-04 and OWN-08. Delta's `execution:vendor-cloud` and `laptop-independent` mappings are still a follow-up.

## Merge with origin/main (researcher-ade-25, 2026-11-20)

origin/main had 2026-11-13 source passes on all 13 touched profiles. `git merge` compared each claim, evidence item and typed mapping against the merge base. Upstream's newer facts were kept, and our port was re-applied wherever it was still newer. Only five claims were changed on both sides:

- **Conductor OWN-06**: took upstream (0.94.2, banner removal, independently reviewed). Our 0.94.0 bump is superseded.
- **Delta RUN-01**: took upstream. The current runner guide makes Personal Runners public, which supersedes our "gate not re-established" wording. Upstream's roadmap gaps replace ours.
- **Amp ACC-01**: combined upstream's Linux desktop client and systemd runner with our OS minimums and the TestFlight and APK channels.
- **GitHub Copilot OWN-04**: combined our AI Credits rates, discounts and sandbox rates with upstream's CLI BYOK and consumption billing. Limitations name only atoms that are still unknown.
- **Omnara OWN-04**: kept our credits answer and upstream's overages answer. Limitations list only interval, seat_minimum, trial and taxes.

The three combined claims are `public-candidate` with `review: null` and need an independent review. Capy's roadmap review now uses upstream's 0.8.0 reading. Copilot's keeps our changelog location ahead of upstream's.

**Typed mappings.** Upstream added mappings citing claims this port had changed, so their digests went stale. I checked each value against the merged finding and re-bound it with `author.mjs bind`: Amp ACC-01 (7), Capy `agents:claude-code`, Copilot OWN-04 pricing (9), Omnara OWN-04 pricing (10) and Delta phone clients (2). Amp `desktop-os:macos`, `phone-client:ios` and `phone-client:android` had stale rationales, so they now cite `nov12-apps` and record the TestFlight and APK channels. All of these are `sourced` until a different agent reviews them. Verdent `paid-from` (OWN-04) is re-bound too, because the trial contradiction does not touch the $10 paid price. It still publishes unknown while OWN-04 is contradicted. Verdent's other three OWN-04 pricing mappings stay stale. Upstream already added Delta's `execution:vendor-cloud` and `laptop-independent` mappings, which closes the follow-up named above.

**Test change.** main's `directory.test.mjs` test "paid-price mappings remain bound after adding the absence option" required every bound `paid-from` mapping to publish its value. A mapping whose finding is withheld because it is contradicted (Verdent OWN-04) now has to publish unknown instead. The binding assertion is unchanged. Revert this once the Verdent trial contradiction is resolved, if you prefer the stricter form.
