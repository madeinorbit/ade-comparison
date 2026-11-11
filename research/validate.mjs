#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogDir, loadProducts, validateProfile, validateRubric, criteria } from './lib.mjs';
import { loadScreenshotManifest, validateScreenshotLibrary } from './screenshot-library.mjs';

const paths = process.argv.slice(2);
const framework = readFileSync(resolve(catalogDir, 'comparison-framework.md'), 'utf8');
const errors = validateRubric(framework);
let products = [];
try {
  products = paths.length ? paths.map(path => JSON.parse(readFileSync(path, 'utf8'))) : existsSync(resolve(catalogDir, 'products')) ? loadProducts() : [];
} catch (error) { errors.push(error.message); }
const ids = new Set();
for (const product of products) {
  if (ids.has(product.id)) errors.push(`Duplicate product ID: ${product.id}`);
  ids.add(product.id);
  errors.push(...validateProfile(product));
}
if (!paths.length) {
  try {
    const registry = JSON.parse(readFileSync(resolve(catalogDir, 'registry.json'), 'utf8'));
    errors.push(...validateScreenshotLibrary(loadScreenshotManifest(), registry));
  } catch (error) { errors.push(`Screenshot library: ${error.message}`); }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const claims = products.flatMap(p => p.claims);
  console.log(`Validated ${products.length} profiles, ${claims.length} criterion records and ${criteria.length} shared criteria.`);
  if (!paths.length) console.log('Validated one sourced product screenshot for every full-profile tool.');
  console.log(`${claims.filter(c => c.support === 'unknown').length} criterion records remain unknown; coverage is not research completion.`);
}
