# DevThread: Production-Ready Product and Implementation Plan

Status: Decision-complete planning blueprint
Prepared: 2026-06-04
Target repository: `~/projects/devthread`
Working product name: **DevThread**
Name status: Provisional; complete trademark, package-name, and domain checks before public launch.

## 1. Executive Summary

DevThread is an open-source, local-first developer work journal for preserving the context behind daily engineering work.

It helps a developer answer:

- What was I working on?
- Where did I stop?
- What did I discover?
- What blocked progress?
- Why did this task take this path?
- What should I continue next?
- What can I safely share as a work update?

DevThread combines:

- a fast inbox
- developer-friendly Markdown notes
- lightweight tasks
- timestamped work-log entries
- workspaces and folders
- linked external context such as Jira, GitHub, GitLab, Figma, and Confluence
- editable daily, weekly, and date-range summaries

DevThread is explicitly **not**:

- a Jira replacement
- a team project-management suite
- an employee-monitoring product
- an automatic productivity-scoring tool
- an attendance tracker
- a mandatory timer

The product is personal-first and private by default. It earns trust by helping the developer before it offers any sharing or reporting capability.

## 2. Product Thesis

Engineering work is difficult to summarize because the important context is scattered:

- Jira holds the planned task.
- GitHub holds code and review activity.
- Figma holds design context.
- Confluence holds long-form organizational knowledge.
- Chat and meetings hold decisions and interruptions.
- The developer's memory holds findings, failed attempts, and reasons.

Existing tools usually optimize for organizational planning or time measurement. DevThread optimizes for **continuity of personal engineering context**.

The product promise:

> Never lose the thread of your work, and never reconstruct a status report from memory again.

## 3. Evidence and Market Position

Current products prove demand for adjacent capabilities:

- Super Productivity combines offline-first tasks, time tracking, and Jira/GitHub/GitLab integrations.
- ActivityWatch proves demand for local, privacy-first activity records.
- Inkdrop proves developers value a focused Markdown notebook.
- Obsidian proves local files and extensibility are compelling, but it requires setup and is not work-log oriented.
- Jira and Confluence remain organizational sources of truth but require frequent manual updates.

DevThread must not compete by collecting the largest feature list.

Its differentiation is:

```text
Inkdrop-like immediacy
+ task-linked developer context
+ structured findings/blockers/decisions
+ private-by-default work history
+ safe, editable work summaries
+ optional external references and writeback
```

## 4. Product Principles

1. **The developer is the primary customer.**
2. **Private is the default. Sharing is always deliberate.**
3. **Capture must be faster than opening Jira.**
4. **The product must remain useful with no account and no internet.**
5. **External tools remain sources of truth; DevThread preserves personal context around them.**
6. **AI drafts and organizes. It never judges productivity or shares automatically.**
7. **Every destructive or external write action is previewable and reversible where possible.**
8. **Desktop is the primary experience. Web is a capable companion with documented browser limitations.**
9. **The app starts simple and stays visually quiet.**
10. **Reports explain work; they do not score people.**

## 5. Target Users

### 5.1 Primary User

A software developer working across several tasks and tools who wants:

- a reliable daily memory
- fast note capture
- a way to resume interrupted work
- a factual timeline of progress and blockers
- effortless standup or date-range summaries

### 5.2 Secondary Users

- Technical leads maintaining context across multiple workstreams.
- Consultants who need defensible work logs without exposing private notes.
- SREs recording investigation timelines and findings.
- Designers or QA engineers who work closely with developer tooling.

### 5.3 Explicitly Not Optimized For In V1

- Managers monitoring individual activity.
- Organizations replacing Jira/Linear/Confluence.
- Payroll or legally authoritative timekeeping.
- Shared real-time team planning.

## 6. Core User Experience

### 6.1 First Launch

The first launch must take under one minute:

1. Choose local data folder or accept the default.
2. Choose whether to enable automatic backups.
3. Optionally create the first workspace.
4. Land directly in the Inbox with the capture field focused.

No account, tutorial carousel, provider setup, or integration setup is required.

### 6.2 Start Of Day

Optional lightweight prompt:

```text
Continue where you stopped?

API-142 · Optimize customer response
Last note: Verify whether UI requires nested relationships.

[Continue] [Choose task] [Not now]
```

Rules:

- Never say "clock in", "attendance", or "logged in".
- The prompt can be disabled permanently.
- Do not repeatedly ask after dismissal.
- The prompt derives from the last active task and explicit next step.

### 6.3 Quick Capture

Global shortcut opens a small capture window:

```text
Capture...

/note
/finding
/blocker
/decision
/progress
/task
/link
```

Capture supports:

- plain text
- Markdown
- pasted URLs
- screenshots/images
- clipboard content
- optional current task assignment
- optional visibility choice

Default destination: Inbox.

### 6.4 Working On A Task

A task is presented as one continuous working thread, not as a Jira-style detail page with content tabs.

The task view contains:

- a compact task header with title, status, workspace, optional external ID, and last meaningful update
- one prominent next step
- one persistent composer asking `What happened?`
- one reverse-chronological mixed-content timeline
- an optional collapsible context inspector for stable metadata

The composer is the primary interaction. The user types once and the resulting item immediately becomes part of the thread.

