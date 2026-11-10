import type { APIRoute } from 'astro'
import { absolute } from '../../config.mjs'
export const GET: APIRoute = () => new Response(`User-agent: *\nAllow: /\nDisallow: /ade/*/sheet/\nSitemap: ${absolute('/sitemap.xml')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
