import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkedAge, mayBeOutdated } from '../src/lib/age.ts'

test('checked dates have plain relative ages at each interval', () => {
  const asOf = '2026-11-07'
  for (const [date, label] of [['2026-11-07', 'checked today'], ['2026-11-06', 'checked yesterday'], ['2026-11-04', 'checked 3 days ago'], ['2026-10-31', 'checked 1 week ago'], ['2026-10-17', 'checked 3 weeks ago'], ['2026-09-07', 'checked 2 months ago'], ['2025-11-07', 'checked 1 year ago']]) {
    assert.equal(checkedAge(date, asOf), label)
  }
  assert.equal(checkedAge('bad-date', asOf), '')
})

test('only checks over six calendar months old may be outdated', () => {
  assert.equal(mayBeOutdated('2026-05-07', '2026-11-07'), false)
  assert.equal(mayBeOutdated('2026-05-06', '2026-11-07'), true)
  assert.equal(mayBeOutdated('2026-10-17', '2026-11-07'), false)
  assert.equal(mayBeOutdated('2026-08-31', '2027-02-28'), false)
  assert.equal(mayBeOutdated('2026-08-31', '2027-03-01'), true)
  assert.equal(mayBeOutdated('2023-08-31', '2024-02-29'), false)
  assert.equal(mayBeOutdated('2026-11-08', '2026-11-07'), false)
})
