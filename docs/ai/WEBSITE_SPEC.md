# DevThread Public Website Specification

Status: Deferred until the task-thread dogfood milestone validates product direction  
Prepared: 2026-06-04  
Purpose: Public product, download, release, and project-information website

## 1. Objective

Create a fast single-page React website that explains DevThread, shows the actual product experience, provides trustworthy download/version information, and connects visitors to the open-source GitHub project.

The website is separate from the Tauri desktop application, the future local-data web companion, and project documentation. It is static and deployable to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static host.

## 2. Technology

Use:

- React, TypeScript, and Vite
- Tailwind CSS using DevThread design tokens
- Lucide icons
- locally bundled Geist Sans and JetBrains Mono
- Vitest and Playwright
- GitHub Actions

Do not require a backend. Generate GitHub-derived release information during the build rather than querying GitHub from every visitor's browser.

Recommended location:

```text
apps/website/
```

## 3. Website Positioning

Primary message:

> Never lose the thread of your work.

Supporting message:

> A private, local-first developer work journal for capturing findings, blockers, decisions, progress, and next steps without rebuilding your day from Jira, GitHub, and memory.

Primary actions:

- Download latest
- View on GitHub

Secondary actions:

- See what is new
- Read documentation
- Report an issue

Clearly state: open source, local-first, no account required, private by default, and available platforms.

## 4. Single-Page Structure

### Header

- DevThread wordmark
- Product
- How it works
- Latest release
- GitHub
- Download button

### Hero

Use a real product screenshot or interactive product scene. Show the product name, literal value proposition, latest version, download action, and GitHub action.

Avoid abstract gradients, stock images, marketing illustrations, large card-contained hero content, and exaggerated AI messaging.

### Thread Experience

Demonstrate:

```text
type update
-> press Cmd/Ctrl + Enter
-> update appears in timeline
-> continue working
```

Show one `What happened?` composer plus progress, finding, blocker, decision, attachment/reference, and edited timestamp entries.

### Product Capabilities

Use restrained full-width sections with real interface media:

- Resume where you stopped
- Capture findings and blockers instantly
- Keep external context linked
- Generate editable work summaries
- Stay private and offline

### Privacy And Local-First

Explain local SQLite storage, no account requirement, no automatic sharing, no employee monitoring, and optional integrations/AI with user previews.

### Latest Release

Display:

```text
Latest: release_v_0.3.0_alpha
Released: June 4, 2026

New
- Task thread composer
- Inline editing with revision history

Improved
- Faster timeline search

Fixed
- Recovered unsaved drafts after restart
```

Actions:

- Download for detected platform
- All downloads
- Full release notes
- Compare source

### Roadmap And Contribution

Link to planned features, open feature requests, good first issues, known issues, and the contribution guide. Do not promise dates sourced from open issues.

### Footer

Link to repository, releases, issues, discussions, documentation, security, privacy, and license.

## 5. GitHub Integration

### Source Of Truth

- Release tags use `release_v_*`, such as `release_v_0.0.4_alpha`.
- GitHub Releases define published versions, release notes, and downloadable assets.
- GitHub Issues track bugs/features.
- GitHub Discussions may host community questions.
- Changesets manages release intent and changelog fragments.

### Build-Time Release Data

Create:

```text
apps/website/scripts/fetch-github-release.mjs
```

During CI:

1. Fetch the latest non-draft, non-prerelease GitHub Release.
2. Validate and normalize it.
3. Write `apps/website/src/generated/latest-release.json`.
4. Use a committed fallback fixture when GitHub is unavailable.

Normalized shape:

```json
{
  "version": "release_v_0.3.0_alpha",
  "name": "Task Threads",
  "publishedAt": "2026-06-04T12:00:00Z",
  "url": "https://github.com/ORG/devthread/releases/tag/release_v_0.3.0_alpha",
  "notes": {
    "features": [],
    "improvements": [],
    "fixes": [],
    "knownIssues": []
  },
  "assets": [
    {
      "platform": "macos-arm64",
      "name": "DevThread_0.3.0_aarch64.dmg",
      "url": "...",
      "size": 123456
    }
  ]
}
```

### Release Notes Format

Use:

```md
## New
- ...

## Improved
- ...

## Fixed
- ...

## Known issues
- ...
```

The parser supports these headings. Unknown content remains available through the full release-notes link.

### Version Consistency

Application version, package version, updater metadata, Git tag, GitHub Release, and website latest-version block derive from one release workflow.

