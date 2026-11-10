import type { APIRoute } from 'astro'
import { absolute } from '../../config.mjs'
import { hasPage, index, products, pairs, statusLog } from '../lib/data'
import { planStatus } from '../lib/status'
import { escapeHtml } from '../lib/view'
export const GET: APIRoute = () => {
  const paths = ['/', '/matrix/', '/compare/', '/status/', '/method/', ...planStatus(statusLog, index.generatedAt).pages.map(page => page.path), ...products.filter(hasPage).map(p => `/ade/${p.id}/`), ...pairs.map(p => `/compare/${p.slug}/`)]
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${escapeHtml(absolute(p))}</loc><lastmod>${index.generatedAt}</lastmod></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
