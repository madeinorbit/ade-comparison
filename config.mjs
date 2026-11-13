// The public repository (https://github.com/madeinorbit/ade-comparison) is set at build time by
// the CI and deploy workflows. Unset, the site hides the GitHub submission links.
const repositorySetting = process.env.ADE_COMPARISON_PUBLIC_REPOSITORY_URL?.trim()
let publicRepositoryUrl = null
if (repositorySetting) {
  const message = 'ADE_COMPARISON_PUBLIC_REPOSITORY_URL must be https://github.com/OWNER/REPO, without credentials, a query or a fragment.'
  let repository
  try { repository = new URL(repositorySetting) } catch { throw new Error(message) }
  // Check the raw setting too: an empty ? or # parses to an empty search or hash and would swallow /issues/new.
  if (repository.origin !== 'https://github.com' || repository.username || repository.password || /[?#]/.test(repositorySetting) || /\.git\/?$/i.test(repository.pathname) || !/^\/[a-z0-9-]+\/[a-z0-9_.-]+\/?$/i.test(repository.pathname)) {
    throw new Error(message)
  }
  publicRepositoryUrl = repository.href.replace(/\/$/, '')
}

export const siteConfig = {
  name: 'adecomparison.com',
  baseUrl: process.env.ADE_COMPARISON_BASE_URL || 'https://adecomparison.com',
  publicRepositoryUrl,
  minimumPairFindings: 20,
  // Typed questions both products answer. Below this, a pair page is mostly Unknown.
  minimumPairSharedValues: 6,
  // Static pair pages grow with the square of the catalog. Build at most this many; every other
  // pair still opens in the Compare view from /compare/?products=a,b.
  maximumStaticPairs: 300,
  // Social sites cache a card by its image URL for days. Bump this after changing the card design so
  // new shares on X, LinkedIn or Slack fetch the new image instead of the cached one.
  ogImageVersion: 2,
}
const base = new URL(siteConfig.baseUrl)
if (!['http:', 'https:'].includes(base.protocol) || base.pathname !== '/') {
  throw new Error('ADE_COMPARISON_BASE_URL must be an HTTP(S) origin, without a path.')
}
export const absolute = (path) => new URL(path, siteConfig.baseUrl).href
