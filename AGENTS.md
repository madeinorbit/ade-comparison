# Agent instructions

Read this file before changing anything in this repository. It covers how to commit and push. What counts as good research is in [research/AGENTS.md](research/AGENTS.md); read that before touching `research/`. How the site builds and deploys is in [docs/development.md](docs/development.md).

## Pushing to main deploys the site

Every push to `main` runs `.github/workflows/deploy.yml`, which checks, builds and deploys https://adecomparison.com. If any check fails, nothing deploys, and later pushes from anyone stay blocked until main passes again. A commit that fails CI on main blocks everyone, so prevent it before pushing.

## Commit everything the generated files were built from

`data/`, `research/notes/review.json` and parts of `research/registry.json` and `research/screenshots/manifest.json` are generated or shared. CI rebuilds them from the files in the commit and fails if they differ. A rebuild on your machine reads every file on disk, committed or not. So:

- Commit the inputs with the outputs. A research commit contains the product's `research/products/<id>.json`, `research/directory/products/<id>.json` when it has typed mappings, `research/screenshots/<id>/home.*`, its registry and manifest entries, and the rebuilt `data/` and `research/notes/review.json`.
- One product per commit. Put nothing from another product in it.
- Before committing, run `git status`. An untracked or modified file under `research/` that belongs to another product means someone else's work is in your working tree. Do not rebuild shared files on top of it.
- Never hand-edit `data/` or `research/notes/review.json`. Regenerate them with `npm run data:build` and `node research/notes/review-summary.mjs`.

## Work in your own checkout

Parallel research passes in one working tree mix their changes to the shared files. Give each pass its own git worktree and branch (`git worktree add ../ade-<id> -b research/<id>`), and rebase onto `main` right before pushing.

## Verify a clean checkout before every push

```sh
npm run verify
```

`npm run verify` checks out the commit you are about to push into a throwaway worktree and runs the deploy checks there: `data:check`, `research:validate`, `test:research`, `build` and `test`. Files that exist only in your working tree are absent, exactly as in CI. Push only when it ends with `verify passed`. Passing checks in your own working tree are not enough.

## After pushing, watch the deploy

Check the run: `gh run list --workflow deploy.yml -L 1`, then `gh run watch <id> --exit-status`. If it fails, fix it at once or revert your commit (`git revert <sha>` and push). Do not leave main red.

## Commit messages

Say what changed and why in the subject. Name the product for research commits ("Add lody profile (fully reviewed)"). Keep any trailers your tooling requires.
