import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { catalogDir } from './lib.mjs';

const provenanceValues = new Set(['first-party-marketing', 'first-party-docs', 'first-party-repository', 'first-party-release', 'self-captured']);
const captureKinds = new Set(['home', 'board', 'dashboard', 'workspace', 'task-detail']);
const taskStateCoverageValues = new Set(['multiple-states', 'several-tasks', 'single-task', 'not-applicable']);
const visualStatusValues = new Set(['accepted', 'fallback']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

export function loadScreenshotManifest(root = catalogDir) {
  return JSON.parse(readFileSync(resolve(root, 'screenshots/manifest.json'), 'utf8'));
}

export function validateScreenshotLibrary(manifest, registry, root = catalogDir) {
  const errors = [];
  if (manifest.schemaVersion !== 2) errors.push('Screenshot manifest must use schemaVersion 2.');
  if (!validDate(manifest.updatedAt)) errors.push('Screenshot manifest updatedAt must be a real YYYY-MM-DD date.');
  if (!Array.isArray(manifest.screenshots)) return [...errors, 'Screenshot manifest screenshots must be an array.'];

  const expectedIds = registry.products.filter(product => product.researchTier === 'full-profile').map(product => product.id);
  const registered = new Set(registry.products.map(product => product.id));
  const seen = new Set();
  for (const screenshot of manifest.screenshots) {
    const label = `Screenshot ${screenshot.productId ?? '<missing-id>'}`;
    if (!registered.has(screenshot.productId)) errors.push(`${label} is not a registered product.`);
    if (seen.has(screenshot.productId)) errors.push(`${label} is duplicated.`);
    seen.add(screenshot.productId);
    const extension = extname(screenshot.path ?? '').toLowerCase();
    if (!imageExtensions.has(extension) || screenshot.path !== `screenshots/${screenshot.productId}/home${extension}`) {
      errors.push(`${label} path must be screenshots/${screenshot.productId}/home.<image-extension>.`);
    }
    if (!validUrl(screenshot.sourcePage)) errors.push(`${label} needs an HTTP(S) sourcePage.`);
    if (screenshot.provenance === 'self-captured') {
      if (screenshot.assetUrl !== null) errors.push(`${label} self-capture assetUrl must be null, since no vendor asset was downloaded.`);
      const capture = screenshot.capture;
      if (!capture || !validDate(capture.capturedAt) || capture.capturedAt !== screenshot.retrievedAt ||
          !['version', 'platform', 'method', 'fixture'].every(key => typeof capture[key] === 'string' && capture[key].trim()) ||
          capture.credentials !== 'none') errors.push(`${label} self-capture needs its version, date, platform, method, fixture and credential-free configuration.`);
    } else if (!validUrl(screenshot.assetUrl)) errors.push(`${label} needs an HTTP(S) assetUrl.`);
    if (!validDate(screenshot.retrievedAt)) errors.push(`${label} retrievedAt must be a real YYYY-MM-DD date.`);
    if (!provenanceValues.has(screenshot.provenance)) errors.push(`${label} has an invalid provenance.`);
    if (!captureKinds.has(screenshot.captureKind)) errors.push(`${label} has an invalid captureKind.`);
    if (!taskStateCoverageValues.has(screenshot.taskStateCoverage)) errors.push(`${label} has an invalid taskStateCoverage.`);
    if (!visualStatusValues.has(screenshot.visualStatus)) errors.push(`${label} has an invalid visualStatus.`);
    if (typeof screenshot.notes !== 'string' || !screenshot.notes.trim()) errors.push(`${label} needs a concise note.`);
    if (screenshot.visualStatus === 'fallback' && !/fallback/i.test(screenshot.notes ?? '')) {
      errors.push(`${label} fallback note must name the limitation.`);
    }
    if (!/^[a-f0-9]{64}$/.test(screenshot.sha256 ?? '')) errors.push(`${label} needs a lowercase SHA-256 digest.`);
    if (!Number.isInteger(screenshot.bytes) || screenshot.bytes < 8_000) errors.push(`${label} must record an image size of at least 8,000 bytes.`);
    if (!screenshot.visualReview || typeof screenshot.visualReview !== 'object') {
      errors.push(`${label} needs a digest-bound visualReview.`);
    } else {
      if (typeof screenshot.visualReview.reviewer !== 'string' || !screenshot.visualReview.reviewer.trim()) {
        errors.push(`${label} visualReview needs a reviewer.`);
      }
      if (!validDate(screenshot.visualReview.reviewedAt)) errors.push(`${label} visualReview reviewedAt must be a real YYYY-MM-DD date.`);
      if (!/^[a-f0-9]{64}$/.test(screenshot.visualReview.sha256 ?? '') || screenshot.visualReview.sha256 !== screenshot.sha256) {
        errors.push(`${label} visualReview SHA-256 must match the reviewed image.`);
      }
    }

    const imagePath = resolve(root, screenshot.path ?? '');
    if (!existsSync(imagePath)) {
      errors.push(`${label} image is missing at ${screenshot.path}.`);
    } else {
      const bytes = readFileSync(imagePath);
      if (bytes.length !== screenshot.bytes) errors.push(`${label} byte count does not match the image.`);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== screenshot.sha256) errors.push(`${label} SHA-256 does not match the image.`);
    }
  }
  for (const id of expectedIds) if (!seen.has(id)) errors.push(`Screenshot coverage is missing full-profile product ${id}.`);
  return errors;
}
