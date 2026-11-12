# Contributing to adecomparison.com

Anyone can report wrong data or suggest a missing ADE. Vendors follow the same rules as everyone else, including Podium.

## Report wrong data

Use **Report wrong data** on an ADE page, a receipt or the Method page. The link opens a GitHub issue form in https://github.com/madeinorbit/ade-comparison. You need a GitHub account to submit it, and the issue is public. You can also choose the same form from the repository's New issue page.

Include all four:

- The product name.
- What is wrong and what it should say instead. Include the plan, version, operating system or surface when relevant.
- A public source URL that supports the correction.
- The exact sentence copied from that source. An adecomparison.com finding can summarize a source, so quote the source itself.

Documentation, public repositories and release announcements can be evidence. Word of mouth, private messages and a vendor's unsupported assertion cannot. Vendors get no exception. A missing mention does not establish that a feature is absent, and unknown never means no.

## Suggest a missing ADE

Use **Suggest a missing ADE** in the same places, or choose that form from the repository's New issue page. Name the missing product, link its website or official repository, explain what is missing, and supply a public source URL with its exact supporting sentence. If you opened the form from another ADE's page, the page context refers to that existing ADE. Fill in the missing product yourself.

A suggestion can lead to a plain directory listing. Capability claims need their own checked public evidence before they can appear in results or filters.

## How a correction reaches the site

1. A maintainer checks the public source, the quoted sentence and the product, plan, version and surface it covers. If the evidence is insufficient, the maintainer asks for a supporting public source in the issue.
2. The accepted correction or identity is recorded in the research catalog: a change to `research/products/<id>.json` (or `research/registry.json` for a new listing), with a change record that cites the new evidence. This can be a pull request from anyone or a maintainer commit that links the issue.
3. Findings pass the catalog's publication checks, including evidence ownership, review, scope and freshness. Typed filters also need a checked interpretation tied to eligible evidence in `research/directory/products/<id>.json`. No vendor bypasses these checks. `npm run research:validate` runs them.
4. `npm run data:build` regenerates `data/` from the catalog, and `npm run data:check` confirms that the package matches it. The static site builds from that package, and the maintainer links the resulting change in the issue.

Submitting an issue does not change the site automatically. There is no submission server in this app.

## The data package is generated

The files in `data/` are generated from `research/`. Make data corrections in the catalog and regenerate the package. Direct edits to `data/` fail `npm run data:check`, and a later rebuild would overwrite them. A code pull request can link a sourced correction issue without changing the generated data.

Code changes, documentation and tests can be proposed as pull requests. Run `npm run data:check`, `npm run research:validate`, `npm run test:research`, `npm run build`, `npm test` and `npm run check` before submitting one; CI runs the same checks plus the browser tests. See [docs/development.md](docs/development.md) for browser and portability checks.

## Public repository setup

The forms live in `.github/ISSUE_TEMPLATE/` and need Issues enabled and the templates on the default branch. `config.mjs` owns the single `siteConfig.publicRepositoryUrl` hook, read from the build-time `ADE_COMPARISON_PUBLIC_REPOSITORY_URL` environment variable. The CI and deploy workflows set it to the repository root, `https://github.com/madeinorbit/ade-comparison`. A fork that deploys its own copy sets it to its own repository root; never to an issue, form or private repository URL. Without it, the site shows one plain availability sentence per ADE page and on Method, in place of the submission links.

The links select a form and prefill page or receipt context. Correction links also prefill the current product. Public-source and exact-sentence fields stay empty for the contributor to fill. The forms require those fields and an evidence acknowledgment; maintainers still verify that the URL is public and that the sentence supports the request. Blank issues are disabled in the public template chooser.
