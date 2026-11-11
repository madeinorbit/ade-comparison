import { loadProducts, catalogDir, schema } from '../lib.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildPublicationFromProfiles } from './build.mjs'

const privateFields = new Set([
  'researcher', 'reviewer', 'author', 'publication', 'publicationStatus',
  'review', 'contentHash', 'researchState', 'researchTier', 'scopeNote',
  'context', 'roadmapReview', 'unknownReason', 'contradictions', 'visibility',
  'before', 'after', 'affectedPages', 'aliases', 'company', 'origin', 'category',
])
// Local home directories, worktrees, private tailnet hosts and asset links never belong in public data.
// ADE_COMPARISON_PRIVATE_MARKERS can add a maintainer's own patterns (a regular expression source),
// such as private issue-tracker IDs, without naming them in this public repository.
const extraMarkers = process.env.ADE_COMPARISON_PRIVATE_MARKERS?.trim()
const internalMarkers = new RegExp([
  String.raw`internal-file:|file:\/\/|\/home\/[^/\s]+\/|\/Users\/[^/\s]+\/|[a-z]:\\users\\|\.worktrees\/|\.ts\.net|\/files\/asset\?`,
  ...(extraMarkers ? [extraMarkers] : []),
].join('|'), 'i')
const walk = (value, visit, path = '$') => {
  if (typeof value === 'string') visit(value, path)
  else if (Array.isArray(value)) value.forEach((item, i) => walk(item, visit, `${path}[${i}]`))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    visit(key, `${path}.${key}`, true)
    walk(item, visit, `${path}.${key}`)
  }
}

// Typography and spacing must not hide a private sentence from the comparison.
const normalize = text => text.normalize('NFKC').replace(/[​-‍⁠﻿]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase()
const isWordCharacter = character => character !== undefined && /[\p{L}\p{N}]/u.test(character)
const containsPhrase = (text, phrase) => {
  for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + 1)) {
    if (!isWordCharacter(text[at - 1]) && !isWordCharacter(text[at + phrase.length])) return true
  }
  return false
}
const collectEnums = (node, found = new Set()) => {
  if (Array.isArray(node)) node.forEach(item => collectEnums(item, found))
  else if (node && typeof node === 'object') for (const [key, item] of Object.entries(node)) {
    if (key === 'enum') item.forEach(value => typeof value === 'string' && found.add(value))
    collectEnums(item, found)
  }
  return found
}

// Dates, URLs, schema enums and record IDs in private history are structure, not
// prose. A word like "sunset" or a date in a change record says nothing private,
// and treating it as private text makes the scan fail once findings expire.
const structuralTokens = (profiles, registry, vocabulary) => {
  const tokens = new Set([...collectEnums(schema), ...registry.map(entry => entry.id), ...vocabulary])
  for (const profile of profiles) {
    tokens.add(profile.id)
    for (const claim of profile.claims) tokens.add(claim.id).add(claim.criterionId)
    for (const surface of profile.surfaces) tokens.add(surface.id)
    for (const evidence of profile.evidence) tokens.add(evidence.id).add(`${profile.id}:${evidence.id}`)
  }
  return new Set([...tokens].map(normalize))
}
const isStructural = (text, tokens) => /^\d{4}-\d{2}-\d{2}(?:T\S*)?$/.test(text.trim()) ||
  /^https?:\/\/\S+$/.test(text.trim()) || tokens.has(normalize(text))
// Short common phrases legitimately recur in authored public text. A whole-field
// copy of one still fails. Inside longer text, match only what identifies a source.
const isDistinctive = phrase => phrase.split(' ').length >= 6 || /\d/.test(phrase)

// This check lives at the private publication boundary. The directory builder
// passes its output in and receives no profiles, private strings or identities.
// `vocabulary` names exact public IDs and labels. It stops them counting as private
// words; it never exempts a sentence, so authored descriptions are still scanned.
export function assertPublicationSafe(value, {
  date, profiles = loadProducts(),
  registry = JSON.parse(readFileSync(resolve(catalogDir, 'registry.json'), 'utf8')).products,
  privateRecords = [], vocabulary = [], directory = false,
} = {}) {
  const names = new Set()
  for (const record of [...profiles, ...privateRecords]) walk(record, (text, path, key) => {
    if (!key && /\.(researcher|reviewer|author)$/.test(path)) names.add(text)
  })
  const publicStrings = new Set()
  walk(buildPublicationFromProfiles(profiles, { date, format: 'products', registry, directory }), (text, _path, key) => {
    if (!key) publicStrings.add(text)
  })
  const structural = structuralTokens(profiles, registry, vocabulary)
  const internalStrings = new Set()
  const remember = record => walk(record, (text, _path, key) => {
    if (!key && text.trim() && !publicStrings.has(text) && !isStructural(text, structural)) internalStrings.add(text)
  })
  // Everything outside the gate-approved output is private on this date, which
  // includes expired, contradicted and unreviewed candidates and uncited sources.
  for (const profile of profiles) {
    remember({ context: profile.context })
    for (const claim of profile.claims) {
      remember({ answer: claim.answer, unknownReason: claim.unknownReason,
        limitations: claim.limitations, contradictions: claim.contradictions,
        scope: [claim.scope.version, claim.scope.plan, claim.scope.region, claim.scope.harness],
        answers: Object.values(claim.subanswers).map(answer => answer.answer) })
    }
    for (const evidence of profile.evidence) remember({
      url: evidence.url, title: evidence.title, locator: evidence.locator, finding: evidence.finding,
      method: evidence.method, configuration: evidence.configuration, fixture: evidence.fixture, result: evidence.result,
    })
    if (profile.lifecycle) remember({
      note: profile.lifecycle.note, scope: profile.lifecycle.scope, continuation: profile.lifecycle.continuation,
      contradictions: profile.lifecycle.contradictions,
    })
    for (const change of profile.changes) remember({ summary: change.summary, before: change.before, after: change.after })
  }
  for (const record of privateRecords) walk(record, (text, path, key) => {
    if (!key && /\.(?:rationale|note)$/.test(path)) remember(text)
  })
  for (const entry of registry) if (entry.scopeNote) remember(entry.scopeNote)
  const privateNames = [...names].filter(Boolean).map(normalize)
  // Stock gap wording can occur in both private and eligible public findings.
  // Only text absent from the gate-approved output is an internal-only marker.
  const approvedText = [...publicStrings].map(normalize).join('\0')
  const privateText = new Set([...internalStrings].map(normalize).filter(text => !approvedText.includes(text)))
  const privatePhrases = [...privateText].filter(isDistinctive)
  walk(value, (text, path, key) => {
    if (key && privateFields.has(text)) throw new Error(`Private field in public package at ${path}`)
    if (key) return
    if (internalMarkers.test(text)) {
      throw new Error(`Internal URL or path in public package at ${path}`)
    }
    const normalized = normalize(text)
    if (privateNames.some(name => normalized.includes(name))) throw new Error(`Private identity in public package at ${path}`)
    if (publicStrings.has(text)) return
    if (privateText.has(normalized) || privatePhrases.some(secret => containsPhrase(normalized, secret))) throw new Error(`Internal-only text in public package at ${path}`)
  })
}