```text
Payment filter UI implementation
In progress · DEV-402 · Updated 18 minutes ago

Next step
Confirm required API fields with the UI team

┌───────────────────────────────────────────────────────┐
│ What happened?                                        │
│ Add an update, finding, blocker, decision, link...    │
└───────────────────────────────────────────────────────┘
[Note ▾] [Private ▾]                              [Add]

Today
11:18  Blocker
       API response takes 1.2 seconds with production-size data.

11:10  Attachment
       filter-state-error.png

10:52  Finding
       Browser refresh loses the selected filter state.

10:45  Progress
       Connected the date-range picker to the transaction API.
```

Thread entries are timestamped and typed:

- note
- finding
- blocker
- decision
- progress
- meeting
- interruption
- next step

References, links, screenshots, attachments, and integration events appear at the point in the thread where they became relevant. They do not live in separate content tabs.

Stable task context appears in an optional right inspector:

- status
- next step
- workspace/folder
- external references
- attachment count
- task brief
- created/updated dates

The inspector is secondary and collapsible. The chronological thread remains the primary surface.

The task may have one editable Markdown `task brief` for stable requirements or implementation context. Dated observations and progress belong in the thread.

Compact filters may temporarily narrow the thread by type, date, visibility, or text search. Filters must use a small menu/segmented control and must not resemble primary navigation tabs.

### 6.5 End Of Day

DevThread prepares an editable summary from report-eligible entries:

```text
API-142 · Optimize customer response

- Reproduced the performance issue using production-size data.
- Identified eager relationship loading as the primary bottleneck.
- Tested paginated response changes.
- UI validation remains blocked until required nested fields are confirmed.

Next:
- Confirm required fields with the UI team.
- Add a performance regression test.
```

Actions:

- Save privately
- Copy as Markdown
- Copy as plain text
- Export
- Preview Jira comment
- Preview Teams/Slack message later

Nothing is posted automatically.

### 6.6 Historical Explanation

The timeline must answer the incident described in the original idea:

```text
January UI work summary

- Planned January UI scope completed on January 18.
- February UI scope started early because the January API integration was blocked.
- API delivery was delayed by response-time optimization for production-size data.
- February UI changes were intentionally not released in January.
```

The explanation is based only on entries marked report-eligible and linked external facts.

## 7. Information Architecture

Primary navigation:

```text
Today
Inbox
Tasks
Notes
Workspaces
History
Reports
```

Secondary utilities:

- Search / command palette
- Quick capture
- Active task/session
- Integrations
- Backup/export
- Settings

### 7.1 Workspaces

Workspaces are personal organizational boundaries, not collaborative teams.

Examples:

```text
Team A
  UX
  API
  Operations

Client B
  Discovery
  Implementation

Personal
```

A user may represent their real teams as workspaces, but DevThread does not assume membership or shared access.

### 7.2 Inbox

The Inbox holds uncategorized:

- notes
- tasks
- links
- images
- imported external items

Inbox processing actions:

- assign workspace/folder
- convert note to task
- attach to task
- archive
- delete

### 7.3 History

History is a chronological, filterable record:

- by day/date range
- by workspace
- by task
- by entry type
- by visibility
- by external source

## 8. Scope

### 8.1 Initial Dogfood Milestone

The first implemented milestone is intentionally narrower than the full V1
product envelope. It validates the thread-first interaction before expanding
scope.

- macOS-first Tauri desktop application
- no-account local-first usage
- task creation, selection, status, and next step
- typed work-log timeline
- persistent composer drafts
- inline entry editing and immutable revision history
- soft deletion and restoration
- restart persistence using Rust-backed SQLite
- manual backup and recovery documentation

The web/PWA companion, smart links, AI summaries, public website, reports,
workspaces, Inbox, Today view, automatic backups, and non-macOS packaging are
not requirements for this milestone.

### 8.2 V1.1 Features

- Read-only Jira/GitHub/GitLab integration inbox.
- Confirmed Jira comment/work-log writeback.
- GitHub commit/PR linking.
- Calendar meeting import.
- Optional encrypted sync.
- Plugin SDK.

### 8.3 Deferred

- Team invitations and shared workspaces.
- Manager dashboards.
- Attendance tracking.
- Automatic app/window surveillance.
- Employee productivity scoring.
- Mandatory timers.
- Real-time collaboration.
- Full Jira/Confluence replacement.
- Mobile native application.

## 9. Technology Decision

### 9.1 Selected Stack

