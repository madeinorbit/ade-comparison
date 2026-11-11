import type { APIRoute } from 'astro'
import { products } from '../../../lib/data'
import { compareColumn } from '../../../lib/comparison'
// One small file per researched ADE. The Compare view fetches a column when someone adds that ADE,
// so /compare/ does not carry every product's cells and any pair opens without a static page.
export function getStaticPaths() { return products.filter(p => p.researchStatus === 'covered').map(p => ({ params: { id: p.id }, props: { product: p } })) }
export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(compareColumn(props.product)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
