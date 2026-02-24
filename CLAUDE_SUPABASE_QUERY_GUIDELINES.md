# CLAUDE_SUPABASE_QUERY_GUIDELINES.md

# 🚨 SUPABASE QUERY ENFORCEMENT FOR AI CODE GENERATION

This document defines **NON-NEGOTIABLE** rules for all Supabase database operations.

All generated code that touches Supabase MUST comply with every rule in this document.

This document extends `CLAUDE_CODE_RULES.md`. Where both apply, the stricter rule wins.

---

## 0. GOALS

Every database interaction MUST optimize for:

1. **Security** — tenant isolation, input validation, zero data leaks
2. **Performance** — minimal payload, indexed queries, bounded results
3. **Type Safety** — fully typed clients, queries, and responses
4. **Scalability** — patterns that work at 10 rows and 10 million rows

---

## 1. CLIENT SETUP

### 1.1 Singleton Clients (MANDATORY)

Never create a Supabase client inline. Always import from shared singletons in `/lib`.

**Server-side client** (`/lib/supabase-admin.ts`):

```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { env } from "@/lib/env";

export const supabaseAdmin = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
```

**Browser client** (`/lib/supabase-browser.ts`):

```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { env } from "@/lib/env";

export const supabaseBrowser = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

### 1.2 Usage in Repositories

All repository files import the singleton — never instantiate a client.

```typescript
import { supabaseAdmin } from "@/lib/supabase-admin";
```

### 1.3 Client Rules

- **NEVER** expose the service role key to the client.
- **NEVER** use the anon key on the server when elevated access is needed.
- **NEVER** create a new client per request — always use the singleton.
- **ALWAYS** use the `Database` generic for full type inference.

---

## 2. ARCHITECTURE ALIGNMENT

All Supabase queries MUST live in `/repositories` as defined in `CLAUDE_CODE_RULES.md`.

```
/repositories
  partner.repository.ts      ← all partner table queries
  staff.repository.ts         ← all staff table queries
  assignment.repository.ts    ← all assignment table queries
```

Rules:

- Components, hooks, and services MUST NOT import Supabase directly.
- Services call repositories. Repositories call Supabase.
- Every repository function MUST have an explicit return type.
- Every repository function MUST handle errors using the project logger (Pino).

**Pattern:**

```typescript
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import type { PartnerSummary } from "@/types/partner.types";

export const getActivePartners = async (): Promise<PartnerSummary[]> => {
  const { data, error } = await supabaseAdmin
    .from("partners")
    .select("id, name, status, tier")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    logger.error({ err: error }, "Failed to fetch active partners");
    throw new Error(`Failed to fetch active partners: ${error.message}`);
  }

  return data ?? [];
};
```

---

## 3. ERROR HANDLING

Every Supabase call returns `{ data, error }`. **ALWAYS** check `error` before using `data`.

### 3.1 Repository Layer

```typescript
const { data, error } = await supabaseAdmin
  .from("partners")
  .select("id, name")
  .eq("id", partnerId)
  .single();

if (error) {
  logger.error({ err: error, partnerId }, "Failed to fetch partner");
  throw new Error(`Failed to fetch partner: ${error.message}`);
}

return data;
```

### 3.2 API Route Layer

API routes catch repository errors and return the standard `ApiResponse` shape:

```typescript
try {
  const partner = await partnerRepository.getById(id);
  return NextResponse.json({ success: true, data: partner });
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  logger.error({ err: error }, message);
  return NextResponse.json(
    { success: false, error: "Database operation failed" },
    { status: 500 }
  );
}
```

Rules:

- **NEVER** ignore the `error` field.
- **NEVER** use empty catch blocks.
- **NEVER** use `console.log` or `console.error` — use Pino (`logger`).
- **NEVER** leak internal error details (table names, SQL, column names) to the client.
- **ALWAYS** log the full error server-side for debugging.

---

## 4. QUERY PATTERNS

### 4.1 Select Only What You Need

**NEVER** use `select('*')` unless you genuinely need every column. Specify columns explicitly.

```typescript
// CORRECT — explicit columns, minimal payload
const { data } = await supabaseAdmin
  .from("partners")
  .select("id, name, status, tier");