| Area | Choice | Reason |
|---|---|---|
| Desktop shell | Tauri 2 | Lightweight binaries/runtime, explicit capabilities, native integrations, signed updater support |
| Shared UI | React + TypeScript + Vite | Mature ecosystem, shared desktop/web UI, strong editor and testing support |
| UI primitives | Radix UI primitives + Tailwind CSS design tokens | Accessible behavior with product-owned visual system |
| Desktop core | Rust | Secure local database, integrations, filesystem, backups, keychain, and OS lifecycle |
| Desktop database | SQLite with FTS5, accessed through Rust repository services | Durable local source of truth and strong search without exposing SQL to the webview |
| Web database | Official SQLite WASM with OPFS where supported | Shared relational model while remaining local-first in modern browsers |
| Markdown editor | CodeMirror 6 | Developer-native plain-text Markdown, keyboard support, extensibility, large-note performance |
| Markdown rendering | unified/remark/rehype with strict sanitization | Structured Markdown pipeline and safe rendering |
| Server state/UI async | TanStack Query | Reliable async state and mutation handling |
| Ephemeral UI state | Zustand only for small UI-only state | Avoid placing durable domain data in global frontend state |
| Validation/contracts | Zod + generated JSON Schema | Runtime validation across webview/Rust/integrations |
| Monorepo | pnpm workspaces + Turborepo | Shared packages and reproducible builds |
| Testing | Vitest, React Testing Library, Playwright, Rust tests | Unit, integration, and cross-platform E2E coverage |
| Packaging/releases | Tauri bundler + GitHub Actions matrix builds | Cross-platform signed release artifacts |

### 9.2 Why Tauri Instead Of Electron

The core product promise includes being light, fast, private, and unobtrusive. Tauri is selected because:

- It uses the operating system webview instead of bundling Chromium.
- Native capabilities are permission-scoped.
- Rust is well suited to SQLite, backups, keychain storage, and integration adapters.
- It supports signed update artifacts.

Tradeoffs:

- Rust adds engineering complexity.
- Webview behavior differs across operating systems.
- Release signing and auto-updates still require careful platform setup.

Mitigations:

- Keep Rust boundary small and explicit.
- Test every release on Windows WebView2, macOS WebKit, and Linux WebKitGTK.
- Use adapter contracts and avoid browser-engine-specific UI behavior.
- Maintain signed release pipelines from the beginning.

Electron remains the fallback if Tauri webview inconsistencies or native-plugin maintenance become a sustained product blocker. Do not migrate based on preference; use measured defects and maintenance cost.

### 9.3 Desktop Versus Web

Desktop is the canonical V1 application because browsers cannot reliably provide:

- global shortcuts
- tray behavior
- background integrations
- OS keychain access
- predictable local storage retention
- local filesystem backups

The web/PWA companion supports core local features using SQLite WASM/OPFS, but must clearly communicate:

- browser storage may be cleared or evicted
- integrations may be limited
- background behavior is limited
- desktop and web data do not automatically share without future sync

The public single-page website contains product information, downloads, current-version features/fixes, GitHub project links, and documentation links. It is separate from the optional web companion. See `docs/ai/WEBSITE_SPEC.md`.

## 10. Architecture

### 10.1 Monorepo Structure

```text
devthread/
  README.md
  LICENSE
  SECURITY.md
  CONTRIBUTING.md
  package.json
  pnpm-workspace.yaml
  turbo.json
  apps/
    desktop/                    # Tauri 2 shell and React application
      src/
      src-tauri/
    web/                        # Future local-data PWA companion
    website/                    # Public single-page product/release website
  packages/
    domain/                     # Entities, use cases, validation
    data-contracts/             # Zod/JSON Schema contracts
    data-desktop/               # Tauri IPC repository adapters
    data-web/                   # SQLite WASM/OPFS adapters
    integrations/               # Shared connector contracts and mapping
    editor/                     # CodeMirror Markdown editor
    reports/                    # Deterministic report construction
    ai/                         # Optional provider interfaces
    ui/                         # Design system and reusable components
    test-fixtures/
  docs/
    architecture/
    decisions/
    privacy/
    development/
  .github/
    workflows/
```

### 10.2 Layering

```text
React UI
  -> application use cases
    -> repository interfaces
      -> desktop Tauri adapter / web OPFS adapter
        -> SQLite
```

External integrations follow:

```text
UI confirmation
  -> integration use case
    -> connector interface
      -> desktop Rust HTTP/keychain adapter
        -> provider API
```

Rules:

- React components never execute SQL.
- UI state is never the source of truth for durable data.
- Integration credentials never enter normal logs or exports.
- AI providers never receive private entries unless the user explicitly includes them.
- Provider-specific concepts are normalized at the connector boundary.

### 10.3 Desktop Runtime

Tauri/Rust responsibilities:

- SQLite connections and migrations.
- Transactional domain operations.
- Search queries and backup snapshots.
- Filesystem and attachment storage.
- OS keychain/Stronghold credential access.
- Provider HTTP requests.
- Deep links and OAuth callback handling.
- Global shortcuts, tray, notifications, autostart, updater.
- Export/import.
- Logging with redaction.

Webview responsibilities:

- Rendering.
- Editing.
- Navigation.
- User interactions.
- Calling explicit typed Tauri commands.

### 10.4 Web Runtime

- Same React application and domain/use-case packages.
- SQLite WASM with OPFS when supported.
- IndexedDB fallback only if OPFS is unavailable.
- Service worker for static asset caching.
- Explicit backup reminder because browser storage is less durable.
- Integration support limited by provider CORS/OAuth restrictions.

## 11. Domain Model

All durable records use UUIDv7 identifiers, UTC timestamps, and soft deletion where recovery matters.

### 11.1 Workspace

```text
id
name
description
color
icon
sort_order
archived_at
created_at
updated_at
```

### 11.2 Folder

```text
id
workspace_id
parent_folder_id nullable
name
sort_order
archived_at
created_at
updated_at
```

