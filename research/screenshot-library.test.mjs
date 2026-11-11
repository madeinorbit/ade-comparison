import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogDir } from './lib.mjs';
import { loadScreenshotManifest, validateScreenshotLibrary } from './screenshot-library.mjs';

const registry = JSON.parse(readFileSync(new URL('./registry.json', import.meta.url), 'utf8'));

test('every full profile has a sourced, intact screenshot', () => {
  assert.deepEqual(validateScreenshotLibrary(loadScreenshotManifest(), registry), []);
});

test('missing coverage and changed image digests are rejected', () => {
  const manifest = structuredClone(loadScreenshotManifest());
  const fullProfiles = new Set(registry.products.filter(product => product.researchTier === 'full-profile').map(product => product.id));
  manifest.screenshots.splice(manifest.screenshots.findIndex(screenshot => fullProfiles.has(screenshot.productId)), 1);
  manifest.screenshots[0].sha256 = '0'.repeat(64);
  const errors = validateScreenshotLibrary(manifest, registry, catalogDir).join('\n');
  assert.match(errors, /coverage is missing/);
  assert.match(errors, /SHA-256 does not match/);
  assert.match(errors, /visualReview SHA-256 must match/);
});

test('visual acceptance and documented fallbacks are required', () => {
  const manifest = structuredClone(loadScreenshotManifest());
  manifest.screenshots[0].visualStatus = 'unchecked';
  const fallback = manifest.screenshots.find(screenshot => screenshot.visualStatus === 'fallback');
  fallback.notes = 'No visual limitation recorded.';
  const errors = validateScreenshotLibrary(manifest, registry, catalogDir).join('\n');
  assert.match(errors, /invalid visualStatus/);
  assert.match(errors, /fallback note must name the limitation/);
});