// WRONG — fetches large JSONB columns unnecessarily
const { data } = await supabaseAdmin
  .from("partners")
  .select("*");
```

**Exception:** When you genuinely need all columns (detail pages, sync operations), `select('*')` is acceptable. Add a comment explaining why:

```typescript
// Full row needed for sync comparison against Google Sheets source
const { data } = await supabaseAdmin.from("partners").select("*").eq("id", partnerId).single();
```

### 4.2 `.single()` vs `.maybeSingle()`

| Method          | Returns          | 0 rows       | 2+ rows      |
| --------------- | ---------------- | ------------ | ------------ |
| `.single()`     | One row          | Error        | Error        |
| `.maybeSingle()` | One row or null | Returns null | Error        |

```typescript
// Use .single() when a row MUST exist (fetching by confirmed primary key)
const { data, error } = await supabaseAdmin
  .from("partners")
  .select("id, name")
  .eq("id", partnerId)
  .single();

// Use .maybeSingle() when the row might not exist (lookup by external key)
const { data, error } = await supabaseAdmin
  .from("partners")
  .select("id, name")
  .eq("external_id", externalId)
  .maybeSingle();
```

### 4.3 Pagination (MANDATORY for list queries)

**NEVER** fetch unbounded result sets. Always paginate.

```typescript
export const getPartnersPaginated = async (
  page: number,
  pageSize: number = 50
): Promise<{ data: PartnerSummary[]; total: number }> => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabaseAdmin
    .from("partners")
    .select("id, name, status, tier", { count: "exact" })
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    logger.error({ err: error, page, pageSize }, "Failed to fetch partners page");
    throw new Error(`Failed to fetch partners: ${error.message}`);
  }

  return { data: data ?? [], total: count ?? 0 };
};
```

Count strategy:

- `{ count: "exact" }` — when UI needs total (pagination controls).
- `{ count: "estimated" }` — for large tables where exact count is expensive.
- Omit count — when you don't need it at all.

### 4.4 Ordering (MANDATORY for list queries)

Always specify `order()` for deterministic results. When ordering by a non-unique column, add a secondary sort on a unique column:

```typescript
.order("status", { ascending: true })
.order("id", { ascending: true })
```

### 4.5 Bounded Queries

Even non-paginated queries MUST be bounded with `.limit()`:

```typescript
// CORRECT — bounded
const { data } = await supabaseAdmin
  .from("weekly_statuses")
  .select("id, week, status")
  .eq("partner_id", partnerId)
  .order("week", { ascending: false })
  .limit(52);

// WRONG — unbounded, could return thousands of rows
const { data } = await supabaseAdmin
  .from("weekly_statuses")
  .select("*")
  .eq("partner_id", partnerId);
```

### 4.6 Count Without Fetching Rows

When you only need the count:

```typescript
const { count, error } = await supabaseAdmin
  .from("partners")
  .select("id", { count: "exact", head: true })
  .eq("status", "active")
  .is("deleted_at", null);
```

`head: true` prevents fetching any row data — only the count is returned.

---

## 5. SOFT DELETE ENFORCEMENT

### 5.1 Core Entities: Soft Delete ONLY

The following tables MUST use soft deletes. **NEVER** hard-delete rows from these tables:

- `partners`
- `staff`
- `asins`

These tables have `entity_versions` triggers that rely on the row existing for DELETE event capture.

```typescript
// CORRECT — soft delete
const { error } = await supabaseAdmin
  .from("partners")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", partnerId)
  .select("id")
  .single();
```

### 5.2 Transient Data: Hard Delete Allowed

Hard deletes are acceptable for transient or staging data:

- `staged_changes`
- Temporary/processing tables

```typescript
const { error } = await supabaseAdmin
  .from("staged_changes")
  .delete()
  .eq("id", changeId);