Limit nesting depth to five levels to prevent unusable hierarchies.

### 11.3 Task

```text
id
workspace_id nullable
folder_id nullable
title
description_markdown
status: inbox | planned | active | blocked | paused | done | archived
priority nullable
started_at nullable
completed_at nullable
due_at nullable
next_step nullable
report_visibility: private | report
created_at
updated_at
deleted_at nullable
```

Only one active task is allowed by default. Users may disable this restriction.

### 11.4 WorkLogEntry

```text
id
task_id nullable
workspace_id nullable
entry_type: note | finding | blocker | decision | progress | meeting | interruption | next_step
content_markdown
visibility: private | report | shared
occurred_at
duration_seconds nullable
source_type: manual | integration | generated | imported
source_reference_id nullable
created_at
updated_at
deleted_at nullable
```

Editing a work-log entry updates `updated_at` and creates an immutable `WorkLogRevision`. The original `occurred_at` and `created_at` remain unchanged.

### 11.5 WorkLogRevision

```text
id
work_log_entry_id
revision_number
previous_content_markdown
previous_entry_type
previous_visibility
changed_at
change_source: user_edit | restore | import_reconciliation
```

Revision rules:

- A revision is written before changing an accepted work-log entry.
- Restoring an earlier revision creates a new revision; it never removes later history.
- Revision history is excluded from normal reports and search results.
- Permanent deletion follows the same explicit retention policy as the parent entry.

### 11.6 Note

```text
id
workspace_id nullable
folder_id nullable
task_id nullable
title
content_markdown
visibility
pinned
created_at
updated_at
deleted_at nullable
```

### 11.7 ExternalReference

```text
id
entity_type: task | note | work_log
entity_id
provider: url | jira | github | gitlab | figma | confluence | custom
external_id nullable
url
title nullable
status nullable
metadata_json
last_refreshed_at nullable
created_at
updated_at
```

### 11.8 WorkSession

```text
id
task_id nullable
started_at
ended_at nullable
duration_seconds nullable
end_reason: stopped | switched | shutdown | recovery | edited
notes nullable
created_at
updated_at
```

### 11.9 Attachment

```text
id
owner_type
owner_id
original_name
media_type
relative_path
byte_size
sha256
created_at
deleted_at nullable
```

Attachments are content-addressed where practical to deduplicate repeated screenshots.

### 11.10 IntegrationAccount

```text
id
provider
display_name
base_url
credential_key_reference
scopes_json
status
last_success_at nullable
last_error_code nullable
created_at
updated_at
```

Tokens and secrets are stored in the OS keychain/Stronghold, never in SQLite.

### 11.11 ChangeEvent

Every meaningful mutation writes an append-only event:

```text
id
entity_type
entity_id
event_type
before_json nullable
after_json nullable
occurred_at
source
```

This powers history, recovery, auditability, and future sync.

## 12. SQLite Strategy

### 12.1 Desktop Database

- Use WAL mode for reliability and responsive reads.
- Enable foreign keys.
- Use explicit migrations.
- Use FTS5 for notes, tasks, work logs, and external titles.
- Execute transactions in Rust.
- Run integrity checks during backup and after unclean-shutdown recovery.
- Maintain a schema version and application compatibility version.

### 12.2 Attachments

Store binary attachments outside SQLite:

```text
data/
  devthread.sqlite3
  attachments/
    ab/cd/<sha256>
  backups/
  logs/
```

SQLite stores attachment metadata and hashes.

### 12.3 Backups

Default:

- automatic daily snapshot
- retain last 14 daily backups
- retain last 8 weekly backups
- verify backup integrity
- never overwrite the only known-good backup

Allow export to a user-selected folder.

### 12.4 Database Failure Handling

On corruption or failed migration:

1. Stop writes.
2. Copy the original database to a recovery location.
3. Attempt SQLite integrity/recovery tooling.
4. Offer restore from latest verified backup.
5. Export recoverable rows if full restore fails.
6. Never silently create an empty replacement database.

## 13. Editor Experience

### 13.1 CodeMirror Markdown Editor

Use CodeMirror 6 because the product is developer-focused and Markdown must remain plain, portable text.

Features:

- syntax highlighting
- code fences
- checklists
- links
- find/replace
- keyboard shortcuts
- line wrapping
- autosave
- paste images
- drag/drop attachments
- task and note linking
- optional rendered preview

Do not build a complex Notion-style block editor in V1.

### 13.2 Autosave

- Debounce normal edits for 500-1000 ms.
- Save immediately on task switch, window blur, sleep, shutdown, and explicit close.
- Keep an in-memory edit journal until database confirmation.
- Show non-intrusive saving/error state.
- Never discard unsaved content after navigation.

### 13.3 Markdown Safety

- Sanitize rendered HTML.
- Disable raw HTML by default.
- Validate external protocols before opening.
- Open links through controlled native opener.
- Do not execute embedded scripts.

## 14. Search and Recall

V1 search uses local SQLite FTS5.

Search sources:

- task titles/descriptions
- notes
- work-log entries
- external reference titles/IDs
- workspace/folder names

Filters:

- date range
- workspace
- task
- entry type
- visibility
- source
- status

Future semantic search is optional and local-first. It must not replace exact search or require uploading private content.

