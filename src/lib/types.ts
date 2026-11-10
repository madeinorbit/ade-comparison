export type Verification = 'sourced' | 'agent-cross-checked' | 'unknown'
export interface Cell {
  value: string
  verificationStatus: Verification
  claimId: string | null
  evidenceIds: string[]
  checkedAt: string | null
  crossCheckedAt: string | null
  nextCheckAt: string | null
}
export interface Source {
  id: string; productId: string; kind: string; url: string; title: string
  locator: string; sourceDate: string | null; retrievedAt: string; finding: string
}
export interface Claim {
  productId: string; claimId: string; verificationStatus: Verification
  support: string; answer: string; availability: string; delivery: string
  scope: { plan: string | null; version: string | null; os: string[]; executionModes: string[]; region: string | null; harness: string | null; surfaceIds: string[]; surfaces: { id: string; name: string; type: string }[] }
  questions: { id: string; question: string; support: string; answer: string; evidenceIds: string[] }[]
  limitations: string[]; checkedAt: string; crossCheckedAt: string | null; nextCheckAt: string; evidenceIds: string[]
}
export interface Identity { id: string; name: string; website: string | null; researchStatus: 'covered' | 'not-researched'; formerNames?: string[] }
export interface Product extends Identity {
  repository?: string | null; facets?: Record<string, Cell | Record<string, Cell>>
  claims?: Claim[]; sources?: Source[]; lifecycle?: { status: string; note: string | null }
  sourcedClaimCount?: number; crossCheckedClaimCount?: number
  oldestCheckedAt?: string | null; lastCheckedAt?: string | null
}
export interface Facet { id: string; label: string; type: 'tri-state' | 'enum'; multiple?: boolean; options?: { id: string; label: string }[]; description: string }
export interface Requirement { key: string; label: string; facetId: string; option: string | null; description: string; anyOf?: string[] }
export interface Index { schemaVersion: number; generatedAt: string; products: Identity[]; bitsets: { encoding: string; bitOrder: string; rowOrder: string; unknown: string; columns: Record<string, { yes: string; no: string; crossChecked: string }> } }
export interface LifecycleNotice {
  productId: string; status: string; note: string; evidenceIds: string[]; checkedAt: string
  dates?: { date: string; label?: string; event?: string; surface?: string; surfaceIds?: string[] }[]
  continuation?: string | null; facet: Cell; sources: Source[]
  [key: string]: unknown
}
export interface StatusEvent { id: string; productId: string; date: string; type: string; claimIds: string[]; evidenceIds: string[] }
export interface Screenshot { productId: string; path: string; width: number; height: number; sourcePage: string; retrievedAt: string; provenance: string; visualStatus: string; capture?: { version: string; capturedAt: string } }
