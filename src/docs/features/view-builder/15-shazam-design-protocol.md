# SHAZAM Design Protocol (Views)

Date: 2026-02-16

## Purpose

Provide one short trigger word for UI polish checks so Codex/Claude run the same design pass every time.

## Trigger

Use: `SHAZAM`

Scoped shortcut for this feature area:
- `SHAZAM-VIEWS` = run SHAZAM specifically on `/admin/views` and `/admin/views/[viewId]`

## What SHAZAM means

- **S**himmer-first loading states (no isolated spinner-only waits for primary canvas states)
- **H**ierarchy audit (clear entry point, emphasis, spacing rhythm)
- **A**ffordance audit (edit/create/delete controls are visible and intentional)
- **Z**ero-jank transitions (no layout jump, no abrupt swap)
- **A**ccessibility checks (`prefers-reduced-motion`, contrast, keyboard reachability)
- **M**obile/tablet parity review (preview frame behavior + control clarity)

## MD References

- Emil loading/animation guidance: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/src/UX-STANDARDS.md`
- Interface design references: `/Users/test/Coding/Sophie-Data-Planning/sophie-hub-v2/docs/TEAM_COLLABORATION_GUIDE.md`

## Expected Output in a SHAZAM pass

1. Findings list (P1/P2/P3)
2. Concrete file-level fixes
3. Before/after verification checklist
4. Any follow-up MD updates for View Builder docs
