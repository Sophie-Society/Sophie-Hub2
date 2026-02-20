# SHAZAM Blueprint — Views Module Selection

Date: 2026-02-16
Owner: Views Builder
Route: `/admin/views/[viewId]`

## Why this exists

The current experience still mixes two mental models:
- module internals (widgets inside Amazon Reporting)
- view composition (placing modules on a view page)

For Views, the source of truth must be:
- **modules are the layout blocks**
- **Dashboard is the default section for every view**
- module-internal widget editing is a secondary action

## SHAZAM Contract for this surface

- **S**himmer-first loading for canvas and module cards
- **H**ierarchy with one clear primary action: compose module layout
- **A**ffordance clarity for drag, resize, select, and remove
- **Z**ero-jank transitions between read and compose modes
- **A**ccessible controls with keyboard/focus parity
- **M**obile/tablet parity for preview frames and controls

## Information Architecture (must)

1. Left preview-nav (inside iframe)
- Always shows `Dashboard` first.
- Additional sections are optional and user-created.
- No auto-generated section noise.

2. Main canvas
- Canvas contains module blocks (not module internals by default).
- Each block represents one assigned module.
- Block can be moved and resized on an 8-column snap grid.

3. Secondary editing
- Clicking `Edit module` opens the module-internal editor.
- This is a child workflow, not the default display.

## Compose UX model

1. Read mode
- Clean dashboard with module blocks and subtle metadata.
- No drag handles visible.

2. Compose mode
- Shows drag handles, resize handles, block bounds.
- Add module entry point is visible in header and empty slots.
- Delete/remove block affordance is visible on each block.

3. Section management
- `+ Add section` uses app dialog/sheet, never browser `prompt`.
- Section row supports rename and delete in compose mode.
- Section icon:
  - default icon from app icon set
  - optional emoji picker in edit flow (standard unicode emoji)

## Visual system (SHAZAM styling direction)

1. Canvas density
- Max content width: `1200-1320px` feel on desktop.
- 8-col grid, `16px` gutters, `16px` row gap.
- Minimum block size: `2 cols x 2 rows`.

2. Block appearance
- Soft card with clear title and module type.
- Stable height rhythm; no sudden jumps during load.
- “Use block” / “Edit module” buttons are compact tertiary controls.

3. Empty/first-time state
- Show 2-3 suggested blocks with one-click placement.
- Suggested area matches real block dimensions.
- Copy: “Place modules to design this view”.

4. Loading states
- Shimmer bars for section headers.
- Shimmer block skeletons for module cards.
- No isolated spinner-only state for primary canvas.

## Interaction requirements

1. Drag behavior
- Snap to grid only.
- Show ghost placeholder and occupied-cell feedback.
- Invalid drops bounce back without layout shift.

2. Resize behavior
- Bottom-right handle.
- Clamp to min and max per block type.
- Persist immediately after interaction end.

3. Selection behavior
- Selected block gets a clear outline and header state.
- Keyboard focus mirrors pointer selection.

4. Remove behavior
- Remove action is explicit in compose mode.
- Confirm via lightweight dialog/toast undo pattern.

## Motion and timing

Follow `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/UX-STANDARDS.md`:
- enter/exit: `ease-out`, `150-250ms`
- movement/reflow: `ease-in-out`
- no page-load flourish on frequent actions
- respect `prefers-reduced-motion`

## Accessibility

1. Keyboard
- All block actions reachable by tab.
- Arrow-key nudge for move and resize in compose mode.

2. Labels
- Icon-only actions have aria labels.
- Section controls include readable text or tooltip labels.

3. Contrast
- Selection ring and handles meet contrast on dark/light surfaces.

## Data contract

Persist per-module layout on the view assignment record:
- `view_profile_modules.config.layout.grid_column`
- `view_profile_modules.config.layout.grid_row`
- `view_profile_modules.config.layout.col_span`
- `view_profile_modules.config.layout.row_span`

This is view-scoped and must not mutate shared module templates.

## Non-goals (for this pass)

- Full freeform canvas (pixel-level absolute positioning)
- Cross-page multi-canvas editing in one session
- Rich media block library beyond current module set

## Acceptance checklist

1. Modules display as draggable/resizable blocks in compose mode.
2. Dashboard remains the only default section for new views.
3. Add section uses app UI (dialog/sheet), not browser prompt.
4. Delete section and remove module actions are available in compose mode.
5. Primary load uses shimmer, not spinner-only.
6. No accidental route/navigation when adding sections.
7. Module internal widgets are edited only after explicit `Edit module`.
8. Layout persists and reloads identically across refresh.

## References

- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/docs/features/view-builder/15-shazam-design-protocol.md`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/docs/features/view-builder/16-shazam-module-selection-pass.md`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/UX-STANDARDS.md`
- `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/docs/TEAM_COLLABORATION_GUIDE.md`
