# Shared comparison framework

Rubric v0.3 · approved 2026-11-12

This document defines the questions every product researcher must answer and the evidence rules that apply to every product. The machine-readable rubric is [criteria.json](criteria.json); `validate.mjs` fails if the two diverge. The catalog itself is described in [README.md](README.md) and [AGENTS.md](AGENTS.md).

## Approved research basis

The product scope and revised 51-criterion framework were approved on 2026-11-12. Research uses these seven groups and evidence rules, with scenario-based advice and no overall product score. An editor, a remote agent service, and a multi-agent workspace can each be the right choice for different work.

Researchers cover every criterion for every included product. A presentation can summarize the criteria relevant to its audience, but it cannot drop a criterion for one product and keep it for another.

## What counts as comparable

The unit of comparison is a named product, on a named surface, plan, release or source revision, as of a recorded date. A desktop app, web agent and CLI may share a brand without sharing capabilities. Capture those differences explicitly. Do not combine a free desktop feature, an enterprise cloud feature and an unreleased branch into one fictional product.

The same requirements apply to Podium, whose makers publish this research. Non-public source can never by itself justify a public claim, for any product. Roadmap issues, website mockups and instructions given to an agent do not prove a shipped capability.

Product categories describe the main workflow. They are not scores. Model choice, operating systems, execution locations, source licenses and target users are separate fields. A remote-control client is not evidence that work executes in a managed cloud environment. A Git worktree is not a security sandbox.

### Common result fields

Each product × criterion record needs all of these dimensions:

| Dimension | Allowed values or rule |
| --- | --- |
| Answer | The concrete answer and limitations, using the values in the criterion table. Never just a checkmark. |
| Support | Recorded per atomic question: `supported`, `partial`, `unsupported`, `unknown`, or `not-applicable`. Partial names the unmet part. Unsupported needs affirmative evidence for the scoped product, which includes a complete first-party list that omits the option (see below). Unknown names the search or access gap. Not-applicable needs an explanation accepted by the reviewer. The criterion record keeps one catalog-internal marker that says whether the record is answered or unknown. That marker is not a rating and is not published. |
| Availability | `generally-available`, `beta`, `private-preview`, `announced`, `source-only`, `removed`, or `unknown`. An announcement is not current support. |
| Delivery | `native`, `official-integration`, `community-integration`, `manual-workaround`, or `unknown`. Record the extra tool, plan and setup burden. A prompt asking an agent to do something is not native enforcement. |
| Evidence | `observed`, `source-inspected`, `documented`, `vendor-claimed`, or `unresolved`. Multiple evidence records can coexist. These are methods, not interchangeable confidence scores. |
| Scope | Product and surface IDs, version or commit, plan, OS, execution mode, region if relevant, and required harness/model version. |
| Dates | Source publication/update date where known, researcher check date, and next review date. A crawl date is not a release date. |
| Publication | `internal-only`, `public-candidate`, or `public-reviewed`, with reviewer and review date. Only the last may supply website claims. |

Store analyst interpretation separately from observed facts. A justified conclusion can cite several facts; it must not silently replace them. An unresolved contradiction remains visible and blocks a definitive public claim about that criterion.

Apply support states to atomic questions, such as "can approve from the mobile browser," rather than giving an entire broad row one yes/no result. Supported means the scoped behavior meets the recorded question completely; partial means only part of that same behavior works and names the limitation. A macOS-only product is supported on macOS and unsupported or unknown on other named platforms, not generically "partial access." Do not average subfields into a group score.

A complete first-party list can establish `unsupported` for what it leaves out. The source must present itself as the full list for one closed dimension of the scoped release: a download page with its builds, a system-requirements or supported-platforms section, a pricing page with every plan, a license file. The answer cites that source and says the list omits the option. A README that happens to mention one platform, a marketing sentence, an example or a "such as" list is not complete, and neither is a list the vendor calls partial. If another first-party source disagrees, the answer stays unknown and the contradiction is recorded. This applies only to closed dimensions such as operating systems, client types, execution locations, plans and licenses. For open-ended capabilities, silence in the documentation is never `unsupported`. The rule is the same for every product. During schema work, freeze the enumerated subfields from each row and their required answers before any product agent starts; new subfields require a rubric revision for every product.

