import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility function', () => {
  it('merges class names correctly', () => {
    const result = cn('px-4', 'py-2')
    expect(result).toBe('px-4 py-2')
  })

  it('handles conditional classes', () => {
    const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
    expect(result).toBe('base-class conditional-class')
  })

  it('merges Tailwind classes correctly (deduplicates)', () => {
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toBe('py-1 px-4')
  })

  it('handles undefined and null values', () => {
    const result = cn('valid-class', undefined, null, 'another-class')
    expect(result).toBe('valid-class another-class')
  })

  it('handles empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('handles arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('handles objects with conditional classes', () => {
    const result = cn({
      'always-on': true,
      'always-off': false,
      'conditional': 1 > 0,
    })
    expect(result).toBe('always-on conditional')
  })
})