```

### 5.3 Query-Side Enforcement (CRITICAL)

**EVERY** query on a soft-deletable table MUST filter out deleted rows:

```typescript
// MANDATORY on all partner/staff/asin queries
.is("deleted_at", null)
```

**No exceptions.** If deleted rows should be included (e.g., admin audit view), add a comment explaining why:

```typescript
// Admin audit: intentionally including soft-deleted records
const { data } = await supabaseAdmin
  .from("partners")
  .select("id, name, deleted_at")
  .order("deleted_at", { ascending: false });
```

---

## 6. FILTERING

### 6.1 Filter Operators Reference

```typescript
.eq("status", "active")                          // equals
.neq("status", "churned")                        // not equal
.in("status", ["active", "paused"])               // in set
.ilike("name", `%${searchTerm}%`)                 // case-insensitive LIKE
.is("deleted_at", null)                           // IS NULL
.not("deleted_at", "is", null)                    // IS NOT NULL
.gte("created_at", startDate)                     // >=
.lt("created_at", endDate)                        // <
```

### 6.2 Input Validation Before Filtering (MANDATORY)

**NEVER** pass raw user input into filters. Always validate with Zod first.

```typescript
import { z } from "zod";

const schema = z.object({
  status: z.enum(["active", "paused", "churned"]),
});

const parsed = schema.parse(input);

const { data } = await supabaseAdmin
  .from("partners")
  .select("id, name")
  .eq("status", parsed.status)
  .is("deleted_at", null);
```

### 6.3 JSONB Filtering

```typescript
// Filter by nested JSONB value
.eq("source_data->gsheets->Master Client Sheet->>Brand Name", "Acme")

// Check if JSONB key exists
.not("source_data->gsheets", "is", null)
```

**Warning:** JSONB queries without indexes are slow on large tables. For frequently queried JSONB paths, extract them to indexed columns.

---

## 7. MUTATIONS

### 7.1 Always Return the Mutated Row

Chain `.select()` after mutations to avoid a second round-trip:

```typescript
// Insert
const { data, error } = await supabaseAdmin
  .from("partners")
  .insert({ name: "New Partner", status: "active" })
  .select("id, name, status")
  .single();

// Update
const { data, error } = await supabaseAdmin
  .from("partners")
  .update({ status: "churned" })
  .eq("id", partnerId)
  .select("id, name, status")
  .single();
```

### 7.2 Upserts

Always specify `onConflict` explicitly. Ensure the conflict column has a unique constraint.

```typescript
const { data, error } = await supabaseAdmin
  .from("partners")
  .upsert(
    { external_id: "abc-123", name: "Acme Corp", status: "active" },
    { onConflict: "external_id" }
  )
  .select("id, name")
  .single();
```

### 7.3 Bulk Inserts

For small batches, pass an array directly:

```typescript
const rows = partners.map((p) => ({ name: p.name, status: "active" }));

const { data, error } = await supabaseAdmin
  .from("partners")
  .insert(rows)
  .select("id, name");
```

For large batches (500+ rows), chunk them:

```typescript
import { chunk } from "lodash";

const BATCH_SIZE = 500;
const batches = chunk(rows, BATCH_SIZE);

for (const [index, batch] of batches.entries()) {
  const { error } = await supabaseAdmin.from("partners").insert(batch);

  if (error) {
    logger.error(
      { err: error, batchIndex: index, batchSize: batch.length },
      "Batch insert failed"
    );
    throw new Error(`Batch ${index + 1} failed: ${error.message}`);
  }
}
```

---

## 8. JOINS AND RELATIONS

### 8.1 Use Embedded Selects (No N+1)

**NEVER** fetch a list then loop to fetch related data. Use PostgREST embedded selects:

```typescript
// CORRECT — single query
const { data } = await supabaseAdmin
  .from("partners")
  .select(`
    id,
    name,
    status,
    partner_assignments (
      role,
      staff:staff_id (
        id,
        full_name,
        email
      )
    )
  `)
  .eq("status", "active")
  .is("deleted_at", null);