## Six high-level judgments

These are derived summaries for filters and comparison pages. Each must cite the underlying criterion answers, product surface, plan, evidence method and date. Use unknown or mixed where necessary; do not replace detailed answers with an unsupported badge. The labels describe demonstrated operating depth, not an overall ranking.

| Area | Consistent judgment rule |
| --- | --- |
| Agent-native issue tracking | Distinguish external import/attachment, native human-managed issues, shared agent-operable issues and coordinated issue lifecycle. Shared agent-operable requires durable common IDs, agent read/write and human-visible attributable changes. Coordinated lifecycle additionally needs demonstrated readiness/dependencies, ownership and retained history. Use PLAN-01/03/06/07 and COORD-02; missing evidence prevents the corresponding claim. |
| Multiplayer and collaboration | Report shared visibility, shared discussion, live co-steering and full-session takeover separately. Demonstrate each with two named users; include conflicts, permissions, original-owner availability and plan limits. Use TEAM-01/02/04/06. |
| Remote work with laptop closed | Report local-only, remote control of an awake host, BYO remote execution and managed-cloud execution separately. Claim laptop independence only with evidence execution survives that client's disconnect and is accessible from another device. Include setup burden, expiry and recovery. Use ACC-01/04 and RUN-01/03/04. |
| Software factory operations | Distinguish session management, coordinated task execution and demonstrated fleet-to-delivery operations. The last requires durable queued/dependent work, visible delegation, attention routing, truthful status/recovery, resource-bounded checks and batch review/delivery evidence. State N tasks/agents and whether each part was documented or observed. Use PLAN-03/06/07, COORD-01/02/03/06/07, RUN-03/06/08 and SHIP-02/05/06. Do not label a product a "true factory" from marketing language or its visual layout alone. |
| Enterprise assurance | List named controls and scoped reports/certificates with their evidence status. Keep ISO certification, SOC 2 attestation and available enterprise access controls distinct. No universal enterprise-ready badge. Use OWN-03/07 and TEAM-02/03/04. |
| Living specifications | Distinguish task-start SDD, persistent reference docs, maintained cross-task product specs and review-connected living specs. Maintained specs require attributable human/agent changes, versions and implementation links. Review-connected additionally requires demonstrated retrieval/drift checks in later work and quality review. Use PLAN-02/04/05/08 and SHIP-02. |

The comparison records observable behavior first. A chat, sidebar or preset is not inherently inferior; record whether people can complete the agreed work with acceptable effort and visibility. Every product must meet the same proof requirements.

## Seven comparison groups

The IDs are stable join keys for research, change history and pages. Names can improve after review; changing a criterion's meaning requires a rubric version change and rechecking affected records. Every row below applies to every full-profile product, with explicit unknown or not-applicable results where needed.

