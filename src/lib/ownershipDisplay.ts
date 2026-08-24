// CMS returns roles as a fixed, shouting-caps vocabulary ("5% OR GREATER DIRECT OWNERSHIP
// INTEREST", "W-2 MANAGING EMPLOYEE") -- sentence-case it for a label that's primary UI content,
// not just a backing field. Names are deliberately left raw elsewhere in the app since they're
// free-form proper nouns, not a small controlled vocabulary like this is.
export function formatRole(role: string): string {
  if (!role) return role
  return role.charAt(0) + role.slice(1).toLowerCase()
}
