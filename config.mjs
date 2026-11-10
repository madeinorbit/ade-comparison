// The public repository is undecided. Leave this unset until it is available.
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
  name: 'ade-comparison.com',
  baseUrl: process.env.ADE_COMPARISON_BASE_URL || 'https://ade-comparison.com',
  publicRepositoryUrl,
  minimumPairFindings: 20,
  // Typed questions both products answer. Below this, a pair page is mostly Unknown.
  minimumPairSharedValues: 6,
}
const base = new URL(siteConfig.baseUrl)
if (!['http:', 'https:'].includes(base.protocol) || base.pathname !== '/') {
  throw new Error('ADE_COMPARISON_BASE_URL must be an HTTP(S) origin, without a path.')
}
export const absolute = (path) => new URL(path, siteConfig.baseUrl).href
