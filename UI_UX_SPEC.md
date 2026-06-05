# Taskline UI/UX Specification

Status: Authoritative product interaction and visual direction  
Prepared: 2026-06-04  
Applies to: Desktop V1 and shared web companion UI

## 1. Defining Interaction

Taskline is a thread-first developer work journal.

The defining interaction is:

```text
type one update
-> press Cmd/Ctrl + Enter
-> update appears in the task timeline
-> continue working
```

The interface must make adding context feel lighter than opening Jira, formatting a report, or creating a structured note.

The task screen must not resemble an issue-management detail screen. Do not introduce primary content tabs for Notes, Worklog, Links, Images, or History.

## 2. Product Feel

Taskline should feel like a serious lightweight editor:

- calm
- immediate
- private
- keyboard-native
- compact
- trustworthy
- developer-focused

It should not feel like:

- Jira
- a manager analytics dashboard
- a CRM
- an employee time tracker
- a card-heavy SaaS application
- a Notion-style block editor

## 3. Information Architecture

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

Utilities:

- Command palette
- Global quick capture
- Active task indicator
- Search
- Integrations
- Settings

Desktop navigation uses one sidebar. Do not duplicate it with a floating bottom navigation.

## 4. Task Thread Screen

### 4.1 Layout

```text
sidebar | task thread | optional context inspector
```

The thread column is the visual center. Recommended readable width: `720-880px`.

The inspector is:

- collapsed by default on narrow windows
- optional on normal windows
- persistent only on wide windows
- never required to understand the thread

### 4.2 Task Header

The header is compact and factual:

```text
Payment filter UI implementation
In progress · DEV-402 · Updated 18 minutes ago

Next step: Confirm required API fields with the UI team
```

Header actions:

- change status
- set/edit next step
- start/pause active work
- open external reference
- more menu

Do not show:

- percentage-complete bars
- productivity scores
- work-hour charts
- oversized metadata blocks

### 4.3 Composer

The composer sits directly below the header and stays visible while near the top of the thread.

Placeholder:

```text
What happened?
```

Supporting hint:

```text
Add an update, finding, blocker, decision, link...
```

Default controls:

- Entry type selector: `Note`
- Visibility selector: `Private`
- Attachment button
- Add button

The controls remain visually quiet until the composer is focused.

Keyboard behavior:

- `Cmd/Ctrl + Enter`: submit
- `Shift + Enter`: newline
- `/`: open entry-type command menu
- `Esc`: close menus or restore compact composer
- paste/drop image: attach and create preview
- paste URL: create smart-reference preview without interrupting text entry

Slash commands:

```text
/progress
/finding
/blocker
/decision
/note
/next
/meeting
/interruption
/link
```

When a slash command is chosen, the entry-type control updates and the command text is removed from the submitted content.

Save behavior:

1. Preserve the draft until the local database confirms success.
2. Insert the new entry immediately after confirmation.
3. Keep focus in the composer.
4. Clear only the confirmed draft.
5. If saving fails, retain content and show a recoverable inline error.

### 4.4 Timeline Anatomy

Entries are grouped by meaningful date headings:

```text
Today
Yesterday
Monday, June 1
May 2026
Task started · January 10
```

Each entry displays:

- type icon/label
- occurred time
- content
- visibility indicator only when useful
- attachment/reference preview when present
- subtle edited state
- hover/focus actions

Example:

```text
11:18  Blocker
       API response takes 1.2 seconds with production-size data.
       Private · edited 11:24
```

Entries use the thread's continuous vertical rhythm. Avoid placing every entry inside a large independent card. Use light separators, a subtle timeline rail, or compact surface changes.

Entry colors:

- Note: neutral
- Progress: blue
- Finding: cyan/green
- Blocker: amber/red
- Decision: violet or distinct neutral accent
- Next step: blue with pin treatment
- Integration/reference: provider-neutral with small provider icon

Color is never the only type indicator.

### 4.5 Mixed Content

The timeline includes:

- text updates
- links and smart references
- screenshots and attachments
- status changes
- next-step changes
- work-session start/stop summaries
- external integration refreshes that matter

Do not record noisy system events such as every autosave or background refresh.