### 1. Access and agent choice

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| ACC-01 | Client access | List desktop OS and minimum versions, iOS, Android, browser, mobile browser, CLI and editor extensions separately. For each client, record start, steer, approve, review and resume actions, notifications and plan restrictions. Test moving the same task from desktop to phone; distinguish an installable mobile app from a mobile website and from status-only monitoring. |
| ACC-02 | Agent and model choice | List supported harnesses and model providers separately, including custom adapters. Record whether the product embeds a harness, controls its sessions through an API, or only launches its terminal command. Verify at least two different harnesses before describing mixed-harness operation as observed. |
| ACC-03 | Subscriptions, API keys and vendor credits | Record bring-your-own agent subscription, bring-your-own API account, vendor credits and local models as separate routes. List supported plans, models/modes, multiple-account switching and what works without a vendor account or token purchase. Existing subscription support cannot be inferred from API-key support. Record required extra payments and documented provider restrictions. |
| ACC-04 | Onboarding and project prerequisites | Measure fresh install to first successful task, with manual steps and failures. Test a local directory without Git, a local Git repo without a remote, and a GitHub-backed repo separately. Record whether account, project, host, credential and permission prerequisites are explained before accepting an unusable prompt. Evaluate managed-cloud setup and first-class BYO VPS installer/onboarding independently of hidden settings or a DIY shell recipe. |
| ACC-05 | Programmable access | Inventory actual CLI, API, SDK, MCP and webhook operations for create, inspect, steer, stop and review. Record authentication and API stability. Having an MCP client that uses external tools is different from exposing the product to other agents over MCP. |
| ACC-06 | External tools and extensions | Record MCP client support, plugins, custom tools, skill/instruction import, integration authentication and permission scope. Name which component provides each connection and whether setup is product-managed or inherited from the underlying harness. Verify one external-tool call and its access boundary where available. |
| ACC-07 | Client implementation | For each desktop/mobile client, record native platform UI, Electron, Tauri, React Native, web/PWA or unknown, plus hybrids. Require official technical docs or pinned source/build evidence. Tauri is not synonymous with fully native UI. Keep implementation choice separate from measured responsiveness and usability. |

### 2. Planning and context

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| PLAN-01 | Intake and external tracker relationship | Record local creation, prompt intake, issue import and chat/Git triggers. Identify the authoritative tracker, stable issue IDs, one-way or two-way sync, supported edits and operations requiring a trip back to Linear/GitHub/Jira. Importing or attaching a ticket is not native issue management. Answer PLAN-06 and PLAN-07 separately. |
| PLAN-02 | Durable task plans | Record task plans and acceptance criteria, editors, revision history and links to implementation. Test amending a task while work is running, restarting and revisiting it later. A task-specific starting brief, reusable memory and a persistent product specification are different objects; product specs are judged in PLAN-08. |
| PLAN-03 | Hierarchy, dependencies and evolving scope | Record epics, arbitrary parent/child depth, blockers, readiness, dependency enforcement and state propagation. Start with a simple interactive task, grow it into an epic and retain its identity, discussion, history and outputs. Verify blockers actually prevent dispatch. Record whether a rigid preselected workflow is required, and whether changing scope requires recreating work. |
| PLAN-04 | Shared context and memory | List repository instructions, skills, project docs and cross-session/cross-harness memory. Record scope, provenance, citation, correction/deletion and stale-context controls. Test what survives a new session or colleague takeover. A notes page or shared file is not automatically a maintained spec or managed memory. |
| PLAN-05 | Architecture and API awareness | Record code search, repository indexing, external knowledge and multimodal inputs, with source freshness and access scope. Ask an agent to use an existing API under a documented architecture rule, then propose a conflicting change. Check retrieval, citation, conflict detection and review-time enforcement separately. A large context window or an instruction file alone does not prove architectural consistency. |
| PLAN-06 | Native issue management and idea backlog | Enumerate create, edit, discuss, prioritize, label, assign, search, filter, archive, reopen and project/epic views within the product. Save an idea without creating a running agent, refine it with another person, and explicitly mark it ready or dispatch it later. Record separate task/session entities, metadata depth, multiple sessions per task, durable state transitions and whether an external tracker remains necessary. |
| PLAN-07 | Agent-native issue operations | Verify an agent can read/create/update the same durable issue IDs and fields humans use, claim/assign work, change state, create dependencies/children and report blockers/results through documented CLI/API/MCP. Check that human views reflect actual writes with attribution, permissions and conflict handling. Distinguish shared authoritative records, synchronized external records, agent-private metadata and prompt-only conventions. |
| PLAN-08 | Living product specifications | Record persistent requirements across tasks/releases, editable by humans and agents with attributable revisions and approval rules. Verify requirement-to-task/implementation links, retrieval during later tasks, drift detection and consideration during review/quality control. Amend a requirement after one task ships, then implement another. A one-time spec-to-plan workflow, per-task brief, memory store or unreferenced document does not establish a living product spec. |

