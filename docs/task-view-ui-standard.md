# Task View UI Standard

This document captures the Task view direction after the sidebar, composer, timeline, and theme polish work. Use it as the implementation guide when bringing Release view and Archive view into the same product language.

## Goal

Task view should feel like a compact local developer workspace: fast to scan, quiet by default, and clear when the user is writing or reviewing work history. Avoid dashboard-style cards, heavy decoration, marketing copy, and duplicated controls.

## Theme Model

Keep the original pure `Default Dark` and `Default Light` themes available, but offer softer neutral options for screenshots and daily use:

- `Dark Gray`: a charcoal surface stack with visible depth between app background, panels, popovers, and muted rows.
- `Light Gray`: an off-white gray surface stack that keeps the app feeling like a desktop tool instead of a web page.

Theme rules:

- Use semantic CSS variables only: `background`, `card`, `popover`, `muted`, `accent`, `border`, `primary`, and chart variables.
- Do not hard-code one-off grays in components when a token exists.
- Keep chart variables defined for every theme.
- Treat black/white as defaults and gray themes as depth-focused alternatives.

## Shared Sidebar Pattern

The Task sidebar is the reference pattern for Release and Archive sidebars.

Behavior to reuse:

- Compact tree rows, not cards.
- Folder rows show icon + title + hover-only action when needed.
- Folder expansion uses indentation, not vertical folder borders.
- Selected rows use a simple background and text emphasis only.
- Search mode should show matching items only; do not show empty folders during search.
- Empty states should be short and specific.
- Long search strings and long row titles must truncate without layout growth.

Visual details to reuse:

- Header label uses calm title color, not loud uppercase treatment.
- Header actions are light icon buttons, not bordered buttons unless the action needs framing.
- Row spacing is tight enough for repeated daily use.

## Composer Pattern

The composer is the primary Task view interaction.

Current standard:

- Placeholder: `Type an update, blocker, note, progress...`
- The composer has a compact command/input feel, not a large form feel.
- The `@` entry type picker floats above the composer and must not change composer height.
- The toolbar row contains entry type, attach image, hint, and Add.
- Hint copy: `Hint: Type @ to change the content type (progress, blocker, etc)`
- Focus state sharpens the border and adds only a subtle shadow.
- Add button stays compact and visible.

Rules:

- Do not add a second instructional paragraph under the composer.
- Do not expose visibility/report controls until the reporting workflow returns.
- Keep all new entries private by default.
- Image attach is a tool, not a large upload zone.

## Timeline Pattern

The timeline is the signature Task view surface.

Current standard:

- Date headers use natural language with dashed separators.
- Expanded timeline uses a three-column structure: left time gutter, center rail, and right entry surface.
- Each day has one date section label; entries under that day show time only.
- `Today` and `Yesterday` labels should not repeat the calendar date.
- Each day has a faint dotted rail that spans the whole day, including single-entry days.
- Hovering the day area can animate the rail into a stronger solid line.
- Each entry has an entry-type dot anchored to the day rail.
- Entry type appears as a compact terminal-like token.
- Message content is the primary visual object.
- Timestamp/date context sits to the left of the rail; edited state can sit quietly inside the entry surface.
- Link previews are short horizontal rows with constrained width.
- Attached images stay compact and open into a viewer.

Rules:

- Avoid full-width link cards.
- Entry surfaces may be lightly framed, but they should stay compact and aligned to the rail.
- Keep indentation shallow.
- Use entry-type color only for dot/token accents, not whole rows.
- Motion should be subtle: hover sharpening, small dot scale, and simple transitions only.

## Header And Filters

Task header and timeline controls should remain visually separate from the timeline body without heavy borders.

Rules:

- Prefer background contrast over stacked borders.
- Keep search and filter controls compact.
- More/filter actions should use light icon treatment.
- Avoid duplicating helper text when a control already communicates the behavior.

## Text Hierarchy

Use text size and weight based on job:

- Task title: strongest.
- Timeline content: readable body text.
- Entry type, duration, timestamp: compact metadata.
- Sidebar rows: compact scanning text.
- Empty states: one short title and one short supporting line at most.

Do not use hero-scale text inside panels, sidebars, timelines, or toolbars.

## Release View Follow-Up

When updating Release view next:

- Use the same sidebar row density and search behavior.
- Use the same header/control restraint.
- Replace card-heavy repeated sections with compact rows where possible.
- Use the same status/token visual language for release tags and task references.
- Keep export/template tools compact and command-like.

## Archive View Follow-Up

When updating Archive view:

- Reuse the sidebar tree/search pattern.
- Show archived tasks as compact rows with restore actions.
- Keep destructive actions quiet but clear.
- Avoid making Archive feel like a separate product surface.

## QA Checklist

Before accepting related UI work:

- The view still feels like a desktop work tool.
- Sidebar rows do not grow unexpectedly.
- Composer height does not change when the `@` menu opens.
- Timeline link previews are constrained.
- Text truncates instead of wrapping in controls.
- Light and dark themes both preserve contrast and depth.
- Keyboard workflows still work for composer, menus, and search.