References and attachments remain in their chronological position. The inspector may list them for scanning and clicking an item scrolls to its timeline entry.

### 4.6 Editing

Every user-created entry supports inline editing.

Editing flow:

1. Select edit from entry actions or press the edit shortcut while focused.
2. Entry body becomes an inline editor without navigating away.
3. Save with `Cmd/Ctrl + Enter`; cancel with `Esc`.
4. Update `updated_at`.
5. Write a revision record containing the previous content.
6. Display a subtle `edited` marker.

Example:

```text
Finding · Today, 10:52
Refresh clears selected filters.

edited 11:14
```

Selecting the edited marker opens revision history in a small dialog or inspector section.

Revision history shows:

- revision timestamp
- previous content
- current content
- restore action

Restoring a previous revision creates a new revision. It never erases later history.

Guidance:

- Fixing wording or correcting facts: edit entry.
- Recording a later discovery or changed understanding: add a new entry.

### 4.7 Deletion

Deletion is soft and recoverable.

- First action moves entry to trash.
- Show undo toast.
- Trash restoration preserves original timestamps.
- Permanent deletion requires explicit confirmation.
- Reports immediately exclude trashed entries.

### 4.8 Filters

Thread filters are compact secondary controls:

- All
- Progress
- Findings
- Blockers
- Decisions
- References
- Report-eligible
- Search this thread

Use a filter menu or compact segmented control. Do not use large navigation tabs.

### 4.9 Context Inspector

The optional inspector contains stable context:

```text
Status
Next step
Workspace
Folder
Task brief
References
Attachments
Created
Last meaningful update
```

The task brief is one editable Markdown document for stable requirements, acceptance criteria, or implementation notes.

The inspector must not compete visually with the thread. It uses a narrower width, smaller headings, and compact sections without nested cards.

## 5. Today Screen

The first screen is `Today`, not `Dashboard`.

Its purpose is resumption, not measurement.

Priority order:

1. Continue where you stopped
2. Active task and next step
3. Today's thread across tasks
4. Open blockers
5. Inbox requiring attention
6. Recent external changes

Do not lead with:

- total hours
- task completion percentages
- productivity analytics
- high-priority task counts

If time/session information is enabled, show it quietly as contextual metadata.

## 6. Inbox Screen

The Inbox screen preserves the strong visual prototype direction:

- prominent quick-capture composer
- compact feed
- mixed note/link/image/task items
- inline process actions

Actions:

- attach to task
- convert to task
- move to workspace/folder
- archive
- delete

Actions must be available on keyboard focus and through a context menu, not hover only.

Rename `Quick Organize` to `Process Inbox`.

## 7. Visual System

### 7.1 Typography

Primary UI font:

- **Geist Sans**, bundled locally

Monospace font:

- **JetBrains Mono**, bundled locally

Usage:

- Geist: navigation, titles, body, buttons, labels
- JetBrains Mono: timestamps, external IDs, slash commands, code, compact metadata

Recommended scale:

| Token | Size | Line height | Use |
|---|---:|---:|---|
| `display` | 26px | 34px | Task/note title |
| `heading-lg` | 20px | 28px | Screen heading |
| `heading-md` | 16px | 24px | Section heading |
| `body` | 14px | 21px | Main UI text |
| `body-small` | 13px | 19px | Secondary text |
| `label` | 12px | 16px | Controls and metadata |
| `mono-small` | 11px | 16px | Timestamps and IDs |

Rules:

- Letter spacing is `0`; do not use negative tracking.
- Avoid uppercase text except short entry-type labels where scanning benefits.
- User-authored thread content must remain comfortable for long reading.
- Support configurable font size and line height.

### 7.2 Color Direction

Retain the prototype's restrained charcoal foundation, but reduce blue dominance.

Dark theme semantic tokens:

```text
background:       #121313
surface-low:      #181919
surface:          #202121
surface-high:     #292a2a
border:           #3b3e42
text:             #e7e8e8
text-muted:       #a8adb4
primary:          #8fb4ff
progress:         #8fb4ff
finding:          #62d6ad
blocker:          #ffb86b
danger:           #ff8e86
decision:         #c2a7ff
```

Also provide a professionally designed light theme.

Rules:

