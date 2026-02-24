# SHAZAM Pass — Module Selection in Views

Date: 2026-02-16

## Scope

Apply SHAZAM to the `Dashboard` module-selection surface in `/admin/views/[viewId]` preview.

## Changes Applied

1. **Shimmer-first loading**
- Module preview loading now uses `ShimmerBar` + `ShimmerGrid` (no spinner-only states).

2. **Hierarchy**
- Dashboard canvas includes a compact guidance bar that explains mode behavior:
  - Normal mode: select a module block to edit internals
  - Edit mode: drag + resize module blocks

3. **Affordance clarity**
- Modules render as dedicated blocks/cards in an 8-column layout canvas.
- In Edit mode:
  - drag handle is visible on hover
  - resize handle appears on bottom-right
- CTA changed to explicit `Edit module`.

4. **Zero-jank interaction**
- Drag overlay and drop highlight use the existing snap-grid system (`use-grid-occupancy` + `GridCell`).
- Layout persists to `view_profile_modules.config.layout` via view-scoped API patch.

5. **Accessibility + parity**
- Uses existing button primitives and pointer constraints from the reporting builder stack.
- Sidebar stays minimal (`Dashboard` only) to reduce navigational noise in preview.

## File References

- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/module-block-canvas.tsx`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-shell.tsx`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/views/preview-module-content.tsx`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/components/reporting/widget-wrapper.tsx`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/api/admin/views/[viewId]/modules/route.ts`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/app/(preview)/preview/page.tsx`

## Follow-up (next SHAZAM slice)

1. Module block icon picker (emoji/icon library) per block.
2. Inline “remove block” affordance in canvas (with confirm).
3. Module density presets (full-width / half-width templates) for fast composition.
