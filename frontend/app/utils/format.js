const TIERS = [
  { threshold: 1_000_000_000_000, suffix: 'T' },
  { threshold: 1_000_000_000,     suffix: 'B' },
  { threshold: 1_000_000,         suffix: 'M' },
  { threshold: 1_000,             suffix: 'k' },
]

/**
 * Compact currency notation (always 3 significant digits, truncated — no rounding):
 *   0–999       → "500"
 *   1k–9.99k    → "5.55k" (2 decimals)
 *   10k–99.9k   → "15.5k" (1 decimal)
 *   100k–999k   → "155k"  (no decimal)
 *   … same pattern for M, B, T  (k lowercase, M/B/T uppercase — standard convention)
 */
export function formatCurrency(n) {
  for (const { threshold, suffix } of TIERS) {
    if (n >= threshold) {
      const value    = n / threshold
      const decimals = value < 10 ? 2 : value < 100 ? 1 : 0
      const factor   = Math.pow(10, decimals)
      return (Math.floor(value * factor) / factor).toFixed(decimals) + suffix
    }
  }
  return n.toString()
}
