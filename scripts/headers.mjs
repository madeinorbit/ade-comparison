// Writes dist/_headers for the Cloudflare Workers static-assets host (wrangler.jsonc).
// The Content-Security-Policy allows inline scripts only by hash. The hashes are taken from the
// built HTML, so a changed inline script cannot ship with a stale policy.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Executable inline scripts: no src attribute and not a JSON data block.
const inlineScript = /<script\b(?![^>]*\bsrc=)(?![^>]*\btype="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g
// Cloudflare limits each _headers line to 2,000 characters.
const maxLine = 2000

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* htmlFiles(path)
    else if (entry.name.endsWith('.html')) yield path
  }
}

export function inlineScriptHashes(dir) {
  const hashes = new Set()
  for (const file of htmlFiles(dir)) {
    for (const match of readFileSync(file, 'utf8').matchAll(inlineScript)) {
      if (match[1].trim()) hashes.add(`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`)
    }
  }
  return [...hashes].sort()
}

export function headersFile(hashes) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    // Astro inlines every stylesheet (astro.config.mjs), and icons use data: SVGs in CSS.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
  const lines = [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  Strict-Transport-Security: max-age=31536000',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '',
    // Astro fingerprints these file names, so they never change in place.
    '/_astro/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    // ADE sheet fragments load inside the product dialog. robots.txt disallows them, but a
    // disallowed URL can still be indexed from links, so the header keeps it out of results.
    '/ade/:id/sheet/',
    '  X-Robots-Tag: noindex',
    '',
  ]
  const long = lines.find(line => line.length > maxLine)
  if (long) throw new Error(`_headers line is ${long.length} characters, above Cloudflare's ${maxLine}. Reduce the distinct inline scripts.`)
  return lines.join('\n')
}

export function writeHeaders(dir) {
  writeFileSync(join(dir, '_headers'), headersFile(inlineScriptHashes(dir)))
}
