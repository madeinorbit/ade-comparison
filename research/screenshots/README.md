# Screenshot library

`manifest.json` records downloaded originals and inspected product views. `coverage.json` records the 2026-11-07 pass across all 278 register identities, including the 57 full profiles. Its counts include accepted images only. A private fallback is a search gap, not accepted coverage.

Every accepted image has an exact presenting page, direct asset URL, retrieval date, byte count, SHA-256 and a visual review bound to those pixels. Notes identify the visible work and any vendor sample fixture. Official video and animation frames retain the source resolution and aspect ratio, with their timestamps in the notes. No third-party or generated images are accepted.

Self-captures use `provenance: "self-captured"`, `assetUrl: null` and a `capture` record with version, capture date, platform, method, local fixture and `credentials: "none"`. This means no external account or model credentials were used. The current OpenCode capture shows real local shell interaction, not a successful model run. A local server's temporary authentication secret is not published.

The site importer exports accepted images for any registered identity. It excludes every fallback and third-party entry, checks the source digest, and exports only public provenance. A self-capture adds its version and date; setup notes, fixture paths and reviewer identities remain private. Website WebP previews are bounded derivatives; the catalog keeps the original source pixels.

Run `node --test research/screenshot-library.test.mjs research/screenshots/contract.test.mjs` from the repository root. Catalog validation checks bytes and provenance for full profiles and every optional register image. It does not turn a documented fallback into a visual acceptance.
