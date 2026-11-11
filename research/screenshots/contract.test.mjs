import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadScreenshotManifest, validateScreenshotLibrary } from '../screenshot-library.mjs';

const registry = JSON.parse(readFileSync(new URL('../registry.json', import.meta.url)));

test('registered listings can have images without becoming full profiles', () => {
  const manifest = loadScreenshotManifest();
  assert.ok(manifest.screenshots.some(image => registry.products.some(product => product.id === image.productId && product.researchTier !== 'full-profile')));
  assert.deepEqual(validateScreenshotLibrary(manifest, registry), []);
});

test('third-party provenance and image path traversal are rejected', () => {
  const manifest = loadScreenshotManifest();
  manifest.screenshots[0].provenance = 'third-party-fallback';
  manifest.screenshots[0].path = `screenshots/${manifest.screenshots[0].productId}/home.png/../../outside.png`;
  const errors = validateScreenshotLibrary(manifest, registry).join('\n');
  assert.match(errors, /invalid provenance/);
  assert.match(errors, /path must be/);
});

test('self-captures require the version, fixture, method and credential-free date record', () => {
  const manifest = loadScreenshotManifest();
  const entry = manifest.screenshots[0];
  entry.provenance = 'self-captured';
  entry.assetUrl = null;
  entry.capture = { version: 'fixture-1.0', capturedAt: entry.retrievedAt, platform: 'Linux', method: 'Browser screenshot', fixture: 'Local sample repository', credentials: 'none' };
  assert.deepEqual(validateScreenshotLibrary(manifest, registry), []);
  entry.capture.credentials = 'external-account';
  assert.match(validateScreenshotLibrary(manifest, registry).join('\n'), /credential-free configuration/);
});
