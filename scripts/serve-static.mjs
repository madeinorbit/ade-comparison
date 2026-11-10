import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, sep, extname } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.md': 'text/markdown', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.webp': 'image/webp', '.png': 'image/png' }
export function createStaticServer() {
  return createServer((req, res) => {
    let path
    try { path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)) } catch { res.writeHead(400); res.end(); return }
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403); res.end(); return }
    if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html')
    if (!existsSync(path) || !statSync(path).isFile()) { res.writeHead(404); res.end(); return }
    const body = readFileSync(path), type = types[extname(path)] || 'application/octet-stream'
    // Same order as the production CDN: Brotli for browsers that accept it, then gzip.
    const accepted = /(?:text|json|xml|svg)/.test(type) ? req.headers['accept-encoding'] || '' : ''
    const encoding = /\bbr\b/.test(accepted) ? 'br' : /gzip/.test(accepted) ? 'gzip' : null
    res.writeHead(200, { 'Content-Type': type, 'Vary': 'Accept-Encoding', ...(encoding ? { 'Content-Encoding': encoding } : {}), 'Cache-Control': path.includes('/_astro/') ? 'public,max-age=31536000,immutable' : 'no-cache' })
    res.end(encoding === 'br' ? brotliCompressSync(body) : encoding === 'gzip' ? gzipSync(body) : body)
  })
}