// WRONG — N+1 pattern
const { data: partners } = await supabaseAdmin.from("partners").select("id, name");
for (const partner of partners!) {
  const { data: assignments } = await supabaseAdmin
    .from("partner_assignments")
    .select("*")
    .eq("partner_id", partner.id);
}
```

### 8.2 Foreign Key Disambiguation

When multiple foreign keys point to the same table, use the column name:

```typescript
.select(`
  staff:staff_id ( full_name ),
  approver:approved_by_id ( full_name )
`)
```

### 8.3 Batch Lookups

For checking existence of multiple records, use `.in()`:

```typescript
// CORRECT — single query
const { data: existing } = await supabaseAdmin
  .from("partners")
  .select("external_id")
  .in("external_id", externalIds);

const existingSet = new Set(existing?.map((p) => p.external_id));
```

---

## 9. TRANSACTIONS AND ATOMIC OPERATIONS

### 9.1 Prefer RPC for Atomic Operations (STRONGLY RECOMMENDED)

Supabase does not support client-side transactions. For multi-step operations that must be atomic, use PostgreSQL functions via `rpc()`:

```typescript
const { data, error } = await supabaseAdmin.rpc("transfer_partner", {
  p_partner_id: partnerId,
  p_from_staff_id: currentStaffId,
  p_to_staff_id: newStaffId,
});