## 15. Reports

### 15.1 Report Types

- Daily summary
- Weekly summary
- Custom date-range report
- Task timeline
- Workspace summary
- Blocker/decision report

### 15.2 Deterministic Report Builder

Reports work without AI:

1. Select report-eligible entries.
2. Group by task/workspace/date/type.
3. Include linked external facts.
4. Render a structured draft.
5. Let the user edit.
6. Export or explicitly post.

### 15.3 AI-Assisted Report Builder

AI can:

- remove repetition
- improve clarity
- create concise summaries
- identify unresolved blockers and next steps

AI cannot:

- access private entries by default
- invent accomplishments
- infer performance
- post automatically
- alter the underlying work log

Before an AI call, show:

- which entries will be sent
- provider/model
- redacted preview
- estimated scope

## 16. Integrations

### 16.1 Integration Philosophy

- External systems remain sources of truth.
- Begin with smart links, then read-only imports, then confirmed writeback.
- Use official APIs.
- Request minimal scopes.
- Store credentials locally.
- Sync must be observable and recoverable.
- Never let provider downtime block local work.

### 16.2 Connector Contract

```typescript
interface IntegrationConnector {
  provider: string;
  validateConfiguration(): Promise<ValidationResult>;
  authenticate(): Promise<AuthResult>;
  resolveUrl(url: string): Promise<ExternalReferencePreview | null>;
  listAssignedItems(cursor?: string): Promise<Page<ExternalItem>>;
  getItem(id: string): Promise<ExternalItem>;
  previewWriteback(input: WritebackInput): Promise<WritebackPreview>;
  executeWriteback(approved: ApprovedWriteback): Promise<WritebackResult>;
}
```

### 16.3 Smart Links V1

When a URL is pasted:

1. Recognize provider.
2. Store URL immediately.
3. Fetch metadata only if configured and online.
4. Cache title/status/ID.
5. Never block note saving if fetch fails.

### 16.4 OAuth And Credentials

- Use OAuth Authorization Code with PKCE where supported.
- Use desktop deep-link callbacks.
- Use personal access tokens only where OAuth is unavailable.
- Store secrets in OS keychain/Stronghold.
- Provide revoke/test/rotate controls.
- Redact credentials from logs and crash reports.

### 16.5 Sync Conflict Strategy

V1 integrations do not mirror full remote records.

Local personal fields:

- personal notes
- visibility
- next step
- local status/context

Remote fields:

- issue title
- remote status
- assignee
- labels
- remote comments/work logs

Provider refresh updates only remote-cache fields. It never overwrites local personal content.

### 16.6 Writeback

Every writeback follows:

```text
generate draft
-> show exact destination and payload
-> user edits/approves
-> send with idempotency key where possible
-> record result and remote ID
```

On uncertain timeout, query remote state before retrying to avoid duplicate comments/work logs.

## 17. Optional AI Architecture

### 17.1 Providers

Support an adapter interface for:

- local Ollama/OpenAI-compatible endpoints
- OpenAI-compatible remote providers
- other providers only after explicit adapters

No provider is enabled by default.

### 17.2 AI Data Policy

Default eligible content:

- entries marked `report`
- selected external metadata
- explicitly selected notes

Never include:

- private entries
- integration credentials
- attachment contents without selection
- unrelated workspace content

### 17.3 AI Failure Handling

- AI failure never blocks deterministic reports.
- Quota/rate errors show a clear local message.
- Invalid output is discarded, not merged silently.
- Original content is always preserved.
- Generated summaries are labeled until accepted.

## 18. Privacy and Anti-Surveillance Guardrails

These are product requirements, not marketing language.

### 18.1 Visibility

Every note/work-log entry has:

- `private` default
- `report`
- `shared` reserved for future collaboration

Report generation only uses `report` entries unless the user explicitly selects additional content.

### 18.2 Forbidden Product Features

Do not implement:

- keystroke tracking
- screenshot surveillance
- webcam/microphone monitoring
- automatic idle-time judgments
- productivity scores
- manager access to private data
- hidden background reporting
- automatic sharing

### 18.3 Telemetry

Default: no product analytics.

If optional diagnostics are later introduced:

- opt-in
- documented event schema
- no content, titles, URLs, filenames, or integration metadata
- locally inspectable
- easy to disable

## 19. UI and Visual Design

### 19.1 Product Feel

The app should feel like a serious lightweight editor:

- fast
- quiet
- keyboard-friendly
- dense but readable
- low ceremony
- no dashboard theater

### 19.2 Layout

Desktop:

```text
activity rail | workspace/sidebar | main editor/timeline | optional inspector
```

The main surface is never trapped inside decorative cards.

### 19.3 Primary Screens

#### Today

- Continue task
- Active task/session
- Today's timeline
- Next steps
- Recent blockers

#### Inbox

- Fast processing list
- Inline convert/move/archive actions

#### Task

- Compact header with status, last meaningful update, and next step
- One persistent `What happened?` composer
- One chronological mixed-content thread
- Inline editing with edited timestamp and revision history
- Optional context inspector for task brief, references, attachments, and stable metadata
- Compact thread filters; no primary task-content tabs

#### Note

- Editor-first layout
- Breadcrumb
- Backlinks/task relation
- Minimal metadata inspector