### 3. Coordination and automation

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| COORD-01 | Parallel work | Record independently running sessions and tasks, documented quotas and observed concurrency. Describe how a user sees running, waiting, failed and finished work. Several chat tabs are not proof that runs execute concurrently. |
| COORD-02 | Ownership and dispatch | Record assignment to humans or agents, claims, queues, routing and duplicate-work prevention. Test two workers attempting the same task. Distinguish a display label, an advisory lock and enforced exclusive ownership. |
| COORD-03 | Inspectable delegation and communication | Record parent/child roles, model/harness/effort choice, messages, result return and cross-harness teams. Distinguish product orchestration, provider-native subagents, installed orchestration skills and scripts. Record activation, auth and experimental flags. Verify actual child identity, live progress, retained results and ability to reopen or follow up after completion. A final sentence claiming two reviewers ran is not proof. Test the documented invocation as well as the shared natural-language request. |
| COORD-04 | Unattended triggers | Record schedules, event triggers, recurring tasks and completion conditions. Name where the scheduler runs, overlap handling, retries and whether closing the client stops it. A desktop cron recipe is a manual integration unless the product owns it. |
| COORD-05 | Intervention and attention | Record pause, stop, resume, steering, notifications, pending decisions and escalation. Test an in-run amendment and a harmless approval prompt in both chat and terminal modes. Record silent waits, hidden CLI-only questions and whether stop terminates execution while preserving history. Require discoverable errors rather than inferring success from silence. |
| COORD-06 | Fleet and epic management UI | Use a disclosed fixture of 12 task/agent states across several epics, including blocked, failed, awaiting input, reviewing and completed work. Locate parent/child relationships, dependencies, attention needs, history and workload without reading every transcript. Record navigation steps and errors. Boards, graphs, waterfalls, timelines or another interface can qualify; no required visual form. State whether the fixture was simulated or used live agents. |
| COORD-07 | Workflow flexibility and orchestration visibility | Compare a quick interactive change with a growing epic. Record mandatory workflow/preset selection, natural-language configuration, per-agent model/effort control, changes during execution and whether the UI exposes what actually ran. Test a coordinator with two reviewer children; capture roles, relationships and results during work and after completion. Document discoverability and auth friction without judging an unsupported magic prompt as proof of missing capability. |

### 4. Execution and reliability

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| RUN-01 | Laptop-independent execution | List local, user-owned VPS/remote host, self-hosted service, vendor cloud and hybrid modes. Record provisioning, payer, compute resources, region, idle/max lifetime and disconnection rules. Close/disconnect the originating client and continue from another device. A hosted UI or keep-awake setting is not evidence of remote execution. Record managed-cloud convenience separately from BYO setup effort in ACC-04. |
| RUN-02 | Workspace and process isolation | Record shared checkout, branch, worktree, container, VM and OS sandbox separately. Name filesystem, process, network and secret boundaries. Validate code separation with two changes; do not claim hostile-code containment without separate security evidence. |
| RUN-03 | Recovery, expiry and continuity | Test client disconnect, worker crash, service restart and documented sandbox expiry safely. Separate transcript reload, process reconnection, task resumption and state reconstruction. Record lost context, duplicated actions, manual repair and ability to continue a multi-day epic after compute replacement. Short sandbox lifetimes are reported with their continuity behavior, not automatically treated as failure. |
| RUN-04 | Development environment reliability | Record dependency setup, node_modules/cache handling, snapshots, services, port allocation and secret injection. Start two workspaces with the same service requirements; note installation duplication, port collisions and repair steps. Repeat on a clean remote host. Record which problems the product handles automatically and which the user must diagnose. |
| RUN-05 | Limits and failure handling | Record time, turn, token and spend limits; timeout, retry and provider-failure behavior. Test one controlled failure and a small safe budget. Record whether limits are warnings, enforced stops, or external billing controls. |
| RUN-06 | Truthful status and operational statistics | Record logs, traces, failure reasons, usage exports and statistics by task, agent, project and time. Induce a worker failure and an approval wait: check agent, task and board state agree and remain correct after reconnect. Distinguish working, blocked, failed, idle, ready for review and delivered. For speed/success claims disclose fixture, model, hardware, attempts and failures. UI responsiveness needs observed interaction timings; never infer a framework from lag. |
| RUN-07 | Per-task API and compute cost | Record visible model/API spend per task, session, child and epic, including aggregation across harness changes. Distinguish billed charges, estimates, tokens, subscription allowance and unavailable amounts; never render unknown subscription marginal cost as zero. Reconcile totals with provider evidence where available. Record compute fees separately, refresh delay, budget alerts, export and drill-down from summary statistics. |
| RUN-08 | Compute-aware scheduling and verification | Record concurrency limits, queues, CPU/RAM limits, backpressure, per-host resource awareness and reuse/deduplication of checks. Queue multiple browser end-to-end tests under a declared safe capacity; verify excess work queues or throttles rather than overloading the host. Inspect cancellation, fairness, recovery and whether overlapping epics share limits. Do not run an uncontrolled load test. |

