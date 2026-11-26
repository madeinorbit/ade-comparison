# Small research batches

The outcome is a useful comparison with traceable facts, visible unknowns and original product images. More downloaded code, filled fields or agent sessions are not success measures.

## Research and review before integration

1. Choose five to ten products and the comparison questions that matter for this pass. Check existing findings, dates and gaps first. Investigate new or changed facts; do not re-research the published catalog.
2. Researchers read the existing checkout without changing it. Each owns a small packet directory such as `/tmp/ade-research/<batch>/<product>/`. A packet holds product identity, new evidence and claim patches, proposed filter mappings, scope/gaps, one original image with provenance, and a file checksum manifest. It does not contain a project checkout, dependencies, generated site data or a copy of another packet.
3. An independent reviewer checks those findings, citations, interpretations and original pixels. Preserve unchanged valid reviews. Authored corrections remain candidates until another reviewer accepts them; unresolved conflicts and unestablished facts remain visible. Do not run a third full research pass merely to increase badge counts.
4. Only after the batch packets are ready does one integration writer expand them into the existing full schema, apply the accepted data and prepare site media. Keep the current 51 criteria and frozen atomic keys; uninvestigated questions stay unknown. This workflow does not change the rubric or fabricate answers.
5. Commit one product and its regenerated outputs at a time, following the root instructions. Run the required clean-commit `npm run verify` once for the exact batch tip being pushed. Push a small batch, watch deployment and check the live result before publishing the next batch.

Research and review sessions must not create their own full project worktrees, install website dependencies, run catalog builders or copy the entire source cache. Use one integration workspace and one sequential builder. Ordinary builds, commits, deployment checks and cleanup are deterministic coordinator commands, not reasons to spawn more research agents.

## One source cache

Fetch pinned files and relevant documentation first. Prefer a few exact source files over a full repository archive. Record URL, commit/version or dated snapshot, file hash and locator. Share the same verified bytes between packets; interpret them independently.

`python3 scripts/research_cache.py fetch URL --pin COMMIT_OR_SNAPSHOT` stores a source once by URL/pin and deduplicates identical content. `python3 scripts/research_cache.py status` reports retained bytes. The cache defaults to `/tmp/ade-research-cache`, with a 20 MiB download limit and a 200 MiB retained-content budget. `ADE_RESEARCH_CACHE` selects another shared location. A larger explicit limit needs a recorded reason tied to a selected question, not a blanket download of all distributions.

For a necessary large application archive, retain one original and one extraction shared by the batch. Never download it once per citation or reviewer. Record the exact archive hash and inspected paths. Stop new large downloads when free disk falls below 20 GiB; inventory and reclaim completed work first.

Keep concise findings, relevant source files or excerpts, bounded-search receipts, pins and hashes. Do not copy whole sources into the public evidence ledger. A large local archive is a disposable working copy once the evidence needed for the findings is preserved in a durable artifact or reconstructible from its recorded immutable source.

## Model capability and reasoning effort

Local user model and effort instructions take precedence and stay outside this repository. Pass the permitted selection explicitly and check the actual runtime; never let an automatic profile silently choose a more expensive model.

| Work | Required capability and effort |
| --- | --- |
| Downloading, hashing, schema checks, builds, commits, deployment and cleanup | Use scripts and command output; no separate model session. |
| Extracting a dated fact or applying an approved packet | A capable economical model with bounded context; moderate reasoning is normally sufficient unless local instructions require more. |
| Conflicting evidence, implementation boundaries or security-sensitive interpretations | Strong code/evidence reasoning with high effort, limited to the concrete disputed question. |
| Independent review | A distinct reviewer, focused on the packet and relevant source locations; no repeated whole-catalog context. |

Record the batch scope, permitted model/effort, active sessions, storage budget and stop condition before launching work. Keep prompts small and refer to packet files instead of repeatedly embedding full histories and all rubric text. Do not start another cohort automatically when the user has asked to wrap up.

## Cleanup after each deployed batch

Preserve canonical records, original images, sparse packets, review receipts, source pins, relevant evidence and verification/deployment logs. Attach the small evidence bundle to its issue and verify its checksum before removing unique local material. Deferred drafts get their own durable packet and continuation reference.

Then stop completed sessions, remove only their owned dependency links, remove completed worktrees, and delete reconstructible downloads, duplicate archives, extractions, build scratch directories and abandoned temporary exports. Use an explicit path inventory, not a broad deletion of `/tmp` or another agent's cache. Check that no active process or remaining integration needs those paths. Keep the shared cache within its budget.

Record free disk before and after, bytes reclaimed, retained artifacts and any deliberate exceptions. Keep unrelated user edits, active work, credentials and shared dependency stores untouched. A batch is wrapped up when deployment is healthy and its storage cleanup is complete.
