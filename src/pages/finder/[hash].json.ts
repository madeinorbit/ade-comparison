import type { APIRoute } from 'astro'
import { finderHash, finderJson } from '../../lib/finder-payload'
export const getStaticPaths = () => [{ params: { hash: finderHash } }]
export const GET: APIRoute = () => new Response(finderJson, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
