import type { APIRoute } from 'astro'
import { hasPage, products } from '../../lib/data'
import { png, productCard, siteCard } from '../../lib/og'
import type { Product } from '../../lib/types'
export function getStaticPaths() {
  // Plain listings share the site card: they are not search pages and have nothing of their own to show.
  return [{ params: { id: 'ade-comparison' }, props: { product: null } }, ...products.filter(hasPage).map(p => ({ params: { id: p.id }, props: { product: p } }))]
}
export const GET: APIRoute = async ({ props }) => {
  const product = props.product as Product | null
  return new Response(await png(product ? productCard(product) : siteCard()), { headers: { 'Content-Type': 'image/png' } })
}
