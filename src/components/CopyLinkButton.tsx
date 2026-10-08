import { useState } from 'react'
import type { FacilityRecord } from '../types/facility'
import { facilityShareUrl } from '../lib/routing'

/**
 * Copies a link to this facility.
 *
 * The link is built from the facility's kind and CCN only — both public CMS identifiers — so it
 * carries nothing about the sender: no name, email, device id, notes or portfolio membership. The
 * recipient still has to pass the access gate; the link is an address, not an invitation, and the
 * copy confirmation says so rather than implying it grants anything.
 */
export function CopyLinkButton({ facility, className = '' }: { facility: FacilityRecord; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    const url = facilityShareUrl(`${facility.kind}:${facility.ccn}`)
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      // Clipboard access is denied in some embedded and insecure contexts. Fall back to a
      // selectable prompt rather than silently doing nothing.
      try {
        window.prompt('Copy this link', url)
        setState('copied')
      } catch {
        setState('failed')
      }
    }
    setTimeout(() => setState('idle'), 2600)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={copy}
        title="Copy a link to this facility"
        className={`inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-[--radius-md] border border-[--color-border-strong] px-2.5 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-surface-hover] ${className}`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Copy link
      </button>
      <span role="status" aria-live="polite" className="text-xs text-[--color-text-secondary]">
        {state === 'copied' ? 'Link copied — recipients still need access' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </span>
  )
}
