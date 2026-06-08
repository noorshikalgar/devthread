// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { APP_THEMES } from "./themes";

const PROJECT_ROOT = join(__dirname, "..", "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const VITE_BIN = join(PROJECT_ROOT, "node_modules", "vite", "bin", "vite.js");
const SCAN_PATTERN = /\.theme-[a-z-]+/g;

describe("theme CSS pipeline", () => {
  afterAll(() => {
    if (existsSync(DIST_DIR)) {
      rmSync(DIST_DIR, { recursive: true, force: true });
    }
  });

  it(
    "emits a CSS rule for every registered theme id",
    { timeout: 20_000 },
    () => {
      execFileSync("node", [VITE_BIN, "build", "--logLevel", "error"], {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
      });
      const cssFile = readdirSync(join(DIST_DIR, "assets")).find(
        (name) => name.startsWith("index-") && name.endsWith(".css"),
      );
      expect(cssFile, "Vite build did not produce a CSS file").toBeDefined();
      const css = readFileSync(join(DIST_DIR, "assets", cssFile!), "utf8");
      const present = new Set(css.match(SCAN_PATTERN) ?? []);

      for (const theme of APP_THEMES) {
        const selector = `.theme-${theme.id}`;
        expect(
          present.has(selector),
          `Tailwind purged ${selector} from the production CSS bundle. ` +
            `Add the theme to APP_THEMES (in src/lib/themes.ts) and ensure ` +
            `styles.css defines a rule for it, or check the safelist in ` +
            `tailwind.config.js.`,
        ).toBe(true);
      }
    },
  );

  it("keeps styles.css and APP_THEMES in sync", () => {
    const css = readFileSync(join(PROJECT_ROOT, "src", "styles.css"), "utf8");
    for (const theme of APP_THEMES) {
      const selector = `.theme-${theme.id}`;
      expect(
        css.includes(selector),
        `styles.css is missing a rule for ${selector}. ` +
          `Either add the CSS rule or remove the theme from APP_THEMES.`,
      ).toBe(true);
    }
  });

  it("defines chart palette variables for every theme", () => {
    const css = readFileSync(join(PROJECT_ROOT, "src", "styles.css"), "utf8");
    const chartVars = [
      "--chart-1",
      "--chart-2",
      "--chart-3",
      "--chart-4",
      "--chart-grid",
    ];
    // The :root and .dark fallbacks also need the chart vars.
    for (const scope of [":root", ".dark"]) {
      const start = css.indexOf(`${scope} {`);
      expect(start, `styles.css is missing the ${scope} block`).toBeGreaterThan(
        -1,
      );
      const end = css.indexOf("}", start);
      const block = css.slice(start, end);
      for (const variable of chartVars) {
        expect(
          block.includes(variable),
          `${scope} block is missing ${variable} — every theme needs ` +
            `the chart palette so Recharts can read CSS variables.`,
        ).toBe(true);
      }
    }
    for (const theme of APP_THEMES) {
      const selector = `.theme-${theme.id} {`;
      const start = css.indexOf(selector);
      expect(
        start,
        `styles.css is missing a rule for ${selector}.`,
      ).toBeGreaterThan(-1);
      const end = css.indexOf("}", start);
      const block = css.slice(start, end);
      for (const variable of chartVars) {
        expect(
          block.includes(variable),
          `${selector} block is missing ${variable} — every theme needs ` +
            `the chart palette so Recharts can read CSS variables.`,
        ).toBe(true);
      }
    }
  });
});
