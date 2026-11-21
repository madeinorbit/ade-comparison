# Monthly catalog recheck

The user chose a monthly recheck of the whole catalog. A Claude Code cloud routine (`routine.json`, ID `trig_01N6wqaEyqzzYMbNQWHVzg3w`) fires on the first day of each month at 09:00 UTC, starting 2026-12-01. Manage it at https://claude.ai/code/routines/trig_01N6wqaEyqzzYMbNQWHVzg3w. The routine runs the prompt in `routine-prompt.md`, which calls the handler:

```sh
node research/catalog-recheck.mjs plan --month 2026-12             # read-only enumeration
node research/catalog-recheck.mjs run  --month 2026-12 --dry-run   # show what would be filed
node research/catalog-recheck.mjs run  --month 2026-12 --start     # resume or file, then start the coordinator
node research/catalog-recheck.mjs sync --month 2026-12 --commit <sha> --deploy-run <id>
```

- **Idempotency.** The key `ade-catalog-recheck:YYYY-MM` is written into the brief of one `Catalog recheck YYYY-MM` issue (by default under PDM-257). A rerun finds that issue, including a closed one, and resumes it. Batches, the review and its dependency edges are matched by title, so a rerun never duplicates them.
- **Enumeration.** The first run reads `research/products/*.json` and the qualification/watch entries in `registry.json` at the current commit. It attaches the result as `catalog-manifest.json`. A retry reuses that frozen manifest. Next month's run enumerates again, so new profiles are included.
- **Order.** Batches of at most 11 products are filed first, then one independent review task that waits on every batch. The handler confirms every task exists before it starts the coordinator session.
- **Evidence age.** The handler never writes research files. It reports each profile's oldest `checkedAt` and how many claims are past `nextReviewAt`. Task briefs forbid restamping, extending or expiring dates.
- **Podium sync.** `sync` files the podium-cloud snapshot task only for a commit that is on `origin/main` and contained in a successful deploy run.

The cloud sandbox has no authenticated Podium CLI. There, `run` exits with code 3 and prints `BLOCKED`, having filed nothing. Running the same command on a Podium host files the month safely. `catalog-recheck.test.mjs` covers dry runs, resume after a crash, closed months, duplicate detection and the blocker path.
