import { describe, it, expect } from 'vitest'
import { wrappedLines } from './excelStyle'

/**
 * These are the exact strings that came out clipped in real portfolio reports. An earlier
 * estimate assumed `width * 1.8` characters fit on a line and divided rather than word-wrapping,
 * so each of these was sized at one line and cut off mid-word.
 */
describe('wrappedLines', () => {
  it('wraps a facility name that does not fit its column', () => {
    // 45 characters in a 34-wide column: the division says 1, Excel needs 2.
    expect(wrappedLines('Lilac Manor Rehabilitation and Nursing Center', 34)).toBe(2)
    expect(wrappedLines('The Grand Rehabilitation and Nursing at Batavia', 34)).toBe(2)
    expect(wrappedLines('Fairport Rehabilitation and Nursing Center', 34)).toBe(2)
  })

  it('wraps long addresses and ownership strings', () => {
    expect(wrappedLines('4646 Fairport Nine Mile Point Road', 26)).toBe(2)
    expect(wrappedLines('For profit - Limited Liability company', 26)).toBe(2)
  })

  it('leaves short values on one line', () => {
    expect(wrappedLines('Rochester', 16)).toBe(1)
    expect(wrappedLines('96.1%', 11)).toBe(1)
    expect(wrappedLines('', 12)).toBe(1)
  })

  it('breaks at word boundaries, not at a character count', () => {
    // Two 9-letter words in a 12-wide column cannot share a line even though 19 < 24.
    expect(wrappedLines('alphabetic alphabetic', 12)).toBe(2)
  })

  it('splits a single word longer than the column', () => {
    expect(wrappedLines('A'.repeat(70), 34)).toBe(3)
  })

  it('honours explicit newlines', () => {
    expect(wrappedLines('one\ntwo\nthree', 40)).toBe(3)
  })

  it('never returns less than one line', () => {
    expect(wrappedLines('   ', 10)).toBe(1)
  })

  // Headers wrap too; "Special Focus" in a 6-wide column was the cause of the "Speci"/"al" header.
  // "Special" is 7 characters, so it breaks mid-word before "Focus" even gets a line.
  it('counts the header that used to be cut in half', () => {
    expect(wrappedLines('Special Focus', 6)).toBe(3)
    expect(wrappedLines('Special Focus', 22)).toBe(1)
  })
})
