#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, resolve } from 'node:path';

const catalogDir = resolve(import.meta.dirname, '..');
const registry = JSON.parse(await readFile(resolve(catalogDir, 'registry.json'), 'utf8'));
const outputDir = resolve(process.argv[2] ?? resolve(tmpdir(), 'ade-screenshot-candidates'));
const products = registry.products.filter(product => product.researchTier === 'full-profile');

const decode = value => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#x27;', "'")
  .replaceAll('&#x2F;', '/');

function urlsFromHtml(html, pageUrl) {
  const values = [];
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi,
    /<(?:img|source)\b[^>]*?(?:src|srcset)=["']([^"']+)/gi,
    /url\(["']?([^)'"\s]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      for (const raw of decode(match[1]).split(',').map(part => part.trim().split(/\s+/)[0])) {
        if (!raw || raw.startsWith('data:')) continue;
        try { values.push(new URL(raw, pageUrl).href); } catch {}
      }
    }
  }
  return [...new Set(values)];
}

function score(url) {
  const value = url.toLowerCase();
  let points = 0;
  for (const [pattern, weight] of [
    [/screenshot|screen[-_]|dashboard|mission.control|kanban|board|tasks?|sessions?|thread|channel/, 18],
    [/hero|app[-_]|desktop|workspace|interface|terminal|agent|inbox|home/, 10],
    [/poster|demo|feature|workflow|overview|preview/, 5],
    [/logo|icon|avatar|favicon|wordmark|badge|customer|testimonial|portrait|headshot/, -30],
    [/background|texture|gradient|mascot|comic|profile|social|opengraph|og[-_.]/, -12],
    [/\.svg(?:[?#]|$)/, -20],
    [/\.gif(?:[?#]|$)/, 2],
  ]) if (pattern.test(value)) points += weight;
  return points;
}

function extension(contentType, url) {
  const type = contentType.split(';')[0].trim();
  const byType = new Map([
    ['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'],
    ['image/gif', '.gif'], ['image/avif', '.avif'],
  ]);
  return byType.get(type) ?? (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'].includes(extname(new URL(url).pathname).toLowerCase()) ? extname(new URL(url).pathname).toLowerCase() : null);
}

async function inspectProduct(product) {
  const pages = [];
  for (const sourceUrl of product.sources) {
    try {
      const response = await fetch(sourceUrl, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ade-comparison-research/1.0)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) { pages.push({ sourceUrl, status: response.status, candidates: [] }); continue; }
      const html = await response.text();
      pages.push({
        sourceUrl,
        finalUrl: response.url,
        status: response.status,
        candidates: urlsFromHtml(html, response.url).map(url => ({ url, score: score(url) })),
      });
    } catch (error) {
      pages.push({ sourceUrl, error: error.message, candidates: [] });
    }
  }

  const candidates = [...new Map(pages.flatMap(page => page.candidates).map(item => [item.url, item])).values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const productDir = resolve(outputDir, product.id);
  await mkdir(productDir, { recursive: true });
  const downloads = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      const response = await fetch(candidate.url, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ade-comparison-research/1.0)' },
        signal: AbortSignal.timeout(25_000),
      });
      const kind = response.headers.get('content-type') ?? '';
      const suffix = extension(kind, response.url);
      if (!response.ok || !suffix) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 8_000 || bytes.length > 15_000_000) continue;
      const shortHash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
      const filename = `${String(index + 1).padStart(2, '0')}-${shortHash}${suffix}`;
      await writeFile(resolve(productDir, filename), bytes);
      downloads.push({ ...candidate, finalUrl: response.url, filename, bytes: bytes.length, contentType: kind.split(';')[0] });
    } catch {}
  }
  return { id: product.id, name: product.name, pages, downloads };
}

await mkdir(outputDir, { recursive: true });
const results = [];
for (let index = 0; index < products.length; index += 6) {
  results.push(...await Promise.all(products.slice(index, index + 6).map(inspectProduct)));
  process.stderr.write(`Checked ${Math.min(index + 6, products.length)}/${products.length}\n`);
}
await writeFile(resolve(outputDir, 'candidates.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`Saved candidate assets and provenance to ${outputDir}`);