### 5. Human collaboration and control

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| TEAM-01 | Live human collaboration | Record shared visibility, issue discussion, comments, presence and simultaneous co-prompting as independent capabilities. Use two named accounts to steer the same agent and record input ordering/conflict handling, attribution and permission controls. Read-only links and shared issues do not establish co-steering. Record team/free-tier restrictions and whether the original owner must stay online. |
| TEAM-02 | Roles and access boundaries | Record organization/project/task roles, membership lifecycle, SSO and provisioning where offered. Test unauthorized access and revocation with consenting test accounts. Describe documented versus observed enforcement, including which plan provides it. |
| TEAM-03 | Approvals and temporary access | Record command, tool, network, secret and delivery approvals, approver identity and scope lifetime. Demonstrate allow, deny and revocation, including temporary tunnels or shared access after its thread/session ends. Separate default full access, available safer modes and product-enforced policy from instructions the model is expected to follow. |
| TEAM-04 | Decision and activity history | Record attributed actions, approvals, edits, discussion and decision links. Check whether history persists across users and sessions, can be exported, and can be altered. Use the word audit only with a defined retention and integrity model. |
| TEAM-05 | Review experience and guidance | Evaluate locating pending reviews, understanding a change, navigating evidence, commenting, requesting changes and finding the next shipping action. Measure steps/time and missed evidence on a shared fixture. Record keyboard/narrow-screen usability, context switching, clarity of agent roles and preservation of review context. Generic diff/PR access and a guided review workflow are different capabilities. Link high-volume review findings to SHIP-06. |
| TEAM-06 | Colleague takeover and continuity | Have a second authorized person take over ongoing work with the same task, session history, decisions, artifacts, permissions and runtime context. Test after the first person disconnects. Record ownership transfer, attribution and lost context. Separately record transferring to another model/harness; a forked transcript or shared link alone is not full human takeover. |

### 6. Verification and delivery

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| SHIP-01 | Retained artifacts and outputs | Record diffs, documents, screenshots, recordings, previews and test/reviewer outputs. Check for a searchable/browsable artifact gallery or equivalent retrieval, linked to task and exact revision, usable after sessions end. Reopen a completed child reviewer and retrieve its full findings. Check whether internal prompts or tool metadata unintentionally appear in the produced application or other user-facing output. In-chat attachments, persistent review evidence and a cross-task gallery get distinct answers. |
| SHIP-02 | Verification and spec gates | Record tests, lint, types, CI, independent review and persistent-spec conformance checks as required versus optional. Cause a failed test and a conflict with an existing product requirement. Verify review catches the conflict and delivery blocks where claimed. An agent saying checks passed is not a passing gate; record configured and enforced policy separately. |
| SHIP-03 | Git and pull request workflow | Record branches/worktrees, commits, PR creation, review comments, CI response, rebase and conflict handling. Complete one fixture change through a draft PR. Distinguish an integrated workflow from the agent running Git commands without product state. |
| SHIP-04 | Merge and deployment authority | Record who can approve, merge, release and deploy, plus checks against the exact revision. Verify the documented authority boundary without publishing real changes. PR creation, merge and production deployment are separate capabilities. |
| SHIP-05 | Completion evidence and rollback | Record task-to-commit/PR/build/deployment links, delivery status, retained evidence and rollback or revert support. Change the candidate revision after review and examine whether approval/evidence is invalidated. Agent exit alone does not prove delivery. |
| SHIP-06 | Batch review and high-volume shipping | Return to a queue of at least six completed fixture tasks and review a subset. Record summaries, grouping, risk/size filters, retained reviewer findings, artifact navigation, request-changes flow, approval of exact revisions, dependency-aware merge/release queues and clear next actions. Check stale approvals invalidate after edits and duplicate checks respect RUN-08. Distinguish basic diff/PR actions from a coordinated review-and-delivery queue; do not require any product's terminology. |

