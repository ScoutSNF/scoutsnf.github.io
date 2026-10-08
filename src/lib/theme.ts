/**
 * Theme preference: light, dark, or follow the operating system.
 *
 * `docs/preservation.md` previously recorded "no manual theme toggle" as an invariant, on the
 * basis that the OS preference was the only input. That was deliberately reversed — a toggle is
 * now a requirement — and the preservation entry is updated in the same change rather than left
 * contradicting the code.
 *
 * 'system' writes no attribute at all, so the CSS media query governs. An explicit choice stamps
 * `data-theme` on <html>, which the token blocks in index.css are written to let win in both
 * directions.
 */
export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_KEY = 'scoutsnf.theme'

export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    // Private mode and blocked site-data both throw on access rather than returning null.
    return 'system'
  }
}

export function applyThemePreference(pref: ThemePreference): void {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)

  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, pref)
  } catch {
    // The theme still applies for this session even if it cannot be remembered.
  }
}

/** Applied before React mounts so there is no flash of the wrong theme on load. */
export function initTheme(): void {
  applyThemePreference(readThemePreference())
}
