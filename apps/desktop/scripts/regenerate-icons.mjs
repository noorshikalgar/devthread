#!/usr/bin/env node
// Regenerate every Tauri bundle icon from the source SVG mark.
//
// Usage:  pnpm --filter @taskline/desktop exec node scripts/regenerate-icons.mjs
//
// Requires macOS (qlmanage + sips + iconutil from the system, and
// `tauri icon` from the workspace). Re-run after editing
// src/assets/taskline-mark.svg.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(new URL(import.meta.url).pathname);
const repoRoot = resolve(here, "..", "..");
const sourceSvg = resolve(repoRoot, "src/assets/taskline-icon.svg");
const stagingPng = join(tmpdir(), "taskline-icon-source.png");
const renderedPng = join(tmpdir(), "taskline-mark.svg.png");

function run(binary, args, options = {}) {
  execFileSync(binary, args, { stdio: "inherit", ...options });
}

function ensure(cond, message) {
  if (!cond) throw new Error(message);
}

ensure(
  process.platform === "darwin",
  "regenerate-icons.mjs only runs on macOS (uses qlmanage + iconutil).",
);

console.log(`Rendering ${sourceSvg} → 1024 PNG via Quick Look…`);
run("qlmanage", ["-t", "-s", "1024", "-o", tmpdir(), sourceSvg]);
copyFileSync(renderedPng, stagingPng);

console.log(`Running \`tauri icon\` to rebuild all bundle formats…`);
const tauriDir = resolve(repoRoot, "src-tauri");
run("pnpm", ["tauri", "icon", stagingPng], { cwd: tauriDir });

console.log("Done. Icons written under apps/desktop/src-tauri/icons/");