### 7. Ownership, privacy and economics

| ID | Comparison point | What we record and base judgment on |
| --- | --- | --- |
| OWN-01 | Source and license | Record license and revision per component, including client, server and hosted extensions. Distinguish open source, source-available and closed components. Repository visibility is not a license classification or proof of hosted parity. |
| OWN-02 | Hosting and exit | Record self-hosting scope, required vendor services, data export/import, standard formats and account cancellation behavior. Verify what remains usable without the vendor account. Exported code alone does not mean tasks, context and history are portable. |
| OWN-03 | Data handling and telemetry | Record where code, prompts, credentials, logs and artifacts go, retention/deletion, training use, residency and subprocessors. Separately record telemetry disclosure, collection defaults, opt-in/opt-out controls and observed first-run prompts. No consent dialog is an observation, not proof of no telemetry, secret telemetry or unlawful processing. Separate orchestration-vendor and model-provider policies. |
| OWN-04 | Price and included usage | Record currency, billing interval, seats/seat minimums, workspace charges, included usage, credits, trial conditions, overages, taxes treatment and separate model/compute costs. Map billing routes to ACC-03. Cite public prices or dated quotes. Per-seat versus pooled billing is a fact, not a universal quality judgment. |
| OWN-05 | Scenario cost and controls | Price stated workloads for one, two and five developers, with fixed tasks, concurrency, tokens and compute-hours. The two-person scenario models two developers collaborating. Include subscription, platform, model and compute charges; separate fixed, variable, included and unknown costs. No invented average task cost. Link cost visibility and reconciliation to RUN-07. |
| OWN-06 | Availability and support | Record GA/beta/access restrictions, support channels, documented response commitments, release activity, status history and deprecation/export options. Funding, stars and popularity can be context but are not reliability scores. An archived repository does not prove the hosted service is discontinued. |
| OWN-07 | Enterprise assurance | Record each claimed assurance separately: ISO standard/certificate scope, issuer and validity; SOC 2 report type, covered service and audit period; report/certificate access and verification date. Distinguish public documentation, vendor assertion, independently accessible evidence and unavailable evidence. A logo, enterprise pricing tier, SSO or a provider certification does not prove this product is certified or audited. Report controls in TEAM-02 separately; no legal-compliance verdict. |
| OWN-08 | Useful free tier and evaluation access | Distinguish an ongoing free tier, time-limited trial, credits-only trial, open-source self-hosting costs, paid-only access and gated early access. Map which shared scenarios work for free, especially two-person collaboration, BYO subscriptions, remote compute, mobile, issue management and review. Record card requirement, usage caps and whether meaningful evaluation needs payment or sales approval. |
| OWN-09 | Pricing transparency | Record publicly stated units, included limits, overage rates, compute/model pass-through or markup, minimum commitment, cancellation and sales-only unknowns. Use transparent, partially specified, quote-only or unknown, with named missing fields. A quote-only enterprise price is a disclosed procurement constraint, not proof of dishonesty. |

## Product and company context

Store these dated metadata fields alongside capabilities, without turning popularity or financing into quality scores:

