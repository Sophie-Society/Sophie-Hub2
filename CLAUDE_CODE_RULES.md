# CLAUDE_CODE_RULES.md

# 🚨 ENFORCEMENT DOCUMENT FOR AI CODE GENERATION

This document defines **NON-NEGOTIABLE** engineering rules for all AI-generated code.

Claude / Codex MUST follow every rule in this document.

If a rule conflicts with convenience, **the rule WINS**.

If uncertain, choose the **safest, most maintainable** solution.

**Companion document:** `CLAUDE_SUPABASE_QUERY_GUIDELINES.md` extends this document with database-specific rules. Both documents MUST be followed when generating code that touches Supabase.

---

## 0. PROJECT CONTEXT

| Layer              | Technology                      |
| ------------------ | ------------------------------- |
| Framework          | Next.js 14 (App Router)        |
| Language           | TypeScript (`strict: true`)     |
| Styling            | Tailwind CSS + shadcn/ui       |
| Database           | Supabase (PostgreSQL)           |
| Auth               | NextAuth.js + Google OAuth      |
| Testing            | Vitest + React Testing Library  |
| Validation         | Zod                             |
| Logging            | Pino                            |
| External APIs      | Google Sheets API, Anthropic API|

---

## 1. CORE PHILOSOPHY

The AI MUST behave as a **senior TypeScript architect**.

All generated code MUST be:

- Production-ready
- Strictly typed
- Secure
- Cleanly layered
- Fully testable
- Maintainable by humans

### Priority Order (highest → lowest)

1. Type Safety
2. Security
3. Maintainability
4. Scalability
5. Readability
6. Performance

Never sacrifice a higher priority for a lower one.

---

## 2. DO NOT LIST

The AI MUST NOT:

- Use `any` — use `unknown` if the type is genuinely uncertain
- Leave dead code, unused imports, or unused variables
- Leave `console.log` — use the project logger (Pino)
- Leave `// TODO` or placeholder comments
- Refactor code not directly related to the task
- Add features or changes not explicitly requested
- Change existing function signatures unless explicitly asked
- Generate default exports (use named exports)
- Swallow errors with empty catch blocks
- Trust client input without validation
- Expose secrets, tokens, or internal error details to the client
- Log tokens or secrets at any log level
- Use relative imports beyond one level — use `@/` path aliases

---

## 3. TYPESCRIPT RULES (STRICT MODE)

### 3.1 Absolute Requirements

- `strict: true` is always assumed.
- All exported functions MUST have explicit return types.
- All function parameters MUST be typed.
- No implicit return types anywhere.

**Correct:**

```ts
export const fetchUser = async (id: string): Promise<User | null> => {
  // ...
};
```

**Incorrect:**

```ts
export const fetchUser = async (id) => {
  // ...
};
```

### 3.2 Type Organization

ALL shared interfaces and types MUST live in dedicated files under `/types`.

```
/types
  user.types.ts
  auth.types.ts
  api.types.ts
  database.types.ts
```

Rules:

- No shared types defined inside components, services, or hooks.
- No type duplication — reuse existing types before creating new ones.
- Database types MUST reflect the Supabase schema.
- Component-local types (e.g., internal state shape) MAY live in the component file only if they are not reused.

### 3.3 Import Conventions

- ALWAYS use `@/` path aliases.
- NEVER use relative imports beyond one level (`../`).

**Correct:**

```ts
import { UserProfile } from "@/types/user.types";
import { userService } from "@/services/user.service";
```

**Incorrect:**

```ts
import { UserProfile } from "../../../types/user.types";
```

---

## 4. ARCHITECTURE ENFORCEMENT

Strict layer separation is REQUIRED. Violating boundaries is never acceptable.

### 4.1 Folder Responsibilities

#### `/components`

- UI rendering ONLY.
- No database queries, no Supabase imports, no external API logic, no business logic.
- Must receive data via typed props.

#### `/hooks`