- Use color semantically and sparingly.
- Avoid broad gradients, decorative orbs, and blur effects.
- Ensure WCAG 2.2 AA contrast.
- Borders and spacing carry most hierarchy.

### 7.3 Shape

- Cards/panels: maximum 6px radius.
- Inputs/buttons: 4-6px radius.
- Icon buttons: square with familiar symbols and tooltips.
- Avoid pill-shaped controls except compact status/filter chips.
- Avoid floating decorative card sections.
- Never place cards inside cards.

### 7.4 Spacing

Base spacing unit: 4px.

Common values:

- compact control gap: 4px
- normal control gap: 8px
- component padding: 12px
- panel padding: 16px
- major section separation: 24px

Thread density must remain readable but compact enough for repeated daily use.

### 7.5 Icons

Use Lucide icons in production.

- Consistent stroke weight.
- Text labels where meaning is not universal.
- Tooltips for icon-only actions.
- Do not use remote Material Symbols.

### 7.6 Motion

Motion is functional:

- new entry insertion
- inline editor transition
- inspector opening
- menu/dialog appearance
- focus movement

Rules:

- 120-180ms for normal transitions.
- Avoid scaling every button on click.
- Respect reduced-motion settings.
- No decorative background animations.

## 8. Editor Behavior

The composer is intentionally simpler than the full note editor.

Composer:

- plain Markdown text
- slash commands
- pasted links/images
- short multiline content
- no always-visible formatting toolbar

Full note/task brief editor:

- CodeMirror 6
- Markdown shortcuts
- code fences/checklists/links
- find and replace
- optional split preview

Do not make the thread composer a rich block editor.

## 9. Responsive Behavior

### Wide Desktop

```text
sidebar 220-248px | thread max 880px | inspector 280-320px
```

### Normal Desktop

```text
sidebar 208-232px | centered thread | inspector collapsed
```

### Narrow/Desktop Small Window

- Sidebar collapses to activity rail or drawer.
- Thread uses full remaining width.
- Inspector opens as overlay/drawer.
- Composer controls wrap without hiding primary add action.

### Mobile/Web Companion

- Bottom navigation may be used only on true mobile layouts.
- Composer remains reachable near the top and through a floating capture action.
- Inspector becomes a drawer.
- Timeline remains the primary view.

## 10. Keyboard Map

Recommended defaults:

```text
Cmd/Ctrl + K          Command palette
Cmd/Ctrl + Shift + N  Global quick capture
Cmd/Ctrl + Enter      Submit composer / save inline edit
Shift + Enter         Newline
E                     Edit focused entry
R                     Mark focused entry report-eligible
P                     Pin/unpin focused entry
/                     Entry-type command menu in composer
Esc                   Close/cancel
J / K                 Next/previous timeline entry when thread focused
```

All shortcuts must be configurable and discoverable in the command palette.

## 11. Accessibility Requirements

- WCAG 2.2 AA target.
- Every timeline entry is a navigable semantic article/list item.
- Entry type is announced in text.
- Inline editing manages focus predictably.
- New-entry insertion announces success without stealing focus.
- Actions exposed on hover are also exposed on focus.
- Color is never the only status/type signal.
- Reduced motion supported.
- Font size and line height configurable.

## 12. Anti-Jira Guardrails

Reject UI proposals that introduce:

- separate Notes/Worklog/Links/Images/History task tabs
- percentage-complete bars
- mandatory metadata before writing an update
- large issue property tables
- manager/assignee avatars in personal V1
- activity analytics as the first screen
- task updates hidden behind dialogs
- separate attachment/link pages that remove chronological context

The task thread must always answer:

> What happened, in what order, why did it change, and what should happen next?

## 13. Implementation Acceptance Criteria

The task-thread UX is acceptable when:

1. A user can add a normal update in under five seconds.
2. Submission keeps keyboard focus ready for another update.
3. Saving failure never loses the draft.
4. A link or screenshot appears at the correct chronological point.
5. An edited entry shows an edited timestamp and recoverable revision history.
6. The user can understand a week-old task without opening another view.
7. The screen contains no primary content tabs.
8. The thread remains usable with 10,000 entries through pagination/virtualization.
9. Every action is keyboard accessible.
10. The layout remains coherent with the inspector closed.
