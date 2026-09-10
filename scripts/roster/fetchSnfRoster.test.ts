import { describe, expect, it } from 'vitest'
import { classifySpecialFocus } from './fetchSnfRoster.js'

describe('classifySpecialFocus', () => {
  it('classifies a facility in the program', () => {
    expect(classifySpecialFocus('SFF')).toBe('sff')
  })

  // The regression this function exists for: the previous /sff|yes|true/ substring test matched
  // "SFF Candidate" because it contains "SFF", flagging 525 of 14,690 facilities as Special Focus
  // when the real program is under 100. Candidates showed a red SFF badge and no red hand on
  // CMS Care Compare, because they were never in the program.
  it('does not classify a candidate as a full SFF', () => {
    expect(classifySpecialFocus('SFF Candidate')).toBe('candidate')
  })

  it('matches candidates regardless of casing or surrounding wording', () => {
    for (const raw of ['sff candidate', 'SFF CANDIDATE', 'Candidate', '  SFF Candidate  ']) {
      expect(classifySpecialFocus(raw)).toBe('candidate')
    }
  })

  it('treats blank, missing, and not-in-program values as no status', () => {
    for (const raw of ['', '   ', null, undefined, 'Not in program', 'N/A']) {
      expect(classifySpecialFocus(raw)).toBeNull()
    }
  })

  it('still recognizes a full SFF under alternate wording', () => {
    expect(classifySpecialFocus('Special Focus')).toBe('sff')
    expect(classifySpecialFocus('Yes')).toBe('sff')
  })
})
