# ADR 0001: Thread-First Product Direction

Status: Accepted  
Date: 2026-06-04

## Decision

DevThread is a thread-first developer work journal. Its defining interaction is
adding a typed update to a task timeline and later using that timeline to
resume or explain the work.

The initial dogfood milestone is not an editor-first product, issue tracker,
notes dashboard, or project-management suite. It uses a compact,
developer-oriented shell, but files, tabs, full-note editing, Inbox, Today,
reports, and integrations are secondary capabilities that must not displace
the task thread.

## Consequences

- The task thread, composer, and next step are the primary desktop surface.
- The first milestone validates daily personal use before expanding scope.
- `UI_UX_SPEC.md` is authoritative for interactions and visual direction.
- `PLAN.md` remains the architecture reference where it does not conflict with
  this decision or the narrowed dogfood milestone.
- Web, public website, AI, integrations, and cross-platform packaging remain
  deferred until validation.
