import { getInitials } from '../getInitials'

describe('getInitials', () => {
  it('should return initials for full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('should return initials for multiple words', () => {
    expect(getInitials('John Michael Doe')).toBe('JMD')
  })

  it('should handle single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('should handle null/undefined', () => {
    expect(getInitials(null)).toBe('')
    expect(getInitials(undefined)).toBe('')
  })

  it('should handle empty string', () => {
    expect(getInitials('')).toBe('')
    expect(getInitials('   ')).toBe('')
  })

  it('should handle non-string input', () => {
    // @ts-expect-error Testing invalid input
    expect(getInitials(123)).toBe('')
    // @ts-expect-error Testing invalid input
    expect(getInitials({})).toBe('')
  })

  it('should handle names with extra spaces', () => {
    expect(getInitials('  John   Doe  ')).toBe('JD')
  })

  it('should handle names with multiple spaces between words', () => {
    expect(getInitials('John   Doe')).toBe('JD')
  })
})