Never manually maintain a separate website version string.

### Issues And Features

Display counts/links, not an unreliable live issue feed. Build-time metadata may include open bugs, feature requests, good-first issues, and known-issues links.

Do not expose security issues through public website integration.

### Failure Handling

If GitHub fetch fails:

- Use committed fallback data.
- Mark metadata as cached.
- Continue normal website builds.
- Fail only when the release workflow explicitly requires current metadata.

If no release exists, show `Development preview` and no fake download buttons.

If a platform asset is missing, hide its download action and link to all releases.

## 6. Download Experience

Detect likely platform only to prioritize actions. Always expose macOS, Windows, Linux, and All Releases.

Rules:

- Never automatically start downloads.
- Show architecture choices, file size, version, signatures/checksums, and system requirements.
- Clearly distinguish stable and prerelease builds.
- Download links map only to real GitHub Release assets.

## 7. Screenshots And Media

Use real product captures only:

- Today/resume view
- Task thread
- Quick capture
- Inbox
- Report preview

Capture with deterministic demo data and Playwright. Optimize to WebP/AVIF with appropriate fallbacks. Store assets locally and include descriptive alt text.

Short demos use muted looping WebM/MP4, poster images, and reduced-motion support. Never autoplay sound.

## 8. Visual Direction

Use the tokens from `docs/ai/UI_UX_SPEC.md`: Geist Sans, JetBrains Mono, restrained charcoal surfaces, and semantic progress/finding/blocker/decision accents.

The website may be more expressive than the app but remains product-focused:

- actual interface in first viewport
- no generic SaaS bento-card wall
- no decorative gradient/orb backgrounds
- no oversized empty hero
- full-width sections with clear reading rhythm
- polished light and dark themes

## 9. SEO And Metadata

Required:

- title and meta description
- canonical URL
- Open Graph/social preview
- favicon/app icons
- sitemap and robots.txt
- structured `SoftwareApplication` data

Suggested title:

```text
DevThread - A local-first developer work journal
```

## 10. Accessibility And Performance

Targets:

- WCAG 2.2 AA
- Lighthouse scores of 95+ for performance, accessibility, SEO, and best practices
- minimal client JavaScript
- no layout shifts
- responsive optimized product media
- keyboard navigation, visible focus, and reduced motion

Do not add analytics by default.

## 11. Deployment

Default: GitHub Pages using GitHub Actions. Support any static host.

Website workflow:

```text
push affecting website
-> test
-> fetch/cache GitHub metadata
-> build
-> Playwright smoke test
-> deploy
```

Release workflow:

```text
publish GitHub Release
-> signed desktop assets available
-> trigger website build
-> verify displayed version/assets
-> deploy
```

Configure the correct Vite base path for GitHub Pages repository-path hosting.

## 12. Testing

Unit tests:

- release normalization
- release-note parsing
- platform asset mapping
- fallback behavior
- download selection

Playwright:

- desktop/mobile layouts
- anchors and downloads
- latest release rendering
- fallback fixture
- no broken images
- no overflow/overlap
- light/dark themes

Build validation:

- no remote placeholder image URLs
- no missing alt text
- no unresolved generated metadata
- all internal links valid
- release assets use the expected GitHub repository

## 13. Folder Structure

```text
apps/website/
  public/
    fonts/
    icons/
    images/
  scripts/
    fetch-github-release.mjs
    capture-product-media.mjs
  src/
    components/
    generated/
      latest-release.json
      github-summary.json
    sections/
      Header.tsx
      Hero.tsx
      ThreadExperience.tsx
      Capabilities.tsx
      Privacy.tsx
      LatestRelease.tsx
      Contribute.tsx
      Footer.tsx
    styles/
    App.tsx
    main.tsx
  tests/
  index.html
  vite.config.ts
```

## 14. Definition Of Done

1. Single-page React/Vite static website.
2. First viewport clearly shows DevThread and the real thread UI.
3. Visitors understand the product without feature jargon.
4. Latest version and release notes derive from GitHub Release data.
5. Downloads map only to existing release assets.
6. Features, improvements, fixes, and known issues are visible.
7. GitHub failures fall back without breaking builds.
8. Project/community/security/privacy links are present.
9. Screenshots are real optimized product captures.
10. Desktop/mobile Playwright screenshots have no layout defects.
11. Lighthouse and accessibility targets pass.
12. GitHub Actions deploys successfully.
