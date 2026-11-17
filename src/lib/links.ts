import type { Product } from './types.ts'

// The two outside links a product page offers: its code and its own site. Never the same address twice.
export interface ProductLinks { repository: string | null; homepage: string | null }

const GITHUB_REPO = /^https:\/\/(?:www\.)?github\.com\/[^/?#]+\/[^/?#]+\/?$/i
// Compare addresses without the differences that do not change the page: slash, www, case of the host, .git.
const same = (a: string, b: string) => {
  const norm = (u: string) => { try { const x = new URL(u); return `${x.hostname.replace(/^www\./i, '').toLowerCase()}${x.pathname.replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase()}${x.search}` } catch { return u } }
  return norm(a) === norm(b)
}
// Researched products carry a repository. For a listing, a website that is itself a GitHub repository
// is the repository, so it shows as GitHub and not as a homepage.
export function productLinks(product: Pick<Product, 'website' | 'repository'>): ProductLinks {
  const website = product.website?.trim() || null
  const repository = product.repository?.trim() || (website && GITHUB_REPO.test(website) ? website : null)
  const homepage = website && !(repository && same(website, repository)) ? website : null
  return { repository, homepage }
}
export const repositoryName = (url: string) => { try { return new URL(url).pathname.replace(/^\/|(\.git)?\/*$/gi, '') } catch { return url } }
