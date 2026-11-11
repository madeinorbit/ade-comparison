# Vibe Kanban evidence research

Checked October 13, 2026. An independent reviewer checked all 35 source records, accepted 43 scoped findings and eight explicit criterion gaps, and accepted the dated lifecycle record on 13 October. Installed-product scenarios remain unrun.

Vibe Kanban remains an ADE through its local agent workspaces, sessions, code review, previews and Git workflow. Its commercial shutdown does not mean that all local functionality stopped. The discontinued vendor service covered kanban issues, comments, projects and organisations. The profile separates those records from local workspace conversations and inline diff feedback.

## Lifecycle evidence

| Date | Evidence | Interpretation and boundary |
| --- | --- | --- |
| April 10, 2026 | [Goodbye bloop](https://vibekanban.com/blog/shutdown), by Louis Knight-Webb | bloop announced its closure, terminated subscriptions and refunded invoices paid in the preceding 30 days. It gave remote services a 30-day transition window and explicitly preserved local workspaces. The profile leaves the exact service-end date null. |
| April 24, 2026 | [Release v0.1.44](https://github.com/BloopAI/vibe-kanban/releases/tag/v0.1.44-20260424091429) | The release includes export-only project routes and coding-agent adapter updates after the shutdown announcement. It was still the latest listed release when checked. |
| April 24 release source | [ProjectKanban.tsx](https://github.com/BloopAI/vibe-kanban/blob/4deb7eca8f381f7cbc1f9d15515a9ab8f8009053/packages/web-core/src/pages/kanban/ProjectKanban.tsx) and [ProjectSunsetPage.tsx](https://github.com/BloopAI/vibe-kanban/blob/4deb7eca8f381f7cbc1f9d15515a9ab8f8009053/packages/web-core/src/pages/kanban/ProjectSunsetPage.tsx) | Both local and remote project wrappers use the shared page, which returns the retirement screen after access checks. There is no exception for a self-hosted API. Separate local Workspaces routes remain outside this project-page restriction. |
| June 2, 2026 | [Community-edition discussion](https://github.com/BloopAI/vibe-kanban/discussions/3424) opened by Louis | The maintainer asks for direction and contributors. His June 7 reply describes an earlier orchestrator experiment as unreleased. This is not a delivered community feature roadmap or maintenance SLA. |
| September 19, 2026 | [Pinned default-branch revision](https://github.com/BloopAI/vibe-kanban/commit/d5cbb5380fa0b32e98ef9b8d987f63decce4be3a) | This was the default-branch head retrieved. It is separate from the April release. Current repository access and a later commit do not prove support responsiveness or runtime reliability. |

The release tag is annotated. Its tag object is `5b26a741fcf91d0d828ecd844745e5b1ff70e413`; its peeled source commit is `4deb7eca8f381f7cbc1f9d15515a9ab8f8009053`. Code citations use the commit.

## Local functionality and retired services

| Area | Candidate finding | Profile references |
| --- | --- | --- |
| Agent choice | Released adapters include Claude Code, Codex, Amp, Gemini, OpenCode, Cursor Agent, Qwen Code, Copilot and Droid. Codex source uses its app-server session operations. No mixed-harness run was performed. | ACC-02 |
| Parallel work | Docs describe independent sessions and workspaces. Sessions in one workspace share files but do not inherit each other's conversation context. | COORD-01, PLAN-04, RUN-02 |
| Workspace creation | The local flow can start from a prompt without a hosted issue or Vibe Kanban sign-in. Agent/provider authentication remains separate. | PLAN-01, COORD-07, ACC-03 |
| Review and delivery | Local docs cover diffs, inline feedback to agents, development previews, PR creation, local merge and rebase/conflict handling. These are documented workflows, not completed research scenarios. | SHIP-01, SHIP-03, SHIP-04 |
| Issue management | Vendor-hosted issue/project workflows are retired; the release project page is export-only. An existing local workspace is not a replacement issue tracker. | PLAN-06, OWN-06 |
| Agent issue operations | Remote issue MCP functions remain in source and target remote API routes. Their existence does not establish working current local issue management. | PLAN-07 |
| Team collaboration | Hosted issue comments and organisations retired. Two-user local co-steering, permissions and takeover were not demonstrated. | TEAM-01, TEAM-02, TEAM-06 |
| Hosting | Local use continues. Official Docker and remote-SSH instructions exist, but a deployed self-host instance and laptop-independent continuation were not tested. | RUN-01, OWN-02 |
| Ownership | The pinned repository has an Apache-2.0 root license. This does not prove hosted parity or zero model/compute cost. | OWN-01, OWN-08 |

For page authors, local prompt creation belongs to PLAN-01, while PLAN-06 deliberately scopes retired issue management. Hosted comment retirement belongs to TEAM-01 and OWN-06, not the local planning row PLAN-02.

## Export and migration limits

The [released export UI](https://github.com/BloopAI/vibe-kanban/blob/4deb7eca8f381f7cbc1f9d15515a9ab8f8009053/packages/web-core/src/pages/export/ExportPage.tsx) requires sign-in and a remote API. The [server implementation](https://github.com/BloopAI/vibe-kanban/blob/4deb7eca8f381f7cbc1f9d15515a9ab8f8009053/crates/remote/src/routes/export.rs) writes a ZIP with issue, project and user CSVs and optional attachment files. The issue CSV includes status, priority, assignees and parent issue.

No authenticated export or import was attempted. Do not promise that old hosted data is still downloadable, that every relationship/comment/session is portable, or that an automatic migration into another product exists. [Issue 3396](https://github.com/BloopAI/vibe-kanban/issues/3396) reports missing workspace links and project settings; that report remains a lead rather than a successful migration test. The source establishes the narrower format inventory above.

## Evidence quality and gaps

The profile contains all 51 criteria and 503 declared atomic questions. The pass records 143 evidenced atomic answers, including scoped unsupported answers for retired service behavior. It leaves 360 atomic questions unknown. Eight whole criteria remain unknown. Forty broad rows are partial and three describe unsupported retired hosted behavior. These counts measure coverage, not product quality.

The inline ledger has 35 records, including two unresolved user reports. Positive or unsupported answers do not rely on those reports alone. Documentation without a stated publication date has `sourceDate: null`; retrieval dates are not release dates. Code evidence pins the released commit and a path/locator. Some repository documentation pins the later default-branch revision and is labeled documentation, not implementation inspection.

The live documentation index still advertises Cloud and issue management. The dated shutdown notice and released retirement implementation take precedence for current vendor-hosted availability. Self-hosting instructions are retained as documentation with an explicit export-only UI limitation. Direct `.md` downloads returned HTTP 403; canonical live HTML pages and the official repository provided the evidence used.

No product runtime tests were run. Installation success, concurrent execution, mobile handoff, full-session takeover, failure recovery, resource scheduling, exact-revision approval, costs and performance remain unverified. No current active-user count is asserted. Historical marketing counts and rounded GitHub star totals were omitted.

The roadmap pass checked the shutdown post, release list, documentation index, repository issue list and maintainer discussion. It found discussion of community direction, not a committed feature schedule. The original promise of a forthcoming roadmap remains separately recorded as an announcement, not a shipped capability.

## Screenshot

[Official local workspace sample](../screenshots/vibe-kanban/home.png), downloaded unchanged from the [pinned README asset](https://raw.githubusercontent.com/BloopAI/vibe-kanban/4deb7eca8f381f7cbc1f9d15515a9ab8f8009053/packages/public/vibe-kanban-screenshot-workspace.png). It shows the Workspaces list, an active conversation, an `Agent.tsx` diff and Git controls. Visible work includes "Explore the codebase", "Create Good First Issues on Github" and "Install and integrate Vibe Kanban Web". Distinct task states are not clear enough to claim multiple-state coverage.

The image was visually inspected at its original aspect ratio and preserved without cropping or retouching. It is a vendor sample, with unknown capture date. Text claiming a successful build inside the sample is not a runtime result from this research. The manifest binds the visual review to SHA-256 `54fd00fee5824d84c4b371781ff731ca0c02f3c22fa99050661972eabdd4599b`.

## Validation

- The profile, the rubric and the screenshot record validate against the catalog schema and validator, including the lifecycle contract.
- No product runtime, source build, installation or migration test passed or failed because none was attempted.

Independent scope follow-up on October 13 added the self-hosted surface to ACC-04 and the retired-hosted/MCP surfaces to PLAN-01. Inline diff-feedback claims now cite the direct [Changes Panel documentation](https://www.vibekanban.com/docs/workspaces/changes), including its distinction between submitted and pending GitHub review comments. The earlier workspace overview also explicitly describes inline comments. All affected claims remain candidates.
