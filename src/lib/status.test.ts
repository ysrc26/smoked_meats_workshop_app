import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getStatusAfterPaid } from './status'

test('pending becomes confirmed when paid true', () => {
  assert.equal(getStatusAfterPaid(true, 'pending'), 'confirmed')
})

test('confirmed remains confirmed when paid true', () => {
  assert.equal(getStatusAfterPaid(true, 'confirmed'), 'confirmed')
})

test('pending remains pending when paid false', () => {
  assert.equal(getStatusAfterPaid(false, 'pending'), 'pending')
})