#### Reports

- Date/workspace/task filters
- Included-entry preview
- Deterministic draft
- Optional AI polish
- Export/writeback actions

### 19.4 Accessibility

- WCAG 2.2 AA target.
- Full keyboard operation.
- Visible focus.
- Screen-reader labels.
- Reduced-motion support.
- No color-only statuses.
- Configurable font size and line height.

## 20. Performance Budgets

Target desktop experience:

- Cold launch to usable UI: under 2 seconds on a typical modern laptop.
- Quick capture window: under 300 ms after app is running.
- Note switch: under 100 ms for normal notes.
- Search results: under 150 ms for 100,000 text records.
- Autosave confirmation: under 500 ms locally.
- Idle memory target: under 150 MB; investigate regressions above this.
- No main-thread blocking operation above 50 ms without yielding or moving work.

Strategies:

- Virtualize long timelines/lists.
- Paginate history.
- Keep attachments outside SQLite.
- Use FTS5.
- Run expensive work in Rust/background workers.
- Cache rendered Markdown carefully.
- Load integrations lazily.

## 21. Bottlenecks and Solutions

### 21.1 Large History Database

Risk: Years of entries degrade search and timeline rendering.

Handling:

- FTS5 indexes.
- Cursor pagination.
- Virtualized lists.
- Archive views.
- Index maintenance and vacuum only when safe/idle.
- Benchmark using million-entry fixture.

### 21.2 Large Notes

Risk: Huge pasted logs freeze editor/rendering.

Handling:

- CodeMirror large-document testing.
- Disable expensive live preview beyond a threshold.
- Warn before embedding huge text.
- Offer attachment conversion for large logs.

### 21.3 Attachments Consume Disk

Handling:

- Show storage usage.
- Deduplicate by hash.
- Configurable attachment limit.
- Orphan cleanup after grace period.
- Never delete referenced files automatically without confirmation.

### 21.4 Integration API Rate Limits

Handling:

- Incremental refresh.
- ETag/conditional requests.
- Provider-specific backoff.
- Manual refresh.
- Cached data with visible freshness.
- Local features continue normally.

### 21.5 Webview Differences

Handling:

- Cross-platform Playwright/WebDriver tests where possible.
- Avoid unsupported CSS/web APIs without adapters.
- Native behavior tests on each release OS.
- Maintain an Electron fallback decision record, not a parallel implementation.

## 22. Edge Cases and Worst-Case Scenarios

### 22.1 App Crashes During Editing

Solution:

- In-memory edit journal.
- Frequent transactional autosave.
- Recover unsaved draft on restart.
- Show comparison before replacing saved content.

### 22.2 Computer Shuts Down During Active Session

Solution:

- On next launch, detect unclosed session.
- Ask user to set end time, discard, or continue.
- Never assume the entire offline duration was work.

### 22.3 System Clock Or Timezone Changes

Solution:

- Store UTC plus recorded timezone.
- Detect backwards/large jumps.
- Flag affected sessions for review.
- Reports render in user-selected timezone.

### 22.4 Duplicate Worklog Writeback

Solution:

- Generate stable writeback fingerprint.
- Store destination and remote result ID.
- On timeout, query destination before retry.
- Require user confirmation when remote state is uncertain.

### 22.5 Jira/GitHub Item Deleted Or Access Revoked

Solution:

- Keep local reference and cached title.
- Mark unavailable with last successful refresh.
- Never delete local notes/tasks.

### 22.6 OAuth Token Expires

Solution:

- Refresh if supported.
- Mark connector as attention-needed.
- Continue local use.
- Do not repeatedly open login windows.

### 22.7 User Accidentally Includes Private Notes In Report

Solution:

- Report builder begins with only `report` entries.
- Show exact included entries before export/post.
- Highlight manually added private entries.
- Keep export history and allow deletion.

### 22.8 AI Hallucinates Progress

Solution:

- AI receives structured source entries.
- Require source mapping for generated bullets.
- Show draft and source references.
- Never post automatically.
- Deterministic report remains available.

### 22.9 Browser Clears Web App Storage

Solution:

- Persistent-storage request where supported.
- Prominent backup status.
- Scheduled export reminders.
- Clearly recommend desktop for durable primary use.

### 22.10 Failed Database Migration

Solution:

- Create verified backup before migration.
- Transactional migration.
- Roll back application/database compatibility where possible.
- Offer safe-mode export/restore.
- Block writes rather than proceeding partially.

### 22.11 Update Breaks App

Solution:

- Signed updates.
- Staged/beta channel.
- Database backup before update.
- Retain previous installer/version.
- Separate schema compatibility rules.
- Provide rollback instructions.

### 22.12 User Stores Sensitive Company Information

Solution:

- Local-only default.
- Encryption/keychain roadmap.
- Clear AI/integration data previews.
- Export warnings.
- Configurable workspace-level AI prohibition.

### 22.13 External Link Contains Malicious Protocol

Solution:

- Allowlist `https`, `http`, and explicitly registered deep links.
- Confirm unknown protocols.
- Never pass unsanitized strings to shell commands.

### 22.14 Report Used As Performance Evidence

Solution:

