# Monthly catalog recheck

The handler covers every full profile and qualification/watch entry, in batches of at most 11 with an independent review. New and changed findings stay candidates until checked. Each source keeps its recorded dates; recommended recheck dates do not expire findings.

## Runtime setup

The code is prepared for a **native Podium recurring automation** on a Podium host. The ready configuration is `native-automation.json` and its full prompt is `native-prompt.md`. It uses a fresh session and Claude Code Opus 5.5 medium. Creation and activation of native recurring automations are operator-only; an agent must not use credentials or another transport to bypass that restriction. The JSON is deliberately disabled until the operator applies and enables it.

The cron expression is `0 9 1 * *`, the first day of every month at 09:00 in the Podium server's local timezone. Native Podium cron does not have a per-job timezone. The earlier cloud proposal used 09:00 UTC; record the native server timezone and displayed next-run time when enabling the replacement. The intended first run is 1 December 2026.

An earlier Claude Code cloud routine exists at https://claude.ai/code/routines/trig_01N6wqaEyqzzYMbNQWHVzg3w and is recorded in `routine.json`. Its sandbox has no authenticated Podium CLI, so it cannot file the research work. It reports BLOCKED rather than claiming a run succeeded. Disable that blocked cloud trigger when the native replacement is enabled; do not enable two working triggers for the same campaign.

## Commands

```sh
node research/catalog-recheck.mjs plan --month 2026-12
node research/catalog-recheck.mjs run --month 2026-12 --start
node research/catalog-recheck.mjs run --month 2026-12 --parent-id <open-issue> --dry-run
node research/catalog-recheck.mjs sync --month 2026-12 --commit <sha> --deploy-run <id>
```

A fresh scheduled session names its current user-assigned draft as the monthly issue. It does not create a Proposed issue and attempt to activate it, reuse a different real issue, or depend on the one-off setup issue remaining open. If the monthly issue already exists, the scheduled draft attaches to it before claiming the coordinator role. A closed campaign stays closed. An exact monthly title without the idempotency key is left unchanged and reported rather than duplicated. Manual runs from an existing real issue need an explicit open parent.

The first durable catalog manifest freezes the product enumeration for retries. Next month enumerates again. All tasks, the independent review and its dependency edges are filed before research starts. The scheduled session itself coordinates; it does not spawn a second copy of itself. New tasks inherit the requested agent/model/effort and start from current remote main.

The snapshot-sync command requires a commit on origin/main and a successful deploy containing it. Its task is a child of the active review issue, so it can run after this setup issue is closed. Human-page editorial approvals remain separate.

Focused tests cover enumeration, source dates, dry runs, interrupted retries, closed campaigns, duplicate and legacy titles, draft ownership, proposal refusal, the real CLI context envelope and model preferences. A native runtime connection and actual next-run metadata are still required before this trigger can be called operational.
