# DevThread Logo Ideas

DevThread should feel like a developer tool, not a generic todo app. The mark should survive at 16px in the sidebar, app dock, and release assets.

## Direction A: Threaded DevThread

Status: implemented as the first draft in `devthread-mark.svg`.

A vertical timeline with three task nodes. The short horizontal strokes form a subtle T/L shape, while the final angled segment suggests completion or a decision point.

Why it works:
- Directly connects to the product idea: task history, status, worklog, progress.
- Reads at small sizes because the silhouette is simple.
- Uses a developer-theme palette without becoming a terminal icon.

## Direction B: Prompt Line

A command prompt caret morphs into a timeline: `>` becomes the first branch, then two dots continue the line. This would feel more developer-native, but it may be less obvious as a task/work journal.

## Direction C: Linked Brackets

Two bracket shapes, like `{ }` or `[ ]`, connected by small dots. This says developer plus structure, but it risks looking like a generic code editor.

## Direction D: Commit Trail

A compact git-log line with one highlighted node and a tiny check path. Strong for engineers, but slightly closer to Git tooling than DevThread's broader work-journal idea.

## Current Palette

- Base: `#151823`
- Border: `#2F3650`
- Muted line: `#64708F`
- Planned/primary: `#8AA2FF`
- Active/worklog: `#12C99B`
- Done/decision: `#C678DD`
- Estimate/highlight: `#FFB454`
