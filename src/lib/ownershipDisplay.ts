// CMS returns roles as a fixed, shouting-caps vocabulary ("5% OR GREATER DIRECT OWNERSHIP
// INTEREST", "W-2 MANAGING EMPLOYEE") -- sentence-case it for a label that's primary UI content,
// not just a backing field. Names are deliberately left raw elsewhere in the app since they're
// free-form proper nouns, not a small controlled vocabulary like this is.
export function formatRole(role: string): string {
  if (!role) return role
  return role.charAt(0) + role.slice(1).toLowerCase()
}

// PECOS association dates arrive as "since 04/16/2016" (or a range for ended relationships).
// The UI supplies the "associated since" wording itself, so the leading word is stripped to the
// bare date; anything unexpected is kept as filed.
export function bareAssociationDate(raw: string): string {
  const v = raw.trim()
  return v.toLowerCase().startsWith('since ') ? v.slice(6).trim() : v
}
