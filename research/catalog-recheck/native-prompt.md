Monthly whole-catalog recheck for madeinorbit/ade-comparison. The user authorized monthly checks of the whole catalog on 2026-11-11. Use Claude Code Opus 5.5 medium for the coordinator and research delegates.

Start by reading podium issue prime and the repository AGENTS.md and research/AGENTS.md. This native scheduled session must run on a Podium host with the authenticated Podium CLI and a fresh user-assigned draft. Do not rename a real issue or activate a Proposed issue.

Fetch origin/main using git -C; preserve the shared repository working tree. Create an isolated worktree from origin/main and invoke its research/catalog-recheck.mjs with an absolute path, from the original CLI working directory:

  node <isolated-worktree>/research/catalog-recheck.mjs run --month <current-UTC-YYYY-MM> --start

The handler names this scheduled draft as Catalog recheck YYYY-MM, files the frozen catalog manifest, all batches and independent review, and claims this session as coordinator. A retry attaches to the existing open campaign; an existing closed campaign or unkeyed monthly title is reported without duplication. A missing or unauthenticated Podium runtime is a blocker, never a reason to mint credentials or bypass permissions.

After filing, continue as the monthly coordinator. Register and use your own issue worktree if integrating files; never change another checkout or the shared main branch working tree. Start the already-filed research batches in turn with at most three active delegates. Each gets its own issue worktree, bounded product list, Opus 5.5 medium, source rules and mail route to you. Keep candidate facts separate from independent acceptance; independently review every changed claim, screenshot and typed mapping. Preserve source dates and explicit unknowns. Findings do not expire.

Commit one product and its generated outputs at a time. Run npm run verify on the final clean commit before pushing, use the repository main merge mutex, and observe the deploy. After reviewed upstream changes deploy, use the handler sync command from the active review issue to file the Podium snapshot task as its child. Do not automatically approve human comparison pages. Keep monthly progress in the issue, close accepted child tasks, and bring the completed campaign to review for the user. Do not post external comments or messages.
