# Taskline

Taskline is an early-alpha, local-first desktop work journal for developers.
It helps you keep the small pieces of engineering context that usually disappear
between standups, pull requests, Slack threads, browser tabs, and "what was I
doing yesterday?"

Taskline is being built in public. The product is usable for dogfooding, but the
project is still in active development and the data model, UI, release process,
and documentation may change before a stable release.

## What It Is

Taskline is not trying to become a full project-management suite. It is a quiet
local companion for tracking task-level context:

- Tasks grouped into folders
- Chronological updates per task
- Typed entries for notes, progress, findings, blockers, decisions, and next
  steps
- Private/report-eligible visibility markers
- Local attachments and link previews
- Command palette search with optional regex
- Local SQLite storage

The goal is simple: when you return to a task, Taskline should make the context
feel close again.

## Project Status

Taskline is currently **early alpha**.

Expect rough edges. Some workflows are still being shaped, especially themes,
archive/folder behavior, release signing, and visual polish. Feedback, issues,
and small focused pull requests are welcome once the public repo settles.

Screenshots and a polished product tour will be added after the current theme
pass is finished.

## Development

Requirements:

- Node.js 22+
- pnpm 11+
- Rust stable
- Tauri 2 system dependencies for your platform

Install dependencies:

```bash
pnpm install
```

Run the desktop app in development:

```bash
pnpm dev
```

Run the web shell only:

```bash
pnpm dev:web
```

Useful checks:

```bash
pnpm check
pnpm test
pnpm test:rust
pnpm build
```

## Local Data

Taskline stores its SQLite database in the operating system's normal
application-data directory as `taskline.sqlite3`.

Because this is alpha software, back up any dogfood data you care about. See
[`docs/dogfood/backup-and-recovery.md`](docs/dogfood/backup-and-recovery.md)
before relying on Taskline for important work history.

## Demo Data

The desktop package includes a small seed script for local demo data:

```bash
pnpm --filter @taskline/desktop seed:demo
```

Use this when preparing screenshots, demos, or feedback videos.

## Releases

CI lives in [`.github/workflows/build.yml`](.github/workflows/build.yml).
It runs lint/typecheck, tests, and cross-platform Tauri builds.

On version tags, the release job uploads generated installers and binaries to a
GitHub Release:

- macOS Apple Silicon `.dmg`
- Windows `.msi` and NSIS `.exe`
- Linux `.deb` and `.AppImage`

To cut a release:

1. Bump the version in `apps/desktop/package.json` and
   `apps/desktop/src-tauri/tauri.conf.json`.
2. Commit the version bump.
3. Create and push a tag, for example `v0.1.0`.

Installers are currently unsigned. macOS Gatekeeper and Windows SmartScreen may
show first-run warnings until signing and notarization are wired up.

## Contributing

Taskline is still finding its product shape, so the best contributions are
small, practical, and easy to review:

- Bug reports with clear reproduction steps
- UI polish fixes that preserve the editor-like workflow
- Tests for existing behavior
- Documentation improvements
- Focused fixes for release/build issues

Please keep changes scoped. Large product-direction changes should start as an
issue or discussion first.

## License

License information will be added before the first public alpha release.