| Field | Recording rule |
| --- | --- |
| GitHub stars | Exact repository URL, count and observation date. Identify main repo versus components/forks; do not add stars across repositories or infer a source license from visibility. Unknown stays unknown. |
| X followers | Exact product or company account and count/date where accessible; founder followers are a separate optional field. Resolve ownership, never estimate inaccessible counts or combine accounts. |
| Financing and affiliation | Company identity, YC batch if confirmed, dated funding round/amount/currency, named investors and source. Separate announced amounts, reported amounts, acquisition history and unknowns. YC participation is not a funding amount or product endorsement. |

## Research protocol

Treat product anecdotes as research leads with unknown test dates, versions or plans where missing; screenshot placeholders are not inspected evidence. Verify current claims independently before public use, and keep personal preferences separate from observations.

1. Resolve the product's owner, canonical site, repository and surfaces. Record aliases and predecessor relationships. Verify a repository belongs to the product before reading it as evidence.
2. Visit the official website, docs, pricing, changelog, public roadmap and relevant policies. Follow product links to source. Use search, directories and other comparison pages to discover leads, then verify material claims in first-party sources. Record which official roadmap, release and repository locations were checked even when they disclose no future plans; record access gaps rather than inferring that the product has no roadmap.
3. For public code, pin a release or commit and inspect the relevant implementation, configuration and tests. Save repository URL, commit, file path and line anchors, a short finding, and the path linking it to a user-accessible feature. A symbol or README promise alone is insufficient. Inspect license files separately.
4. Distinguish released code from default-branch work and hosted behavior. For closed products, use precise official documentation and scoped hands-on evidence where access exists; do not penalize a product for lacking public source.
5. Save one real product screenshot for every full-profile tool. First require a readable, direct product interface with meaningful work. Then prefer a populated home or overview with chat, a populated board or list, an active workspace with a work list, and finally a single-task fallback. Reject promotional overlays, device montages, conceptual cards, isolated widgets and empty views even when first-party. Inspect the downloaded pixels, preserve the original asset, bind visual review to its digest, and record any unresolved fallback honestly. The catalog research contract defines the path and validation requirements.
6. Answer all 51 criteria. Log searched locations and access limits for unknowns. A failed request, paywall or missing search result is not proof of absence. Reserve unsupported for an explicit current restriction, a complete first-party list that omits the option, or an adequately bounded test/source inspection of the named release.
7. Record conflicting evidence and resolve dates, plans and surfaces where possible. Older research provides leads and historical context, never automatic current values. Store announced changes separately with source, announcement date, affected criterion and stated target date if any. Recheck the announcement after a release; do not silently turn it into a shipped capability.
8. Submit a product profile, evidence ledger and screenshot record for an independent review. The reviewer checks criterion coverage, public wording, source sufficiency, screenshot provenance and equal treatment of every product. No comparative winner claim can exceed its evidence. Reviews are agent cross-checks by the publisher. A human audit of a sample from each research batch, with a published error rate, is planned and not yet in place.

### Shared scenarios

Research begins with documented capability coverage. Hands-on work uses the same small existing Git repository, acceptance criteria and environment manifest, with no real customer data. Inaccessible products still receive a full documented profile with observed fields marked unknown.

| Scenario | Procedure and evidence |
| --- | --- |
| Solo change | Import an existing repo, fix one test-backed bug, inspect the diff and prepare a draft PR. Record setup, interventions, result and cost dimensions. |
| Dependent parallel work | Give two workers independent edits and a third task that depends on both. Try a duplicate claim and one file conflict. Record enforcement, communication and integration behavior. |
| Requirement change | Amend an acceptance criterion during execution. Record plan changes, retained decisions, notifications and whether stale work is identified. |
| Recovery | Disconnect the client, then safely interrupt a worker and restart the service in a test environment. Record what continues, resumes, repeats or disappears. |
| Team handoff | A second authorized person reviews an artifact, denies one action, requests a change and approves the resulting revision. Record identity and policy behavior. |
| Unattended delivery | Trigger scheduled work, cause a failing check and approach a small budget limit. Record stopping, retries, attention requests and proof of completion. Stop at a draft PR or test deployment. |