- Reports state they summarize user-marked work entries.
- Do not show productivity scores or completeness claims.
- Export includes optional methodology note.
- Preserve user control over shared content.

## 23. Error Model

Errors are categorized:

- validation
- storage
- database/recovery
- integration authentication
- integration rate limit
- integration unavailable
- network offline
- AI provider
- export
- update

Every error response includes:

- stable code
- human-readable message
- whether retry is safe
- recovery action
- redacted diagnostics ID

Do not show raw stack traces in the UI.

## 24. Logging and Diagnostics

- Structured local logs.
- Rotate logs and cap disk usage.
- Redact tokens, URLs with secrets, note content, and titles.
- User can export diagnostics after preview.
- Crash reporting is opt-in and content-free.
- Correlate integration requests without storing payload bodies.

## 25. Import, Export, and Portability

### 25.1 Export

Support:

- Markdown directory
- JSON archive
- CSV reports
- attachment bundle
- complete encrypted backup later

### 25.2 Import

V1:

- DevThread JSON archive
- Markdown files/folders
- CSV tasks/work logs using mapping wizard

Import runs in preview mode:

- counts
- conflicts
- invalid rows
- destination workspace

No partial import is committed unless explicitly accepted.

## 26. Optional Sync Roadmap

Sync is deferred because it changes the security and conflict model substantially.

When introduced:

- Keep local SQLite authoritative for responsiveness.
- Use append-only change events.
- Encrypt data before remote storage where feasible.
- Support self-hosted sync.
- Resolve conflicts at field/entity level.
- Never use last-write-wins for long note content without preserving both versions.
- Keep remote sync optional.

Evaluate established local-first/sync technologies only after V1 usage reveals actual multi-device demand.

## 27. Security

### 27.1 Tauri Capabilities

- Grant minimum required capabilities per window.
- Quick capture window receives only capture-specific commands.
- No generic shell execution.
- No unrestricted filesystem access.
- Validate every IPC payload with generated contracts.

### 27.2 Network

- Integration requests only to configured/recognized hosts.
- TLS required except explicit localhost development mode.
- Redirect limits.
- Request timeouts and response size limits.
- Never render remote HTML directly.

### 27.3 Supply Chain

- Lock dependencies.
- Automated dependency review.
- Signed releases.
- Generate SBOM.
- Secret scanning.
- Reproducible release documentation.

## 28. Testing Strategy

### 28.1 Unit Tests

- Domain rules.
- Visibility filtering.
- Report selection.
- Connector mapping.
- Time/session calculation.
- Migration behavior.
- Markdown sanitation.

### 28.2 Integration Tests

- SQLite repositories and FTS.
- Backup/restore.
- Tauri command validation.
- OAuth callback handling.
- Provider rate-limit/auth/error handling.
- Export/import round trip.

### 28.3 End-To-End Tests

- First launch.
- Capture to Inbox.
- Convert to task.
- Start/stop/recover session.
- Add finding/blocker/next step.
- Resume next day.
- Generate report.
- Preview writeback.
- Recover after simulated crash.

### 28.4 Cross-Platform Matrix

Release testing:

- macOS latest and previous supported release, Apple Silicon.
- Windows 11.
- Ubuntu LTS and one common Wayland environment.
- Browser companion: current Chrome, Edge, Firefox, Safari.

### 28.5 Performance Tests

- 100,000 tasks/entries.
- 1,000,000 timeline events.
- 100 MB note/log.
- 10 GB attachments.
- slow provider APIs.
- repeated offline/online transitions.

## 29. Release and Distribution

### 29.1 Desktop

- Signed/notarized macOS DMG.
- Signed Windows installer.
- Linux AppImage and deb package initially.
- Signed Tauri updater artifacts.
- Stable and beta channels.

### 29.2 Web

- Static PWA deployment.
- Strict security headers.
- Persistent-storage guidance.
- Clear web-versus-desktop limitations.

### 29.3 Open Source

Recommended license: MPL-2.0.

Reason:

- Keeps modifications to core files open.
- Allows organizations to build private integrations around the product.
- Aligns with a privacy-focused open-source desktop application.

Include:

- README
- SECURITY.md
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- privacy model
- integration security guide
- release/signing documentation

## 30. Implementation Roadmap

### Phase 0: Task-Thread Dogfood Slice

Entry criteria:

- Thread-first product direction accepted.
- Tauri 2, React, Rust, and SQLite toolchain available on macOS.

Build:

- Compact Tauri/React task-thread shell.
- Rust-owned SQLite migration and repository.
- Task creation, selection, status, and next step.
- Typed work-log composer and chronological timeline.
- Draft recovery, inline editing, revision restoration, and trash undo.
- Selected-task persistence and manual backup/recovery documentation.

Exit criteria:

- A developer can add an update in under five seconds.
- Accepted entries and selected task survive restart.
- Failed saves retain composer content.
- Edited entries expose recoverable revisions.
- The application is used for two weeks of personal dogfooding.

Stop or revise if the developer does not regularly add work-log entries or
cannot resume work from a task thread.

### Phase 1: Personal Local-First MVP

Duration target: 5-7 weeks.

Build:

