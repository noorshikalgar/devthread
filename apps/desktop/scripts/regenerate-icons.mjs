#!/usr/bin/env node
// Regenerate every Tauri bundle icon from the source SVG mark.
//
// Usage:  pnpm --filter @devthread/desktop exec node scripts/regenerate-icons.mjs
//
// Requires macOS (qlmanage + sips + iconutil from the system, and
// `tauri icon` from the workspace). Re-run after editing
// src/assets/devthread-mark.svg.

import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(new URL(import.meta.url).pathname);
const repoRoot = resolve(here, "..", "..", "..");
const sourceSvg = resolve(repoRoot, "apps/desktop/src/assets/devthread-icon.svg");
const sourceBase = sourceSvg.split("/").pop();
const stagingPng = join(tmpdir(), `${sourceBase.replace(/\.svg$/, "")}-source.png`);
const renderedPng = join(tmpdir(), `${sourceBase}.png`);

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

// `qlmanage` frequently finishes writing the thumbnail but never exits the
// "Testing Quick Look thumbnails with files:" step, so we run it in the
// background, wait for the output PNG to settle, and then kill it.
function renderIconViaQuickLook(svg, outPng, size = 1024, timeoutMs = 15000) {
  return new Promise((resolveRender, rejectRender) => {
    if (existsSync(outPng)) rmSyncFallback(outPng);
    const child = spawn(
      "qlmanage",
      ["-t", "-s", String(size), "-o", tmpdir(), svg],
      { stdio: ["ignore", "inherit", "inherit"] },
    );

    const deadline = Date.now() + timeoutMs;
    let lastSize = -1;
    let stableSince = 0;

    const poll = setInterval(() => {
      try {
        if (!existsSync(outPng)) {
          if (Date.now() > deadline) {
            clearInterval(poll);
            killTree(child);
            rejectRender(new Error(`qlmanage did not produce ${outPng} in ${timeoutMs}ms`));
          }
          return;
        }
        const size = statSync(outPng).size;
        if (size === lastSize && size > 0) {
          if (stableSince === 0) stableSince = Date.now();
          if (Date.now() - stableSince > 250) {
            clearInterval(poll);
            killTree(child);
            resolveRender();
            return;
          }
        } else {
          lastSize = size;
          stableSince = 0;
        }
        if (Date.now() > deadline) {
          clearInterval(poll);
          killTree(child);
          rejectRender(new Error(`qlmanage did not finalise ${outPng} in ${timeoutMs}ms`));
        }
      } catch (err) {
        clearInterval(poll);
        killTree(child);
        rejectRender(err);
      }
    }, 100);
  });
}

function killTree(child) {
  if (child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {}
  }
  setTimeout(() => {
    if (child.exitCode !== null) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
  }, 500);
}

function rmSyncFallback(path) {
  try {
    execFileSync("rm", ["-f", path], { stdio: "ignore" });
  } catch {}
}

console.log(`Rendering ${sourceSvg} → 1024 PNG via Quick Look…`);
await renderIconViaQuickLook(sourceSvg, renderedPng);
copyFileSync(renderedPng, stagingPng);

console.log(`Running \`tauri icon\` to rebuild all bundle formats…`);
const tauriDir = resolve(repoRoot, "apps/desktop/src-tauri");
const tauriBin = resolve(repoRoot, "apps/desktop/node_modules/.bin/tauri");
run(tauriBin, ["icon", stagingPng], { cwd: tauriDir });

console.log("Done. Icons written under apps/desktop/src-tauri/icons/");
