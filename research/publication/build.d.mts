export const publicationConfig: any
export const publicationDate: () => string
export const publicationDateVariables: string[]
export const publicationDateOverride: () => [string, string]
export const buildPublication: (options?: { date?: string; format?: 'pairs' | 'products'; directory?: boolean }) => any
export const buildPublicationFromProfiles: (profiles: any[], options?: { date?: string; format?: 'pairs' | 'products'; registry?: any[]; directory?: boolean }) => any
export const pairToMarkdown: (pair: any) => string
export const indexToMarkdown: (publication: any) => string

export type PublicLifecycle<CrossCheck extends string | null = string> = { status: 'unknown'; note: null } | {
  status: 'sunset'
  note: string
  scope: string
  continuation: string | null
  announcementDate: string | null
  serviceEndDate: string | null
  checkedAt: string
  crossCheckedAt: CrossCheck
  nextCheckAt: string
  evidenceIds: string[]
}
export function publicLifecycle(profile: any, date?: string): PublicLifecycle
export function publicLifecycle(profile: any, date: string | undefined, options: { allowOverdue?: boolean; allowSourced?: false }): PublicLifecycle
export function publicLifecycle(profile: any, date: string | undefined, options: { allowOverdue?: boolean; allowSourced?: boolean }): PublicLifecycle<string | null>
export const lifecycleNotice: (product: { name: string; lifecycle: PublicLifecycle }) => string | null
export const lifecycleToHtml: (product: { name: string; lifecycle: PublicLifecycle }) => string
