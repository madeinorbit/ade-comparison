import type { APIRoute } from 'astro'
import sharp from 'sharp'
import ogStyles from '../../styles/og.css?raw'
import { hasPage, notices, products } from '../../lib/data'
import { escapeHtml } from '../../lib/view'
export function getStaticPaths() {
  // Plain listings share the site card: they are not search pages and have nothing of their own to show.
  const cards = products.filter(hasPage)
  return [{ params: { id: 'ade-comparison' }, props: { name: 'ade-comparison.com', note: 'Find an ADE that fits how you work.' } }, ...cards.map(p => ({ params: { id: p.id }, props: { name: p.name, note: notices.some(n => n.productId === p.id) ? 'Published shutdown notice, with sources.' : 'Public findings, with receipts.' } }))]
}
// Social crawlers do not render SVG, and librsvg does not read custom properties.
const styles = ogStyles
export const GET: APIRoute = async ({ props }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><style>${styles}</style><rect class="og-paper" width="1200" height="630"/><rect class="og-mark" x="1072" y="56" width="64" height="64"/><rect class="og-field" y="606" width="1200" height="24"/><text x="64" y="96" class="og-brand">ade-comparison.com</text><text x="64" y="280" class="og-name ${props.name.length > 28 ? 'og-name-long' : ''}">${escapeHtml(props.name)}</text><text x="64" y="365" class="og-note">${escapeHtml(props.note)}</text><text x="64" y="550" class="og-credit">Made by Podium, an ADE vendor</text></svg>`
  return new Response(new Uint8Array(await sharp(Buffer.from(svg)).png({ palette: true }).toBuffer()), { headers: { 'Content-Type': 'image/png' } })
}