if (error) {
  logger.error({ err: error, partnerId }, "Partner transfer failed");
  throw new Error(`Partner transfer failed: ${error.message}`);
}
```

Corresponding SQL:

```sql
CREATE OR REPLACE FUNCTION transfer_partner(
  p_partner_id UUID,
  p_from_staff_id UUID,
  p_to_staff_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE partner_assignments SET ended_at = NOW()
  WHERE partner_id = p_partner_id AND staff_id = p_from_staff_id AND ended_at IS NULL;

  INSERT INTO partner_assignments (partner_id, staff_id, role, started_at)
  VALUES (p_partner_id, p_to_staff_id, 'account_manager', NOW());
END;
$$ LANGUAGE plpgsql;
```

### 9.2 Sequential Fallback (LAST RESORT)

Only when RPC is not feasible. The AI MUST add a comment explaining why RPC was not used.

```typescript
// Sequential fallback: RPC not used because [reason]
const { data: inserted, error: insertError } = await supabaseAdmin
  .from("partner_assignments")
  .insert({ partner_id: id, staff_id: newStaffId })
  .select("id")
  .single();

if (insertError) {
  logger.error({ err: insertError }, "Assignment insert failed");
  throw new Error(`Assignment insert failed: ${insertError.message}`);
}

const { error: updateError } = await supabaseAdmin
  .from("partner_assignments")
  .update({ ended_at: new Date().toISOString() })
  .eq("id", oldAssignmentId);

if (updateError) {
  // Attempt rollback — log if rollback also fails
  const { error: rollbackError } = await supabaseAdmin
    .from("partner_assignments")
    .delete()
    .eq("id", inserted.id);

  if (rollbackError) {
    logger.error(
      { err: rollbackError, insertedId: inserted.id },
      "CRITICAL: Rollback failed — manual cleanup required"
    );
  }

  logger.error({ err: updateError }, "Assignment update failed, rolled back insert");
  throw new Error(`Assignment update failed: ${updateError.message}`);
}
```

---

## 10. TYPESCRIPT INTEGRATION

### 10.1 Generate Types from Schema

Use the Supabase CLI. Regenerate after every migration:

```bash
npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
```

### 10.2 Typed Client (MANDATORY)

The `Database` generic is applied in the singleton clients (section 1). All queries automatically benefit from type inference.

### 10.3 Narrow Return Types

When selecting specific columns, use `.returns<T>()` to narrow:

```typescript
type PartnerSummary = Pick<Partner, "id" | "name" | "status">;

const { data } = await supabaseAdmin
  .from("partners")
  .select("id, name, status")
  .is("deleted_at", null)
  .returns<PartnerSummary[]>();
```

Define these narrow types in `/types` files — not inline in repositories.

---

## 11. ROW-LEVEL SECURITY (RLS)

### 11.1 Policy Requirements

- **ALL** tables accessed from the browser client MUST have RLS enabled.
- The service role key bypasses RLS by design — use it only server-side.
- Every table MUST have at minimum a restrictive default: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`

### 11.2 Tenant Isolation Pattern

For SaaS multi-tenancy, enforce tenant isolation at the policy level:

```sql
-- Users can only read their own organization's data
CREATE POLICY "tenant_isolation_select" ON partners
  FOR SELECT
  USING (org_id = auth.jwt()->>'org_id');

-- Users can only update their own organization's data
CREATE POLICY "tenant_isolation_update" ON partners
  FOR UPDATE
  USING (org_id = auth.jwt()->>'org_id')
  WITH CHECK (org_id = auth.jwt()->>'org_id');

-- Users can only insert into their own organization
CREATE POLICY "tenant_isolation_insert" ON partners
  FOR INSERT
  WITH CHECK (org_id = auth.jwt()->>'org_id');

-- Users can only delete (soft) their own organization's data
CREATE POLICY "tenant_isolation_delete" ON partners
  FOR DELETE
  USING (org_id = auth.jwt()->>'org_id');
```

### 11.3 Testing RLS

Always verify RLS by querying with the anon key and confirming:

- Restricted data is hidden.
- Cross-tenant data is inaccessible.
- Unauthenticated requests return zero rows (not errors).

---

## 12. PERFORMANCE

### 12.1 Index-Aware Querying

Structure `WHERE` clauses to hit existing indexes. Commonly indexed columns:

- Primary keys (`id`)
- Foreign keys (`partner_id`, `staff_id`)
- Status/type columns used in frequent filters
- `created_at` for time-range queries
- `deleted_at` for soft-delete filtering

### 12.2 Avoid Expensive Patterns

| Pattern                          | Problem                        | Alternative                                |
| -------------------------------- | ------------------------------ | ------------------------------------------ |
| `select('*')` on wide tables    | Transfers large JSONB columns  | Select explicit columns                    |
| Unindexed JSONB queries          | Full table scan                | Extract to indexed column                  |
| `{ count: "exact" }` on large tables | Full count scan           | Use `"estimated"` or omit                  |
| Unbounded queries                | Memory spikes, slow response   | `.limit()` or `.range()`                   |
| N+1 loops                        | Multiplied round trips         | Embedded selects or `.in()`                |

### 12.3 Connection Pooling

Use Supabase's connection pooler for production:

- **Transaction mode (port 6543):** Use for serverless/edge functions where connections are short-lived.
- **Session mode (port 5432):** Use when you need session-level features (prepared statements, advisory locks).

Configure the connection string in environment variables — never hardcode.

### 12.4 Request Cancellation

For long-running queries triggered by user actions, support `AbortSignal`:

```typescript
export const searchPartners = async (
  query: string,
  signal?: AbortSignal
): Promise<PartnerSummary[]> => {
  const { data, error } = await supabaseAdmin
    .from("partners")
    .select("id, name, status")
    .ilike("name", `%${query}%`)
    .is("deleted_at", null)
    .limit(20)
    .abortSignal(signal);

  if (error) {
    if (error.message.includes("AbortError")) return [];
    logger.error({ err: error, query }, "Partner search failed");
    throw new Error(`Partner search failed: ${error.message}`);
  }

  return data ?? [];
};
```

---

## 13. SECURITY

### 13.1 Input Validation (MANDATORY)

Every mutation endpoint MUST validate input with Zod before touching the database:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Partner>>> {
  const session = await requireAuth();

  const id = z.string().uuid().parse(params.id);

  const body = await request.json();
  const validated = PartnerUpdateSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { success: false, error: "Invalid input" },
      { status: 400 }
    );
  }

  const partner = await partnerRepository.updateById(id, validated.data);
  return NextResponse.json({ success: true, data: partner });
}
```

### 13.2 Sensitive Data

Never return sensitive fields in API responses:

```typescript
const { password_hash, internal_notes, ...safeData } = data;
return NextResponse.json({ success: true, data: safeData });
```

### 13.3 Auth Checks Before Mutations

**EVERY** mutation endpoint MUST verify authentication and authorization before executing:

```typescript
const session = await requireAuth();
if (!session) {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
```

---

## 14. MIGRATIONS AND SCHEMA CHANGES

### 14.1 Rules

- The AI MUST NOT apply schema changes directly.
- The AI MUST generate SQL migration files when schema changes are needed.
- Migration files go in `/supabase/migrations/` with timestamp naming:

```
/supabase/migrations/
  20240115_add_tier_to_partners.sql
  20240116_create_partner_assignments.sql
```

### 14.2 Migration Template

```sql
-- Migration: add_tier_to_partners
-- Description: Adds tier column for partner classification
-- Author: AI-generated, review required

ALTER TABLE partners
  ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard'
  CHECK (tier IN ('standard', 'premium', 'enterprise'));

CREATE INDEX idx_partners_tier ON partners (tier);

-- Backfill existing rows if needed
-- UPDATE partners SET tier = 'standard' WHERE tier IS NULL;
```

### 14.3 Post-Migration

After any schema change, regenerate TypeScript types:

```bash
npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts
```

The AI MUST flag this as a required follow-up action.

---

## 15. REALTIME SUBSCRIPTIONS

### 15.1 Pattern

```typescript
import { supabaseBrowser } from "@/lib/supabase-browser";
import { logger } from "@/lib/logger";

const channel = supabaseBrowser
  .channel("partner-updates")
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "partners",
      filter: `id=eq.${partnerId}`,
    },
    (payload) => {
      logger.info({ partnerId }, "Partner updated via realtime");
      onUpdate(payload.new);
    }
  )
  .subscribe();

