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

/**
 * Reads an HSL-channel CSS custom property and returns it as the
 * three numeric channels. Used by the heatmap to build a lightness
 * ladder of the same hue without going through `hsl(...)` parsing
 * in JS. Returns null if no document is available or the value
 * isn't in the expected HSL-channel format.
 */
function readHslChannels(
  name: `--chart-${string}` | "--muted" | "--background",
): { h: number; s: number; l: number } | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const match = /^(\d+)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(raw);
  if (!match) return null;
  return {
    h: Number(match[1]),
    s: Number(match[2]),
    l: Number(match[3]),
  };
}

/**
 * Builds a `hsl(...)` string at a given lightness from the same hue
 * as the theme's --chart-1. Used to paint a heatmap ladder that
 * stays the same hue but visibly steps from dark to bright — so
 * a 2h day and a 6h day look clearly different even on saturated
 * dark-theme accents like Gruvbox amber.
 */
export function chartAccentAtLightness(lightness: number): string {
  const channels = readHslChannels("--chart-1");
  if (!channels) return "currentColor";
  // Clamp to a sensible range so a typo in the CSS variable
  // (e.g. negative lightness) doesn't produce an invalid colour.
  const l = Math.max(0, Math.min(100, lightness));
  return `hsl(${channels.h} ${channels.s}% ${l}%)`;
}

/**
 * The hue + saturation of the active theme's --chart-1, useful
 * when callers need to mix custom colours from the same palette
 * (e.g. a low-opacity overlay on top of a cell).
 */
export function chartAccentHue(): { h: number; s: number } | null {
  const channels = readHslChannels("--chart-1");
  if (!channels) return null;
  return { h: channels.h, s: channels.s };
}

/**
 * Returns a `hsl(...)` string at a given lightness interpolated
 * between the theme's --muted colour (used for the empty/lowest
 * cell) and the theme's --chart-1 colour (used for the brightest
 * cell). `ratio` of 0 is pure --muted, 1 is pure --chart-1. The
 * hue and saturation of --chart-1 are used throughout so the
 * ladder stays in the same colour family.
 *
 * This is the heatmap's secret weapon: a 5-step lightness ladder
 * looks clearly different on every theme, including saturated
 * dark-theme accents (Gruvbox amber, Zed gold) where a pure
 * alpha-opacity ladder was indistinguishable.
 */
export function chartAccentBlend(ratio: number): string {
  const accent = readHslChannels("--chart-1");
  const muted = readHslChannels("--muted");
  if (!accent) return "currentColor";
  if (!muted) {
    // No muted available (SSR or unusual theme). Fall back to a
    // darker version of the accent at low ratios.
    const l = Math.max(0, accent.l * (1 - Math.max(0, Math.min(1, ratio))));
    return `hsl(${accent.h} ${accent.s}% ${l}%)`;
  }
  const r = Math.max(0, Math.min(1, ratio));
  // Interpolate lightness from muted to accent. We also bump the
  // saturation toward accent as the ratio climbs so the cell gets
  // more colourful, not just brighter.
  const l = muted.l + (accent.l - muted.l) * r;
  const s = muted.s + (accent.s - muted.s) * r;
  return `hsl(${accent.h} ${s}% ${l}%)`;
}
