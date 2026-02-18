# View Builder — Codex Hotfix Update

Date: 2026-02-16  
Round: 14 (post-Wave-4 unblock pass)

## Why This Round Happened

Local/staging testing showed a hard blocker in Views edit mode:

- `Module has no template dashboard to fork. Create a dashboard for this module first.`

This prevented widget editing from starting in many real modules.

## Hotfixes Applied

### 1) Fork endpoint now has safe fallbacks (unblocks edit mode)

File:
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/admin/views/[viewId]/fork-dashboard/route.ts`

Changes:
- If no template dashboard exists for a module:
  - fallback to latest dashboard in that module (if any), else
  - auto-seed a minimal template dashboard + `Overview` section, then clone.
- Keeps the existing fork semantics:
  - template -> clone
  - non-template -> no-op
  - null assignment -> clone path

### 2) Clone correctness fix for section schema

File:
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/admin/views/[viewId]/fork-dashboard/route.ts`

Changes:
- Fixed section field from `is_collapsed` to `collapsed` to match schema.
- Section/widget clone operations now fail-fast on DB errors (no silent `continue`).
- Assignment update error is now checked explicitly.

### 3) Deterministic active-module targeting in preview

Files:
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-shell.tsx`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-module-content.tsx`

Changes:
- Removed automatic `activeModuleReport` emission from each inline module mount.
- Parent/iframe active module sync now follows explicit selection state.
- Inline module cards now expose explicit `Select for editing` control.
- Preview sends deselection on load to prevent stale parent targeting.

## Verification

- `npm run lint` -> pass
- `npm test -- --runInBand __tests__/view-builder-wave4-smoke.test.ts` -> pass (25/25)
- `npm run build` -> pass (existing dynamic-route warnings unchanged)

## Current Status vs Prior Review

From `13-codex-implementation-review.md`:

- P1 (fork clone schema + silent failures): **addressed in this round**
- P1 (active module nondeterministic): **addressed in this round**
- P1 (full inline drag/resize/widget-composer parity in preview): **still open**

## Remaining Gap (Next Build Slice)

To reach full "widgets in Views behave like module builder" parity, the remaining work is:

1. Replace read-only inline widget grid with editable composition primitives (`SectionContainer` / `WidgetWrapper`) in preview edit mode.
2. Wire `widgetEditRequested` / `addWidgetRequested` to real `WidgetConfigDialog` save flows (view-scoped widget APIs), not toasts.
3. Add behavior-level tests (route + UI) for widget CRUD from the Views builder interaction path.