// ALWAYS clean up
return () => {
  supabaseBrowser.removeChannel(channel);
};
```

### 15.2 Rules

- Always unsubscribe in cleanup (React `useEffect` return).
- Use specific filters — never subscribe to an entire table.
- Realtime requires RLS `SELECT` policies for the subscribing role.
- Handle reconnection and error states gracefully.

---

## 16. COMMON MISTAKES (DO NOT LIST)

The AI MUST NOT:

| Mistake | Correct Approach |
| ------- | ---------------- |
| Ignore `error` from queries | Always check `error` before using `data` |
| Use `select('*')` by default | Select only needed columns |
| Use `.single()` for lookups that may return 0 rows | Use `.maybeSingle()` |
| Loop individual queries (N+1) | Use embedded selects or `.in()` |
| Run unbounded queries | Always use `.limit()`, `.range()`, or tight filters |
| Hardcode IDs or magic strings | Use constants, enums, or config |
| Skip `.select()` after insert/update | Chain `.select()` to get the mutated row |
| Create a new Supabase client per request | Use the shared singleton |
| Omit `onConflict` in upserts | Always specify the conflict column |
| Run mutations without auth checks | Use `requireAuth()` first |
| Query soft-deletable tables without `.is("deleted_at", null)` | Always filter out deleted rows |
| Use `console.log` / `console.error` | Use Pino (`logger`) |
| Pass raw user input into filters | Validate with Zod first |
| Apply schema changes directly | Generate migration SQL files |
| Hard-delete from partners/staff/asins | Use soft deletes for core entities |

---

## 17. PRE-COMPLETION CHECKLIST (SUPABASE-SPECIFIC)

Before finalizing any code that touches Supabase, the AI MUST verify:

- [ ] Using singleton client from `/lib` (not inline `createClient`)
- [ ] `Database` generic applied for type inference
- [ ] Query lives in `/repositories` (not in components, hooks, or services)
- [ ] `error` checked before using `data` on every query
- [ ] Explicit columns in `select()` (no `*` without justification)
- [ ] `.is("deleted_at", null)` on all soft-deletable table queries
- [ ] List queries are paginated or bounded with `.limit()`
- [ ] List queries have deterministic `.order()`
- [ ] Input validated with Zod before use in queries
- [ ] Auth verified before mutations
- [ ] Errors logged with Pino (no `console.*`)
- [ ] No internal details leaked to client responses
- [ ] Return type explicitly defined on repository function
- [ ] Mutations chain `.select()` to return the result
- [ ] No N+1 query patterns
- [ ] Schema changes delivered as migration SQL files

**If any item fails → fix before delivery.**
