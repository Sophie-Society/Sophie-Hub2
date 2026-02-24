# Sophie Hub v2 — Full Codebase Audit Report

**Date:** 2026-02-23
**Branch:** `Martin-Reporting-Tests`
**Scope:** All `.ts` and `.tsx` files under `src/` (488 files)
**Rules Tested Against:** `CLAUDE_CODE_RULES.md` + `CLAUDE_SUPABASE_QUERY_GUIDELINES.md`

---

## Summary

| Metric | Count |
|--------|-------|
| **Total violations found** | **~830** |
| Critical (security / data integrity) | 5 |
| High (type safety / architecture) | ~790 |
| Medium (performance / patterns) | ~25 |
| Low (naming / style) | ~10 |

> The codebase has **excellent architecture** (clean layer separation, no Supabase in components, proper auth guards) but has significant **type hygiene debt** (691+ missing return types, 97 console statements) and a handful of **critical security/performance** issues.

---

## Critical Violations

### CRIT-1: CRON_SECRET Authentication Bypass

- **File:** [route.ts:26-27](src/app/api/cron/reporting-sync/route.ts#L26-L27)
- **Rule:** CLAUDE_CODE_RULES §10, §15 (Auth Rules, Security Rules)
- **Issue:** Endpoint does NOT check if `CRON_SECRET` env var is configured before comparing. If `CRON_SECRET` is `undefined`, an attacker can bypass auth with `Authorization: Bearer undefined`.
- **Contrast:** All other cron routes (`slack-analytics`, `slack-clickup-sync`, `slack-sync`, `partner-type-reconciliation`) properly validate:
  ```typescript
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return apiError('INTERNAL_ERROR', 'Cron secret is not configured', 500)
  }
  ```
- **Impact:** Unauthorized access to reporting sync endpoint.

### CRIT-2: N+1 Loop — 1000 Sequential UPDATE Queries

- **File:** [route.ts:165-191](src/app/api/admin/repair-mappings/route.ts#L165-L191)
- **Rule:** SUPABASE_GUIDELINES §8.1 (No N+1 patterns)
- **Issue:** `for..of` loop calls `.update()` per mapping inside the loop. 1000 broken mappings = 1000 sequential DB queries.
- **Impact:** Endpoint timeout / DB connection exhaustion on large repair operations.

### CRIT-3: `select('*')` Fetching source_data JSONB for 5000 Partners

- **File:** [partner.repository.ts:37](src/lib/repositories/partner.repository.ts#L37)
- **Rule:** SUPABASE_GUIDELINES §4.1 (Select Only What You Need), §12.2 (Avoid Expensive Patterns)
- **Issue:** `findPartners()` uses `.select('*')` with `.limit(5000)`. The `source_data` JSONB column can be 5–50KB per partner. Total payload: **up to 250MB+**.
- **Called by:** Partners list page, health heatmap (which also requests `limit=5000`)
- **Impact:** Massive response times, memory consumption, bandwidth waste.

### CRIT-4: Missing soft-delete Filter on Partner Repository

- **File:** [partner.repository.ts:35-60](src/lib/repositories/partner.repository.ts#L35-L60)
- **Rule:** SUPABASE_GUIDELINES §5.3 (Query-Side Enforcement — CRITICAL)
- **Issue:** `findPartners()` does NOT include `.is('deleted_at', null)`. Soft-deleted partners may appear in lists.
- **Impact:** Data integrity — deleted partners visible to users.

### CRIT-5: Zod Error Messages Exposed to Client (3 endpoints)

- **Files:**
  - [partner-type-reconciliation/route.ts:55](src/app/api/admin/partners/partner-type-reconciliation/route.ts#L55)
  - [partner-type-reconciliation/route.ts:90](src/app/api/admin/partners/partner-type-reconciliation/route.ts#L90)
  - [runs/route.ts:59](src/app/api/sync/runs/route.ts#L59)
  - [staff/route.ts:131](src/app/api/staff/route.ts#L131)
- **Rule:** CLAUDE_CODE_RULES §7 (No internal details leaked), §15 (Security Rules)
- **Issue:** Raw `validation.error.message` returned in API response instead of using `apiValidationError()`.
- **Impact:** Exposes internal validation schema structure to attackers.

---

## High Violations

### HIGH-1: Missing Return Types on Exported Functions — **691+ instances**

- **Rule:** CLAUDE_CODE_RULES §3.1 ("All exported functions MUST have explicit return types")
- **Breakdown:**

| Category | Count | Examples |
|----------|-------|---------|
| React Components | 120+ | `HealthDistributionCard()`, `AISuggestAllDialog()`, `BigQueryDataPanel()` |
| API Route Handlers | 90+ | `GET(request)`, `POST(request)` across all route.ts files |
| Custom Hooks | 30+ | `useViewBuilderData()`, `useFlowData()`, `useFlowFilters()` |
| Utility Functions | 50+ | `layoutSourceNodes()`, `transformToFlowElements()` |
| Other Exports | 400+ | Various exported constants, helpers, config functions |

### HIGH-2: Console Statements Instead of Pino Logger — **97 instances**

- **Rule:** CLAUDE_CODE_RULES §6 ("NEVER `console.log` — use the project logger")
- **Breakdown:**

| File | console.error | console.log |
|------|--------------|------------|
| `src/components/data-enrichment/browser/source-browser.tsx` | 11 | — |
| `src/components/data-enrichment/bigquery/partner-mapping.tsx` | 7 | 1 |
| `src/components/google-workspace/gws-staff-mapping.tsx` | 6 | — |
| `src/components/slack/slack-staff-mapping.tsx` | 4 | — |
| `src/app/(dashboard)/admin/feedback/page.tsx` | 2 | — |
| Various other components & API routes | ~55 | ~11 |

- **Acceptable exceptions (not counted above):**
  - `src/lib/logger.ts` — logger implementation itself
  - `src/app/error.tsx`, `src/app/global-error.tsx`, `src/components/error-boundary.tsx` — error boundaries
  - `src/scripts/seed-*.ts` — one-off scripts

### HIGH-3: Mutations Without `.select()` — **6+ instances**

- **Rule:** SUPABASE_GUIDELINES §7.1 ("Always Return the Mutated Row")
- **Files:**

| File | Line | Operation |
|------|------|-----------|
| `src/app/api/admin/repair-mappings/route.ts` | 179-182 | `.update()` without `.select()` |
| `src/app/api/admin/settings/[key]/route.ts` | 113-116 | `.delete()` without `.select()` |
| `src/app/api/bigquery/partner-mappings/route.ts` | — | `.update()` / `.insert()` without return |
| `src/app/api/bigquery/portfolio-query/route.ts` | — | `.insert()` into query_logs without return |
| `src/app/api/bigquery/query/route.ts` | — | `.insert()` into query_logs without return |
| `src/app/api/data-sources/reorder/route.ts` | 30-37 | `.update()` in loop without `.select()` |

### HIGH-4: `select('*')` Without Justifying Comments — **8+ instances**

- **Rule:** SUPABASE_GUIDELINES §4.1 ("NEVER use `select('*')` unless you genuinely need every column")
- **Files:**

| File | Line | Table |
|------|------|-------|
| `src/app/api/modules/route.ts` | 21 | `modules` |
| `src/app/api/modules/dashboards/[dashboardId]/route.ts` | 32, 42, 49 | dashboards/modules |
| `src/app/api/ai/summarize-feedback/route.ts` | 49 | `feedback` |
| `src/app/api/ai/suggest-implementation/route.ts` | 77 | `feedback` |
| `src/app/api/slack/analytics/summary/route.ts` | 65 | metrics |
| `src/app/api/slack/analytics/response-times/route.ts` | 47 | metrics |

- **Acceptable (with comments):** `src/app/api/mappings/load/route.ts` — documented as intentional.

### HIGH-5: Missing Error Checks on Supabase Queries

- **Rule:** SUPABASE_GUIDELINES §3 ("ALWAYS check `error` before using `data`")
- **Files:**

| File | Line | Issue |
|------|------|-------|
| `src/app/api/admin/repair-mappings/route.ts` | 90-98 | Count query — error not checked |
| `src/app/api/admin/repair-mappings/route.ts` | 268-274 | Multiple count queries — error not checked |
| `src/app/api/stats/tables/route.ts` | 107 | Count result used without error check |

---

## Medium Violations

### MED-1: Unbounded Queries Without `.limit()` — 2 instances

- **Rule:** SUPABASE_GUIDELINES §4.3, §4.5 (Pagination / Bounded Queries)
- **Files:**

| File | Line | Issue |
|------|------|-------|
| `src/lib/sync/engine.ts` | 211-215 | Fetches ALL `tab_mappings` for a data source — no limit |
| `src/app/api/modules/route.ts` | 19-23 | Fetches all modules — no limit |

### MED-2: Missing `.order()` on Multi-Row Queries — 1 instance

- **Rule:** SUPABASE_GUIDELINES §4.4 (Ordering MANDATORY for list queries)
- **File:** [partner.repository.ts:71-76](src/lib/repositories/partner.repository.ts#L71-L76) — `partner_assignments` query without `.order()`.

### MED-3: N+1 Pattern — Data Source Reorder

- **File:** [reorder/route.ts:30-37](src/app/api/data-sources/reorder/route.ts#L30-L37)
- **Rule:** SUPABASE_GUIDELINES §8.1
- **Issue:** `sourceIds.map()` with `await` inside — calls `.update()` per source ID without batching.

### MED-4: Health Heatmap Requests 5000 Items

- **File:** [health-heatmap.tsx:293](src/components/partners/health-heatmap.tsx#L293)
- **Rule:** SUPABASE_GUIDELINES §4.3 (Bounded Queries)
- **Issue:** `params.set('limit', '5000')` — fetches all partners for heatmap. Should implement virtualization or smaller pages.

### MED-5: `select('*')` on Directory Snapshot Without Pagination

- **File:** [bootstrap/route.ts:74](src/app/api/google-workspace/staff/bootstrap/route.ts#L74)
- **Rule:** SUPABASE_GUIDELINES §4.1, §4.3
- **Issue:** Fetches entire directory snapshot without limit. If 500+ users, could be 50–100MB.

### MED-6: Untyped Supabase Clients in Scripts

- **Rule:** SUPABASE_GUIDELINES §1.3 ("ALWAYS use the `Database` generic")
- **Files:**

| File | Line |
|------|------|
| `src/scripts/seed-reporting-calendar.ts` | 20 |
| `src/scripts/seed-reporting-config.ts` | 22 |

- **Note:** Acceptable for utility scripts but should be typed if extended.

### MED-7: Debug Endpoint Exposes Token Info

- **File:** `src/app/api/debug/token-info/route.ts`
- **Rule:** CLAUDE_CODE_RULES §15 (Security — never expose tokens)
- **Issue:** Returns full Google tokeninfo. Should be admin-only or removed in production.

---

## Low Violations

### LOW-1: Default Exports — 57 instances

- **Rule:** CLAUDE_CODE_RULES §2 ("Generate named exports only")
- **Breakdown:**

| Category | Count | Acceptable? |
|----------|-------|-------------|
| Next.js Pages (`page.tsx`) | 35 | Yes — Next.js convention |
| Loading states (`loading.tsx`) | 12 | Yes — Next.js convention |
| Error boundaries (`error.tsx`) | 2 | Yes — Next.js convention |
| Root layouts (`layout.tsx`) | 3 | Yes — Next.js convention |
| Regular components | 5 | **No** — should use named exports |

- **Components to fix:** `WorkflowCard.tsx`, `usage-charts.tsx`, `SyncButton.tsx`

### LOW-2: Explicit `any` Usage — 2 instances

- **File:** [route.ts:81, 89](src/app/api/mappings/load/route.ts#L81)
- **Rule:** CLAUDE_CODE_RULES §2 ("Use `unknown` if the type is genuinely uncertain")
- **Note:** Both have `eslint-disable-next-line` comments — intentionally suppressed.

### LOW-3: Shared Types in Component Files — 1 instance needing move

- **File:** [use-view-builder-data.ts:11-41](src/app/(dashboard)/admin/views/[viewId]/use-view-builder-data.ts#L11-L41)
- **Rule:** CLAUDE_CODE_RULES §3.2 ("ALL shared interfaces MUST live in `/types`")
- **Issue:** `AudienceRule`, `ViewDetail`, `ViewModuleAssignment` — exported from a hook file and imported by 3+ components.
- **Fix:** Move to `src/types/views.types.ts`

### LOW-4: Inline Reduce Without useMemo

- **File:** [sophie-marketplace-concept.tsx:251](src/components/marketplace/sophie-marketplace-concept.tsx#L251)
- **Rule:** CLAUDE_CODE_RULES §14 (Memoize expensive computations)
- **Issue:** `.reduce()` on a 4-item array in render body. Trivial impact but bad pattern.

---

## Architecture Strengths (No Issues Found)

| Area | Status |
|------|--------|
| Supabase imports in components/hooks | ✅ Zero violations |
| Business logic in components | ✅ Clean — all delegated to hooks/services |
| Direct DB calls in services | ✅ Properly in repositories |
| Deep relative imports (`../../..`) | ✅ Zero violations — all use `@/` |
| Auth on mutation endpoints | ✅ All guarded with `requireAuth()` / `requireRole()` |
| Environment validation | ✅ Zod schema at `src/lib/env.ts` |
| No hardcoded secrets | ✅ Zero found |
| Service key protection | ✅ Only in `src/lib/supabase/admin.ts` (server-side) |
| XSS prevention | ✅ No `dangerouslySetInnerHTML`, `innerHTML`, or `eval()` |
| Dynamic imports for heavy libs | ✅ Excalidraw and UsageCharts properly lazy-loaded |
| `"use client"` directives | ✅ All 170+ justified by client-side feature usage |

---

## Recommended Fix Order

### Priority 1: Security (Immediate)

| # | Issue | Effort | Fix |
|---|-------|--------|-----|
| 1 | CRIT-1: CRON_SECRET bypass | 5 min | Add `if (!cronSecret)` guard |
| 2 | CRIT-5: Zod error exposure (4 endpoints) | 15 min | Replace with `apiValidationError()` |
| 3 | MED-7: Debug token-info endpoint | 5 min | Add admin-only guard or remove |

### Priority 2: Data Integrity (Same Day)

| # | Issue | Effort | Fix |
|---|-------|--------|-----|
| 4 | CRIT-4: Missing soft-delete filter | 10 min | Add `.is('deleted_at', null)` to `findPartners()` |
| 5 | HIGH-5: Missing error checks | 15 min | Add `if (error)` guards to 3 queries |
| 6 | HIGH-3: Mutations without `.select()` | 30 min | Chain `.select()` on 6 mutations |

### Priority 3: Performance (This Week)

| # | Issue | Effort | Fix |
|---|-------|--------|-----|
| 7 | CRIT-3: `select('*')` with source_data for 5000 rows | 30 min | Specify columns in `findPartners()` |
| 8 | CRIT-2: N+1 in repair-mappings | 1 hr | Batch updates instead of loop |
| 9 | MED-3: N+1 in reorder endpoint | 30 min | Use `Promise.all()` or batch |
| 10 | MED-4: Heatmap fetches 5000 items | 2 hr | Implement virtualization |

### Priority 4: Type Safety (This Sprint)

| # | Issue | Effort | Fix |
|---|-------|--------|-----|
| 11 | HIGH-1: 691+ missing return types | 4-8 hr | Add return types in batches (API routes → hooks → utils → components) |
| 12 | LOW-2: 2 explicit `any` | 15 min | Replace with proper types or `unknown` |
| 13 | LOW-3: Types in wrong location | 15 min | Move to `src/types/views.types.ts` |

### Priority 5: Code Hygiene (Ongoing)

| # | Issue | Effort | Fix |
|---|-------|--------|-----|
| 14 | HIGH-2: 97 console statements | 2-3 hr | Replace with `createLogger()` calls |
| 15 | LOW-1: 5 non-Next.js default exports | 15 min | Convert to named exports |
| 16 | HIGH-4: 8 unjustified `select('*')` | 1 hr | Specify columns or add comments |

---

## Appendix: Files Scanned

- **Total TypeScript files:** 488
- **API routes:** 128
- **Components:** 170+
- **Hooks:** 30+
- **Repositories:** 7
- **Services:** 3
- **Libraries/Utils:** 50+

---

*Report generated by automated codebase audit. All findings are static analysis — no code was modified.*