Add these scenarios to the shared suite:

| Scenario | Procedure and evidence |
| --- | --- |
| Idea to epic | Park an idea without execution, discuss it with another human, refine acceptance criteria, start one task and grow it into dependent child work. Verify stable identity, readiness control and agent/human access to the same issues. |
| Overnight fleet and morning review | Use 12 disclosed task states and at least six reviewable outputs, with live work within a safe declared compute budget. Include a failed worker, hidden-approval trap and queued browser checks. Disconnect the laptop, return from another client, inspect correct status and batch-review a subset with retained evidence. Simulated UI fixtures do not prove runtime scale. |
| Living spec and colleague takeover | After a completed task, amend a product requirement; a second person takes over related ongoing work. Introduce an architecture/API conflict in a later change and test spec retrieval, review-time detection, history and context preservation. |
| Repository and onboarding variants | Attempt first work on a folder without Git, local Git without a remote and a connected hosted repo. Then provision remote execution using the documented supported path. Record enforced prerequisites, explanations, first-run permissions and setup/repair effort. |

Store the exact prompts, fixture commit, product configuration and harness/model versions. Do not grant one tool undocumented setup assistance without recording it. Feature availability and outcome quality are separate findings. Comparative speed or success-rate claims require repeated runs with a disclosed sample size and failures; a single demo only supports a case study.

Every observed scenario also records acceptance criteria met or missed, regressions, human interventions, time spent correcting the result, and final disposition. Independent checks assess the output, not just whether the product displayed a passing status. Unrun scenarios stay unknown. Separate end-to-end runs using each product's documented recommended configuration from experiments holding a harness/model constant. A product that cannot use the matched model remains eligible for the end-to-end comparison, with that limitation disclosed.

## Records and change history

A capability claim needs a stable ID, criterion ID and rubric version, product/surface scope, answer dimensions, limitations, evidence IDs, researcher, reviewer, dates and publication state. Evidence needs the original URL, title, locator, source kind, source date, retrieval date and concise finding. Tests also need method, configuration, fixture and result. Keep quotes short; do not copy entire vendor sites into the catalog or public assets.

A concise change record records old and new values, the reason, evidence, author, date and affected claim IDs. Distinguish product change, research correction, rubric change and freshness recheck. Preserve earlier records as history instead of silently overwriting the basis of published claims. A successful link check alone does not renew a claim's verification date.

### Freshness

Review intervals are 14 days for pricing, availability and fast-changing feature claims; 30 days for ordinary capabilities; and 90 days for stable architecture or license facts. These are maximum intervals, not guarantees. A release, pricing change, credible correction or product transition triggers earlier review.

## Framework changes

- **Public release, 2026-11:** Prepared for public release. No criterion or atomic question changed meaning.
- **Approval renewed, 2026-11-12:** The product scope, 51 criteria and evidence rules were reviewed and approved again as rubric v0.3. No criterion or atomic question changed meaning. Two evidence rules changed. A complete first-party list can now establish `unsupported` for the options it omits. The criterion-level support state is an internal answered-or-unknown marker and no longer appears in the public data. A human audit of sampled cross-checks is planned.

### Product lifecycle context

Lifecycle is a separate, optional product finding, outside the 51 capability criteria. Missing lifecycle data means unknown, never active. A scoped sunset notice can describe a company or hosted service while local open-source use continues. It does not imply that documented features stopped working or establish any runtime observation.

The catalog stores the notice, scope, continuation, announcement date, nullable exact service end date, source-check/review dates, evidence references and independent review. Relative transition periods remain source wording; do not infer a calendar deadline. Public notices require fresh resolved public evidence, no contradiction and an independent review bound to the notice and cited evidence. Changes invalidate that review. Agent formats show a compact sourced note and machine-readable status without changing criterion coverage or pair eligibility. See [publication/README.md](publication/README.md) for the shared lifecycle and sanitation contract; human presentation is authored separately.
