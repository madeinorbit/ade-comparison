import type { APIRoute } from 'astro'
import { index, notices, products } from '../../lib/data'
import { productMarkdown } from '../../lib/agent'
export function getStaticPaths() {
  return [
    { params: { file: 'index.json' }, props: { body: JSON.stringify(index), type: 'application/json' } },
    ...products.flatMap(product => [
      { params: { file: `${product.id}.json` }, props: { body: JSON.stringify({ ...product, lifecycleNotice: notices.find(n => n.productId === product.id) || null }), type: 'application/json' } },
      { params: { file: `${product.id}.md` }, props: { body: productMarkdown(product), type: 'text/markdown' } },
    ]),
  ]
}
export const GET: APIRoute = ({ props }) => new Response(props.body, { headers: { 'Content-Type': `${props.type}; charset=utf-8` } })
