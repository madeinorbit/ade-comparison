import { absolute, siteConfig } from '../../config.mjs'
import type { Identity } from './types.ts'

export interface SubmissionContext {
  pagePath: string
  product?: Pick<Identity, 'id' | 'name'>
  receipt?: string
}

// Field names match the ids in .github/ISSUE_TEMPLATE. Never prefill evidence:
// a published finding may summarize a source rather than quote it verbatim.
export function submissionLinks(context: SubmissionContext, repositoryUrl: string | null = siteConfig.publicRepositoryUrl) {
  if (!repositoryUrl) return null
  const location = [absolute(context.pagePath), context.product && `Product: ${context.product.name} (${context.product.id})`, context.receipt && `Receipt: ${context.receipt}`].filter(Boolean).join('\n')
  // Without a title the form keeps its own prefix, ready for the contributor to finish.
  const issueUrl = (template: string, fields: Record<string, string> = {}) => {
    const url = new URL(`${repositoryUrl}/issues/new`)
    url.search = new URLSearchParams({ template, context: location, ...fields }).toString()
    return url.href
  }
  return {
    reportWrongData: issueUrl('report-wrong-data.yml', context.product ? { title: `Data correction: ${context.product.name}`, product: context.product.name } : {}),
    // The ADE being suggested is intentionally blank, even on an existing ADE page.
    suggestMissingAde: issueUrl('suggest-missing-ade.yml'),
  }
}
