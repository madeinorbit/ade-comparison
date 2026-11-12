import type { APIRoute } from 'astro'
import { pairs } from '../../../lib/data'
import { pairCard, png } from '../../../lib/og'
export function getStaticPaths() { return pairs.map(p => ({ params: { pair: p.slug }, props: { pair: p } })) }
export const GET: APIRoute = async ({ props }) => new Response(await png(pairCard(props.pair.slug, props.pair.products)), { headers: { 'Content-Type': 'image/png' } })
