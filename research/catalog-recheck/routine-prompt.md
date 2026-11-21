Monthly ADE catalog recheck trigger for madeinorbit/ade-comparison.

This scheduled session only resumes or files the month's tracker work. It does no product research and changes nothing in the repository.

1. Let MONTH be the current UTC month: `MONTH=$(date -u +%Y-%m)`. The idempotency key is `ade-catalog-recheck:$MONTH`.
2. Use the current upstream catalog: `git fetch origin main && git checkout --detach origin/main`.
3. If `research/catalog-recheck.mjs` is missing on main (the handler has not merged yet), take only the handler files from its branch, leaving the catalog at main: `git fetch origin issue/26-monthly-ade-recheck-trigger && git checkout FETCH_HEAD -- research/catalog-recheck.mjs research/catalog-recheck/config.json`.
4. Print the plan: `node research/catalog-recheck.mjs plan --month "$MONTH"`.
5. Resume or file the month: `node research/catalog-recheck.mjs run --month "$MONTH" --start`.
   - Exit 0: report the JSON result line (issue ref, whether it resumed, number of tasks).
   - Exit 3 (BLOCKED): report the blocker line verbatim, the plan summary from step 4 and the upstream commit. Stop. A Podium operator files the month later by running the same `run` command on a Podium host. The key makes that safe to repeat.
   - Any other exit: report the error verbatim and stop.

Do not edit, commit or push files, open pull requests or GitHub issues, or send messages to any service. Do not try to obtain, mint or guess Podium credentials. Do not change evidence dates.
