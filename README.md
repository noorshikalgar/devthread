# DevThread

DevThread is a private, local-first developer work journal. This repository
currently contains the macOS-first task-thread dogfood milestone.

## Development

Requirements: Node 22+, pnpm 11+, Rust stable, and the Tauri 2 macOS
prerequisites.

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm check
pnpm test
pnpm test:rust
pnpm build
```

The desktop application stores `devthread.sqlite3` under the operating
system's normal application-data directory. See
[`docs/dogfood/backup-and-recovery.md`](docs/dogfood/backup-and-recovery.md)
before relying on dogfood data.

## Releases

CI (`.github/workflows/build.yml`) cross-compiles installers on every push to
`main` and on tags. To cut a release:

1. Bump the version in `apps/desktop/package.json` and
   `apps/desktop/src-tauri/tauri.conf.json`.
2. `git tag v0.x.y && git push --tags`.
3. The release job attaches `.dmg` (macOS Apple Silicon), `.msi` + NSIS
   `.exe` (Windows), and `.deb` + `.AppImage` (Linux) to a GitHub Release
   draft.

Installers are unsigned — first-run on macOS/Windows will surface a
Gatekeeper/SmartScreen warning. Add `APPLE_*` and `WINDOWS_*` secrets to the
repo and the corresponding build steps to enable signing and notarization.