- Client-side logic only.
- May call services.
- No direct database queries.

#### `/repositories`

- ALL Supabase queries live here.
- No UI logic, no business logic.
- Must return typed results.

#### `/services`

- Business logic layer.
- May call repositories and external APIs.
- Must NOT contain raw SQL or direct Supabase calls.

#### `/app` (API routes / server actions)

- Thin controllers only.
- Validate input → call service → return structured response.

#### `/lib`

- Shared utilities, client initializations (Supabase client, Pino logger, etc.).
- No business logic.

---

## 5. ERROR HANDLING (MANDATORY)

ALL async logic MUST use try/catch with typed error handling.

**Pattern:**

```ts
import { logger } from "@/lib/logger";

try {
  const result = await operation();
  return result;
} catch (error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unexpected error occurred";
  logger.error({ err: error }, `Operation failed: ${message}`);
  throw new Error(`Operation failed: ${message}`);
}
```

Rules:

- NEVER use empty catch blocks.
- NEVER swallow errors silently.
- ALWAYS type the error as `unknown`.
- ALWAYS log before rethrowing using Pino.

---

## 6. LOGGING (PINO)

The project uses **Pino** as the structured logger.

- Use `logger.info()`, `logger.warn()`, `logger.error()` — never `console.log`.
- Always include structured context:

```ts
logger.info({ userId, action: "profile_updated" }, "User updated profile");
logger.error({ err: error, userId }, "Failed to update profile");
```

- NEVER log tokens, secrets, passwords, or full request bodies containing sensitive data.

---

## 7. API RESPONSE STANDARD

ALL API routes MUST return this shape:

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Rules:

- No inconsistent response shapes.
- No raw errors thrown to the client.
- No internal details leaked (stack traces, DB errors, etc.).
- Always handle both success and failure cases.

**Example:**

```ts
export async function GET(request: Request): Promise<NextResponse<ApiResponse<User>>> {
  try {
    const user = await userService.getUser(id);
    return NextResponse.json({ success: true, data: user });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";
    logger.error({ err: error }, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
```

---

## 8. VALIDATION (ZOD)

ALL external input MUST be validated using **Zod** before processing.

### 8.1 Request Body Validation

```ts
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In API route or server action:
const parsed = CreateUserSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: parsed.error.flatten() },
    { status: 400 }
  );
}
```

### 8.2 Environment Variable Validation

Environment variables MUST be validated at startup in `/lib/env.ts`:

```ts
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
});

export const env = EnvSchema.parse(process.env);
```

If validation fails, the application MUST fail fast with a clear error message.

---

## 9. DATABASE RULES (SUPABASE)

- All queries MUST live in `/repositories`.
- All query responses MUST be typed.
- Null MUST be handled explicitly.
- Inputs MUST be validated before querying.

**Pattern:**

```ts
export const getUserById = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data ?? null;
};
```

---

## 10. AUTH RULES (NextAuth + Google OAuth)

- Never expose secrets to the client.
- Always validate the session before any protected logic.
- Sensitive logic MUST run server-side.
- Do not trust client session data blindly — always re-validate server-side.

---

## 11. EXTERNAL API RULES

### 11.1 Google Sheets API

- Wrap in a dedicated service under `/services`.
- Implement retry logic: **exponential backoff with jitter, max 3 retries**.
- Validate inputs before sending.
- Sanitize and type the response before returning.

### 11.2 Anthropic API

- Encapsulate in a dedicated service under `/services`.
- Handle rate limits with backoff.
- Validate and sanitize prompt input — never pass raw user input directly.
- Sanitize and type output before returning.

### 11.3 Retry Pattern

```ts
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxRetries) throw error;
      const jitter = Math.random() * 100;
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry failed unexpectedly");
};
```

---

## 12. NAMING ENFORCEMENT

### 12.1 Code Naming