- Workspaces/folders.
- Inbox processing.
- Tasks and next steps.
- Notes/editor.
- Work-log timeline.
- Thread-first task view with persistent composer.
- Inline timeline entry editing and revision history.
- Active session and recovery.
- History/search.
- Deterministic daily/weekly reports.
- Export/backup/restore.
- Global quick capture.

Acceptance:

- Developer can use it for two weeks without account/internet.
- Developer can explain a task timeline in under one minute.
- Developer can add an update in under five seconds without navigating away.
- Edited entries expose edited timestamps and recoverable revisions.
- Crash/restart does not lose an accepted entry.

### Phase 2: Smart Context

Duration target: 3-5 weeks.

Build:

- Smart links.
- Jira/GitHub/GitLab metadata.
- Optional AI summaries.
- Report source mapping.
- Improved search and command palette.

Acceptance:

- External outages never block local work.
- AI summary cannot include private entries by default.

### Phase 3: Confirmed Integrations

Duration target: 5-7 weeks.

Build:

- Read-only integration inbox.
- OAuth/PAT management.
- Confirmed Jira/GitHub writeback.
- Calendar import.
- Integration diagnostics.

Acceptance:

- No duplicate writeback in timeout tests.
- User always previews destination payload.

### Phase 4: Web Companion and Optional Sync

Duration target: Separate discovery after V1 adoption.

Build only after validating demand:

- Web local mode.
- Encrypted optional sync.
- Self-hosted sync deployment.
- Conflict UI.

### Phase 5: Plugin Ecosystem

- Connector SDK.
- Private organization plugins.
- Import/export plugins.
- Optional local AI plugins.

### Deferred Track: Public Product Website

The public website starts only after the task-thread dogfood milestone has
validated the product direction and the real interface is visually stable.

Build:

- Single-page React/Vite static website.
- Real task-thread and Inbox product screenshots.
- GitHub-backed latest release/version information.
- Current release features, improvements, fixes, and known issues.
- Platform download links from actual GitHub Release assets.
- Links to repository, issues, discussions, documentation, security, privacy, and license.
- GitHub Actions deployment.

Acceptance:

- Website builds when GitHub metadata fetch fails by using validated fallback data.
- Displayed version and downloads match the latest stable GitHub Release.
- Website accurately represents the thread-first experience using real product media.
- Website meets all requirements in `docs/ai/WEBSITE_SPEC.md`.

## 31. Success Metrics

Avoid engagement metrics that incentivize surveillance.

Useful product metrics, collected only with explicit opt-in or user studies:

- Time to first capture.
- Percentage of captured items later organized.
- Percentage of active tasks with a next step.
- Time required to resume yesterday's work.
- Time required to produce an accurate weekly summary.
- User-reported reduction in forgotten context.
- Backup/restore success.
- Integration error and writeback-duplication rates.

Primary success test:

> After two weeks, can a developer accurately explain what happened with a task and continue it without reconstructing context from several tools?

## 32. Major Product Risks

### Risk: Becomes Another Task Manager

Mitigation:

- Work-log timeline and resume context remain central.
- Avoid Kanban and sprint planning in V1.
- Measure task resumption/report value, not task completion counts.

### Risk: Feels Like Surveillance

Mitigation:

- No team dashboards or automatic activity tracking.
- Private default.
- Clear data-flow previews.
- No account required.
- Open-source code.

### Risk: Users Do Not Log Work

Mitigation:

- Global quick capture.
- Typed slash commands.
- Active-task context.
- End-of-day prompts that are optional and useful.
- Smart links and future integration imports.

### Risk: Integration Complexity Consumes Product

Mitigation:

- Smart links first.
- Adapter contract.
- One connector at a time.
- External tools remain source of truth.
- Core app works without integrations.

### Risk: Cross-Platform Desktop Maintenance

Mitigation:

- Tauri capability boundary.
- Automated matrix builds.
- Release testing checklist.
- Desktop-first supported platform policy.

## 33. Definition Of V1 Done

V1 is complete when a developer can:

1. Install DevThread on macOS, Windows, or Linux.
2. Use it without an account or network.
3. Capture an unsorted note/task/link instantly.
4. Organize it into a workspace/folder.
5. Track findings, blockers, decisions, progress, and next steps against a task.
6. Resume yesterday's work with context.
7. Search their work history.
8. Generate an editable daily, weekly, or custom-date report using only report-eligible entries.
9. Export all data in portable formats.
10. Recover from a crash and restore a verified backup.
11. Add smart external links without compromising local work when providers are unavailable.
12. Understand exactly what data any optional AI or integration action will receive.
13. Visit a public single-page website that accurately shows the product and exposes verified current-version/download information from GitHub.

## 34. Primary References

- Local-first software principles: https://www.inkandswitch.com/local-first/
- ActivityWatch privacy-first local tracking: https://activitywatch.net/
- Super Productivity developer integrations: https://super-productivity.com/for/developers
- Super Productivity integration philosophy: https://super-productivity.com/use-cases/integrations/
- Tauri updater: https://tauri.app/plugin/updater/
- Tauri JavaScript plugin references: https://tauri.app/reference/javascript/
- Electron security checklist, used as a general desktop-webview threat reference: https://www.electronjs.org/docs/latest/tutorial/security
- SQLite WASM/OPFS documentation: https://www.sqlite.org/wasm
- CodeMirror: https://codemirror.net/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
