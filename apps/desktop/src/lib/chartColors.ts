/**
 * Reads a CSS custom property from the document root and returns it as
 * a string the charting library can use (e.g. `hsl(...)` for Recharts).
 *
 * Returns the raw `var(...)` reference when no document is available
 * (SSR / tests), which is fine because Recharts treats both forms the
 * same way.
 */
export function readChartColor(
  name: `--chart-${string}` | "--chart-grid",
  fallback = "currentColor",
): string {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return `var(${name}, ${fallback})`;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) return fallback;
  // The palette is stored in HSL channels (e.g. "240 5.9% 10%") to play
  // well with Tailwind's `hsl(var(--...))` convention. Recharts accepts
  // any valid CSS color, so wrap it back into a usable string.
  if (/^\d+\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(value)) {
    return `hsl(${value})`;
  }
  return value || fallback;
}
