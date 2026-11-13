import type { APIRoute } from 'astro'
import { ademark } from '../../lib/benchmarks'
// The imported ADEMark summary, unchanged, with its source, licence and the product ID mapping.
export const GET: APIRoute = () => new Response(JSON.stringify(ademark), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
