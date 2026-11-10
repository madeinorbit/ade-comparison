import type { APIRoute } from 'astro'
const files = import.meta.glob('../../../data/*.json', { eager: true, import: 'default' })
export function getStaticPaths() { return Object.entries(files).map(([path, value]) => ({ params: { file: path.split('/').at(-1) }, props: { value } })) }
export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.value), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
