import { expect, test } from 'bun:test'
import { avatarColor, initials, isBot } from './avatar'

test('initials take the first and last word', () => {
  expect(initials('Sandip Patel')).toBe('SP')
  expect(initials('ZyroK')).toBe('ZY')
  expect(initials('space-v')).toBe('SV')
  expect(initials('')).toBe('?')
})

test('bots and stable colors', () => {
  expect(isBot('github-actions[bot]', '41898282+github-actions[bot]@users.noreply.github.com')).toBe(true)
  expect(isBot('Copilot', '198982749+Copilot@users.noreply.github.com')).toBe(false)
  expect(avatarColor('a@x')).toBe(avatarColor('A@X'))
})