| Type        | Convention  | Example            |
| ----------- | ----------- | ------------------ |
| Variables   | camelCase   | `userProfile`      |
| Functions   | camelCase   | `fetchUser`        |
| Components  | PascalCase  | `UserCard`         |
| Types       | PascalCase  | `UserProfile`      |
| Constants   | UPPER_CASE  | `MAX_RETRY_COUNT`  |

### 12.2 File Naming

All files use **kebab-case** with a role suffix:

| Role        | Pattern                | Example                |
| ----------- | ---------------------- | ---------------------- |
| Service     | `*.service.ts`         | `user.service.ts`      |
| Repository  | `*.repository.ts`      | `user.repository.ts`   |
| Hook        | `use-*.hook.ts`        | `use-auth.hook.ts`     |
| Types       | `*.types.ts`           | `user.types.ts`        |
| Validation  | `*.schema.ts`          | `user.schema.ts`       |
| Component   | `*.tsx` (PascalCase)   | `UserCard.tsx`         |

---

## 13. TESTING (VITEST + REACT TESTING LIBRARY)

### 13.1 What MUST Be Tested

- Services
- Repositories
- Utilities
- Critical business logic
- Zod schemas

### 13.2 Each Test Suite MUST Include

- ✅ Success case
- ❌ Failure case
- 🔲 Edge case (null, empty, boundary values)

### 13.3 Mocking Rules

- External APIs MUST be mocked.
- Supabase MUST be mocked.
- Never make real network calls in tests.

### 13.4 Test Pattern

```ts
import { describe, it, expect, vi } from "vitest";
import { getUserById } from "@/repositories/user.repository";

describe("getUserById", () => {
  it("returns user when found", async () => {
    // Arrange → Act → Assert
  });

  it("returns null when user does not exist", async () => {
    // ...
  });

  it("throws on database error", async () => {
    // ...
  });
});
```

---

## 14. PERFORMANCE RULES

- Prefer Server Components when possible.
- Avoid unnecessary Client Components (`"use client"` only when needed).
- Avoid unnecessary re-renders — memoize expensive computations.
- Avoid excessive or redundant API calls.

---

## 15. SECURITY RULES

- Never expose secrets or API keys to the client.
- Never log tokens, passwords, or secrets at any level.
- Never commit `.env` files.
- Sanitize all external API responses before use.
- Escape user-generated content before rendering.

---

## 16. EXISTING CODE MODIFICATION RULES

When modifying existing code, the AI MUST:

- ONLY change code directly related to the requested task.
- NOT refactor, rename, or reorganize surrounding code unless explicitly asked.
- NOT change existing function signatures or interfaces unless explicitly asked.
- Preserve existing patterns, naming conventions, and code style in the file.
- If a needed change touches another layer (e.g., updating a type requires updating a repository), explain the cascading changes before making them.

---

## 17. RESPONSE FORMAT

When delivering code, the AI MUST:

1. **Summarize** what was changed/created and why (2–4 sentences).
2. **List files** created or modified.
3. **Provide the code** in clearly labeled blocks.
4. **Flag any assumptions** or decisions that were made.
5. **Note any follow-up** actions needed (migrations, env vars, etc.).

---

## 18. PRE-COMPLETION CHECKLIST

Before finalizing ANY code, the AI MUST verify every item:

- [ ] No `any` types
- [ ] All shared types in `/types` files
- [ ] Clear separation of concerns across layers
- [ ] Error handling present in all async logic
- [ ] No dead code, unused imports, or unused variables
- [ ] Explicit return types on all exported functions
- [ ] Input validated with Zod where applicable
- [ ] Tests included or updated
- [ ] No `console.log` — using Pino logger
- [ ] Naming consistent with conventions
- [ ] `strict: true` compliant
- [ ] No secrets exposed
- [ ] `@/` path aliases used (no deep relative imports)
- [ ] Named exports only (no default exports)
- [ ] No unrelated code changes

**If any item fails → refactor before delivery.**
