# Building in Public: The Boring Builders Narrative

## Master Reference Document

**Author:** Tomas (Sophie Society)
**Audience:** X/Twitter series, potential book, community launch
**Tone:** Honest, not preachy. "Here's what we're attempting, not what you should do."
**Angle:** Vibecoders working alongside traditional dev agencies to rebuild internal tools for real businesses.

---

## THE HOOK

Mark Cuban recently said the massive opportunity isn't in building new AI startups - it's integrating AI into existing businesses. Most "Building in Public" content covers solopreneurs shipping new products. Almost nobody is documenting what it looks like when a non-technical operator inside an existing 120-person agency uses AI to rebuild the company's internal infrastructure - and then brings in a professional dev team to harden it.

That's this story.

---

## THE SITUATION (Context)

Sophie Society is an Amazon brand management agency. 120+ staff. 700+ partner brands (600 active). The operational reality:

- **Master Client Dashboard** - A Google Sheet with 20+ tabs
- **Individual Pod Leader Dashboards** - Separate sheets per team lead
- **Brand Info sheets** - Per partner, per ASIN
- **Google Forms** - Various intake/tracking
- **Close IO** - CRM
- **Zoho** - Invoicing
- **Subtask** - Ticketing within Slack
- **Amazon Seller Central** - The platform we manage for clients
- **BigQuery** - Analytics warehouse from Amazon API data

150 staff members. 1,800 accounts. Fragmented data everywhere. No single source of truth. Classic "we grew fast and duct-taped systems together" situation that probably describes half the companies out there.

---

## THE JOURNEY (Chronological)

### Chapter 1: The Itch (Pre-Build)

**What happened:** Tomas starts feeling the pain of fragmented data daily. Knows something needs to change but doesn't know exactly what or how.

**Key realization:** The person who deeply understands a company's workflows is often the best person to architect the next solution - but historically, that person couldn't build it. AI is changing that equation.

### Chapter 2: Prototyping with v0 (~6 months before serious build)

**What happened:** Started using v0 (Vercel's AI UI tool) to draw up concepts. Not building anything real - just visualizing what different dashboards and tools could look like.

**Why this matters:** Before writing a single line of code, Tomas was thinking about *what the experience should feel like*. This design-first instinct would become a core principle of the entire project.

**Honest take:** "The AI technology wasn't really there yet. The prototypes looked nice to show people but were really just fancy UX examples."

### Chapter 3: The No-Code Detour (Airtable + NocoDB)

**What happened:** Explored a no-code/low-code stack:
- **Airtable** as the database (relational, familiar to non-technical staff, similar feel to Google Sheets)
- **NocoDB** as the frontend layer (filter data, create role-based views)

**Why Airtable made sense:** When you work with 120+ people across departments at different technical skill levels, you can't just say "use PostgreSQL." The database needs to be approachable. Airtable felt like Google Sheets but with relational structure.

**Learning moment:** This phase taught Tomas about relational databases - how data connects, what a "key" is, how relationships work between tables. These concepts became foundational even though the specific tool changed.

**Why it didn't stick:** These platforms weren't well-suited for deep AI integration. "With code, you just build it. Just go do it."

**Insight for the series:** The technical people reading this will think "obviously just use a real database." But for non-technical operators, the journey FROM Airtable TO Supabase/PostgreSQL is important. You have to understand *why* before you can make the jump. The no-code tools were training wheels, not wasted time.

### Chapter 4: The Claude Moment (v1 Build)

**What happened:** Started building with Claude (likely Claude 3.5 Sonnet at the time). The capability gap from 6 months prior was dramatic - AI could now help build actual working applications, not just mockups.

**What got built (v1):**
- Connected to Google Sheets API - could actually see the company's live data
- Stumbled into building what turned out to be a "data enrichment" process
- Started mapping fragmented data to two core entities: **Partners** and **Staff**
- Got basic syncing working - changes in Google Sheets would reflect in the app

**The "data enrichment" discovery:** Tomas didn't know the term. He was just saying "this column in this sheet relates to this partner" and "this email belongs to this staff member." The AI helped him realize he was building a data enrichment pipeline and gave it proper terminology.

**How it was messy:** Quick iteration, no real architecture, things were hacked together to prove the concept worked. But it *did* work - and that was the breakthrough moment.

**Key quote (paraphrased):** "I was really, really blown away by how much progress I could make."

### Chapter 5: The Rewrite Decision (v1 to v2)

**What happened:** v1 proved the concept but was architecturally messy. Rather than trying to clean it up, Tomas prompted Claude to analyze what they'd built and create proper documentation (MD files) of what the system actually was.

**The process:**
1. Asked AI: "What are we building here? Help me create the MD files."
2. AI analyzed the existing code and produced structured documentation
3. Tomas read through it carefully (important - don't blindly accept AI output)
4. Used those docs as the skeleton for a completely fresh project
5. Started Sophie Hub v2 from scratch

**Why this worked:** The v1 wasn't wasted - it was rapid prototyping. The knowledge and patterns discovered in v1 became the blueprint for v2. The rewrite was "extremely clean" and "things were flowing much faster because we already knew what was being built."

**MD file strategy that emerged:**
- One master MD for "what is this project"
- One roadmap/todo MD
- Individual feature MDs
- After every work session: "go update the MD files to make sure this is up to date"

**Insight for the series:** Many vibecoders will build something messy, get frustrated, and quit. The rewrite isn't failure - it's the process. v1 is research. v2 is the product.

### Chapter 6: The Entity-First Architecture

**What the codebase reveals (that Tomas may not have articulated):**

The most important architectural decision in the entire project: everything in the system relates to one of two core entities.

1. **Partners** - Client brands (30+ fields across 10 groups: core info, contact, financial, dates, metrics, subscriptions, links, staff assignments)
2. **Staff** - Team members (15+ fields across 7 groups: core, contact, status, metrics, dates, links, management)

Everything else is either:
- A **subtable** (ASINs belong to Partners, Training belongs to Staff)
- A **relationship** (Partner Assignments connect Staff to Partners)
- **Reference data** (settings, templates, external contacts)

This replaced the v1 approach (from the original Sophie Hub) which had 100+ database tables because it was source-centric rather than entity-centric.

**Why this matters for the series:** Most companies trying to consolidate data make the same mistake - they model their database around their *sources* (one table per sheet, one table per form). The breakthrough is modeling around your *entities* (what are the actual things your business cares about?).

### Chapter 7: Building the Core (v2 - Phase 1 & 2)

**Timeline from git history:** Dec 2025 - Jan 2026 (roughly 100+ commits)

**What got built (that Tomas mentioned):**
- Data enrichment wizard - visual interface for mapping source columns to entity fields
- Syncing engine - changes in Google Sheets appear in the app
- Two core entity pages: Partners and Staff with search, filter, sort, detail views

**What got built (that the codebase reveals Tomas didn't mention):**

1. **Authentication & RBAC** - Google OAuth, role-based access (Admin, Pod Leader, Staff), admin route protection, `requireAuth()` / `requireRole()` API middleware

2. **Zero-Data-Loss Source Capture** - Every entity has a `source_data` JSONB column that stores ALL raw values from every source - even unmapped columns. Nothing is ever lost during import.

3. **Entity Versioning (Time Machine)** - PostgreSQL triggers automatically snapshot every INSERT, UPDATE, DELETE on core tables into `entity_versions`. Full point-in-time reconstruction of any entity.

4. **Field Lineage** - Track where every field value came from: which sheet, which tab, which column, which sync. Tooltips in the UI show source provenance.

5. **Value Transforms** - Automatic normalization during sync (e.g., "Active" becomes "active", "Tier 1" becomes "tier_1"). Auto-detection for known field patterns.

6. **AI-Assisted Column Mapping** - Claude integration in the SmartMapper for suggesting which source columns map to which entity fields. Two tiers: Haiku for quick work, Sonnet for deeper analysis.

7. **Entity Field Registry** - Single source of truth for all field definitions with aliases for fuzzy auto-matching. Source column "Email Address" automatically matches to `client_email`.

8. **Standardized API Responses** - Consistent format across all 40+ endpoints: `{ success, data, error, meta }` with Zod validation on all inputs.

9. **Module-Level Navigation Caching** - In-memory cache that survives component unmounts but clears on page refresh. 5-minute TTL. Makes page navigation feel instant.

10. **Dry-Run Preview** - Before any sync actually writes data, a preview shows exactly what will be created, updated, or left unchanged. Safety net for data integrity.

### Chapter 8: Design as a Differentiator

**What Tomas emphasized:** Being design-conscious is core to the approach. "Things should be pleasant to use. There should be many aha moments."

**The design resources incorporated:**
- **Interface Craft** (interfacecraft.dev / Josh Puckett) - Added as a Claude skill trigger. Say "Shazam" and Claude applies design critique methodology.
- **Emil Kowalski** (animations.dev) - Animation principles baked into the codebase. Primary easing: `ease-out` for all user interactions. Never `ease-in` (feels sluggish).
- **Dieter Rams** philosophy - Functional design, not flashy. Like functional flair in bartending vs showmanship.

**What the codebase reveals about how seriously this is taken:**

A dedicated animation system (`src/lib/animations.ts`) with:
- Standardized easing curves (ease-out, ease-in-out, ease-out-expo, ease-out-back)
- Duration scale (micro: 150ms, UI: 200ms, page: 300ms, complex: 400ms)
- Spring physics configurations for different contexts
- Rule: `initial={false}` on page load elements to prevent entrance animation flicker
- Shimmer loading with diagonal-sweep wave pattern and per-cell stagger

A 200+ line UX Standards document (`src/UX-STANDARDS.md`) covering:
- Spacing scale (4, 8, 12, 16, 24, 32, 48, 64px)
- Typography rules (font smoothing, tabular numbers, text wrapping)
- Border philosophy (shadows over borders for better blending)
- Z-index scale (dropdown: 100, modal: 200, tooltip: 300, toast: 400)
- Touch target sizing (44px mobile, 36px desktop)
- Form rules (16px+ inputs to prevent iOS zoom, no autofocus on mobile)
- Button polish (always `<button>`, press feel with `scale(0.97)`, keyboard shortcuts in tooltips)

**Insight for the series:** Most internal tools look like garbage. They work, but nobody wants to use them. The design investment isn't vanity - it's adoption strategy. Staff will voluntarily migrate from Google Sheets to a well-designed tool. They'll resist migrating to an ugly one.

### Chapter 9: Open Source Discovery

**What Tomas described:** "Mind-blowing" to discover how much MIT-licensed, commercially free code exists.

**What the codebase actually uses (all MIT/Apache 2.0):**
- 42 production dependencies
- Key ones: Next.js, React, Tailwind, Framer Motion, Supabase, TanStack Query, Recharts, Excalidraw, MiniSearch, Sonner, date-fns, Zod, Radix UI, shadcn/ui

**The Twenty.com lesson:** Found an open-source CRM that looked fantastic but had AGPL licensing - would require sharing adapted code. Not viable for commercial internal use. Important lesson in understanding license types.

**Insight for the series:** The open-source ecosystem is overwhelmingly generous. Almost everything you need to build serious internal tools is free and commercially licensed. The barrier isn't access to tools - it's knowing they exist and how to compose them.

### Chapter 10: The Scale of What Got Built (Things Tomas Forgot to Mention)

**The codebase reveals significantly more than what was described verbally:**

**56 Database Migrations** - Each one a deliberate evolution of the schema. From basic entity tables to complex audit trails, connector state tracking, and analytics aggregation.

**6 Fully Implemented Connectors:**
1. Google Sheets (primary data source)
2. BigQuery (Amazon analytics - 7 data views: sales, refunds, SP, SD, SB, products, match)
3. Google Workspace (staff directory sync with approval queue)
4. Slack (3 phases: staff mapping, message sync, response time analytics)
5. ClickUp/Suptask (task management)
6. Slack-ClickUp Bridge (latest - workflow automation)

**Partner Health Visualization:**
- Weekly status heatmap - GitHub-style grid showing 156 weeks (~3 years) of partner health
- 88,000+ cells rendered with event delegation for scroll performance
- Sorting: At Risk, Most Turbulent, Healthiest, Most Data
- Status color mappings driven by actual data values (not hardcoded)

**Feedback System (Frill-style):**
- In-app bug/feature reporting with screenshot capture (html2canvas)
- Community voting on ideas
- Public roadmap board (Planned / In Progress / Shipped)
- AI-assisted triage (Haiku for summaries, Sonnet for root cause analysis)
- PostHog integration for session replay linked to bug reports

**View Builder (Inception Mode):**
- Admin can build custom views per role/partner type
- Preview system using iframe + postMessage (Shopify/WordPress pattern)
- Device frame switching (mobile/tablet/desktop preview)
- "See-As" admin impersonation for testing different user perspectives

**Module System:**
- Pluggable modules (Amazon Reporting, Product Centre, etc.)
- 6 widget types: metric, chart, table, text, smart_text, ai_text
- Grid-based dashboard builder with drag-and-drop
- Live data polling (2-minute intervals) vs snapshot mode
- Computed metrics: ACOS, ROAS, TACOS, CPC, CTR, CVR

**Security Hardening:**
- Password gate for staging (custom middleware, no Vercel paid tier needed)
- Rate limiting
- Encryption for sensitive settings
- CSP headers, HSTS, X-Frame-Options
- Audit logging
- PostHog error tracking with session replay

**Mobile Responsiveness:**
- Full responsive design (mobile-first Tailwind)
- Mobile sidebar drawer with body scroll lock
- Touch-target sizing (44px mobile, 36px desktop)
- Mobile-specific card layouts for data enrichment

### Chapter 11: The Dev Agency Partnership

**What Tomas described about engaging DevWorks:**

**Phase 1: Discovery & Alignment**
- Introductions, sharing the vision
- The challenge of communicating context that lives in your head
- "It can become very easy to fall into the trap that because the thing makes sense to you, it's gonna make sense to other people"
- Had to explain WHY data enrichment, WHY this architecture, WHY not just rebuild from scratch

**Phase 2: Access & Setup**
- Added them to Vercel
- Shared .env files (keeping them private from repo)
- Added to Google OAuth redirect URIs
- Gave them app access to click around
- "These small things took still a bit of time to get set up" - important for non-technical leads to know

**Phase 3: Code Review**
- Dev team reviewed the existing codebase
- Created a ClickUp board with features, priorities, active items
- Tomas added items he was actively working on that they hadn't listed

**Phase 4: Refactoring**
- Dev agency provided MD files for code refactoring
- Once core pieces were in place (enrichment, syncing, connectors, entity pages), focused on cleaning up

**Phase 5: Git Education & Staging Workflow**
- Dev team taught proper Git/GitHub usage
- Set up staging environment on Vercel
- Agreed process: push to `staging` -> review -> merge to `main` for release
- "The dev agency handles the push to main"

**What the codebase confirms about this workflow:**
- Branch structure: `staging` (active development) / `main` (release only)
- Recent commits show this discipline: "enforce staging-first workflow docs"
- Migration files are version-controlled and sequential
- CLAUDE.md explicitly documents the staging-first deployment strategy

**Insight for the series:** This is the gap nobody talks about. The vibecoder builds something real but messy. The dev agency brings engineering discipline. Neither could do the other's job efficiently. The vibecoder knows the domain and can iterate at AI speed. The agency knows production engineering. The combination is more powerful than either alone.

### Chapter 12: The Adoption Philosophy

**Tomas's core insight about change management:**

"The magic for me is that staff can log in one day and just be like, oh, there's all my data and existing workflows. You're not selling them on some new idea."

**The strategy:**
1. Don't disrupt existing workflows (staff keep using their sheets)
2. Sync data FROM those sheets INTO the new system
3. Build a better experience around the same data
4. Encourage organic migration as people discover the new tool is better
5. Eventually legacy the old tools

**Why this is smart:** Many companies fail at tool adoption because they force a hard cutover. "Hey everyone, stop using the sheets you've been using for years and use this new thing." That creates resistance, data gaps, and resentment.

The data enrichment approach is essentially building a bridge: legacy systems on one side, modern platform on the other, with a sync layer connecting them. Staff can cross the bridge at their own pace.

**What the codebase supports this with:**
- `source_data` JSONB captures everything from the old sheets (zero data loss)
- Field lineage shows exactly where data came from
- Entity versioning means changes are never destructive
- The enrichment wizard lets you add new data sources incrementally
- Individual fields can migrate from "sheet-sourced" to "app-native" over time

---

## THINGS THE CODEBASE REVEALS ABOUT THE JOURNEY

### The "No Fake Data" Principle
One of the strongest principles in the project. Every number on every screen comes from the database. No hardcoded stats, no mock data, no "approximately 600 partners" text. This was called out as CRITICAL in the project docs and enforced throughout.

### The Three Layers of Data Protection
1. **Entity Versions** - Full row snapshots on every change (time machine)
2. **Field Lineage** - Field-level provenance tracking (which source, which sync)
3. **Source Data JSONB** - Raw capture of ALL columns from ALL imports, even unmapped ones

### The Learning-by-Doing Philosophy
Tomas repeatedly emphasizes that reading about relational databases, data enrichment, or system architecture isn't the same as building it. The AI pair enables learning-by-doing at a pace that wasn't possible before.

### The 1,823 Partner Sync
The first successful full sync pulled 1,823 partners from the Master Client Sheet. This was a milestone that proved the entire pipeline worked end-to-end.

### The Duplicate Cleanup
During sync development, 1,100+ duplicate records were created and cleaned up. Real engineering problems encountered and solved.

### The 88,000 Cell Optimization
The health heatmap renders 88k+ cells. Required event delegation instead of individual event listeners. A real performance challenge that vibecoders wouldn't typically encounter but had to solve.

---

## SERIES STRUCTURE (Suggested)

### Thread 1: "The Setup" (Why this exists)
- 120-person agency, 700+ brands, data everywhere
- The gap between knowing what you need and being able to build it
- Mark Cuban's point about AI + existing businesses
- "I'm not a developer. But I deeply understand our workflows."

### Thread 2: "The No-Code Detour" (Airtable/NocoDB)
- Why no-code made sense initially (staff familiarity, relational learning)
- What it taught about databases and relationships
- Why it didn't stick (AI integration limitations)
- "The training wheels aren't wasted time"

### Thread 3: "The Claude Moment" (v1)
- When AI capability crossed the threshold from "demo" to "real"
- Building the first working data connection
- Discovering data enrichment by doing it
- "Partners and Staff are the only two things that matter"

### Thread 4: "The Rewrite" (v1 to v2)
- Why rewriting isn't failure - it's the process
- Using AI to document what you built before building it properly
- The MD file strategy for persistent context
- "v1 is research. v2 is the product."

### Thread 5: "Design is Adoption Strategy"
- Why internal tools are usually ugly and why that kills adoption
- Functional design (Dieter Rams → bartending → software)
- The Interface Craft and animations.dev influence
- "Staff will voluntarily migrate to a well-designed tool"

### Thread 6: "The Bridge Architecture"
- Don't force a hard cutover from legacy systems
- Sync FROM existing sheets INTO the new platform
- Zero-data-loss principle (capture everything, even unmapped columns)
- "Let people cross the bridge at their own pace"

### Thread 7: "Open Source Changed Everything"
- 42 MIT-licensed production dependencies
- The Twenty.com licensing lesson (AGPL vs MIT)
- What's actually free and what isn't
- The composability of modern open-source tools

### Thread 8: "Working with a Dev Agency" (The gap nobody talks about)
- How to bring a dev team into a vibecoded project
- The discovery/alignment dance
- The access setup nobody warns you about (OAuth, env vars, Vercel)
- "The code review that humbled me"

### Thread 9: "The Staging Discipline"
- Learning Git properly (from the dev team)
- Staging-first workflow
- Why "just push to main" stops being okay
- The handoff: who owns what in the pipeline

### Thread 10: "What 56 Database Migrations Look Like"
- The evolution from simple tables to audit trails and connectors
- Entity versioning (time machine for your data)
- Field lineage (every value knows where it came from)
- "Your schema is your autobiography"

### Thread 11: "6 Connectors and Counting"
- Google Sheets, BigQuery, Workspace, Slack, ClickUp, and bridges between them
- The pluggable connector architecture
- Why modularity matters (you'll always add more sources)
- The connector review loop for quality

### Thread 12: "The Numbers" (What actually got built)
- 171 React components
- 40+ API endpoints
- 56 database migrations
- 6 data connectors
- 1,823 partners synced
- 88,000 cells in a single visualization
- 120 staff members about to get a new tool

### Thread 13: "What I'd Do Differently"
- Start with the entity model, not the data sources
- Write the MD files BEFORE building (not after v1)
- Bring in the dev team earlier for architecture review
- Don't try to build everything yourself before asking for help
- The design investment pays for itself in adoption

### Thread 14: "The Boring Builders Manifesto"
- Not building the next unicorn startup
- Rebuilding the messy internal tools that real businesses run on
- The opportunity is enormous and underserved
- "Boring" infrastructure is what keeps companies running
- Community invitation

---

## OBSERVATIONS & HONEST INSIGHTS

### What's Working Well

1. **Domain expertise + AI = fast prototyping.** Tomas can iterate on ideas at the speed of thought because he doesn't need to explain the business context to an external team - he's living it.

2. **The entity-first architecture is genuinely smart.** Most data consolidation projects fail because they model around sources. Modeling around entities (Partners, Staff) creates a stable foundation that new data sources plug into.

3. **The three-layer data protection** (versioning, lineage, raw capture) is enterprise-grade. This isn't something you'd expect from a vibecoded project.

4. **The design investment is strategic, not cosmetic.** Beautiful internal tools get adopted. Ugly ones get resisted. This is an adoption strategy disguised as aesthetics.

5. **The bridge architecture** (sync from legacy, don't force cutover) shows deep understanding of change management in large organizations.

### What Could Be Improved

1. **Testing is minimal.** Jest is installed but test coverage appears thin. As the codebase grows (2.8MB of components + lib code), this becomes a risk. The dev agency should help establish testing patterns.

2. **Documentation is extensive but scattered.** 68+ MD files across `src/docs/`. Some consolidation or an index would help onboarding new contributors (including future AI sessions).

3. **The dev agency handoff process could be more formalized.** Currently relies on ClickUp and conversation. A documented "Definition of Done" for features moving from vibecoded prototype to production-ready would help.

4. **Change Approval workflow is still pending.** This is the safety net for data integrity (review changes before they hit the database). Prioritizing this would protect against sync accidents.

5. **Real-time sync feedback doesn't exist yet.** Syncs can take time on large datasets, and users get no progress indicator. WebSocket or polling for progress would improve trust.

### The Bigger Picture

This project demonstrates something genuinely new: **a non-technical domain expert using AI to build production-quality software, then partnering with a professional dev team to harden it.** Neither party could have done this alone:

- Without Tomas: The dev team would need months of discovery to understand 120 people's workflows across 1,800 accounts
- Without the dev team: The vibecoded foundation would eventually hit scaling, security, and maintenance walls

The combination creates a new archetype: **the AI-augmented operator-builder.**

---

## THE "BORING BUILDERS" COMMUNITY ANGLE

**Why "Boring":**
- Not building the next social media app
- Not launching a startup
- Rebuilding the internal tools that actual businesses run on
- Spreadsheets, CRMs, dashboards, operational workflows
- The unsexy infrastructure that keeps 120 people employed and 700 brands managed

**Target audience:**
- Operations leads at agencies, e-commerce companies, service businesses
- "Technical enough to understand the problem, not technical enough to solve it alone - until now"
- People who manage teams, processes, and data but aren't developers
- Anyone who's looked at their company's Google Sheet disaster and thought "there has to be a better way"

**Content pillars:**
1. The journey (this series)
2. Patterns that work (entity-first, bridge architecture, design-led)
3. Tool reviews through the lens of internal tools (not startups)
4. Working with dev teams (the collaboration model)
5. Real results from real businesses (not just theory)

**Differentiator from other "building in public" accounts:**
- Not solopreneur building a SaaS
- Not a developer learning to code
- An operator inside a real business solving real operational problems
- The messy reality of 150 staff, legacy systems, and change management
- Honest about what works, what doesn't, and what they don't know

---

## RAW CODEBASE STATS (For Content)

| Metric | Value |
|--------|-------|
| Staff managing | 120+ people |
| Partner brands | 700+ (600 active) |
| React components built | 171 files |
| TypeScript lib modules | 104 files |
| API endpoints | 40+ routes |
| Database migrations | 56 sequential versions |
| Data connectors | 6 implemented |
| Production dependencies | 42 packages |
| Lib subdirectories | 43 domains |
| First sync: partners pulled | 1,823 records |
| Duplicates cleaned | 1,100+ records |
| Heatmap cells rendered | 88,000+ |
| Weekly health data | 156 weeks (~3 years) |
| Lines of API route code | 18,500+ |
| Feature documentation | 68+ markdown files |
| Total component code | ~2.0 MB |
| Total lib code | ~804 KB |
| Open source licenses | All MIT/Apache 2.0 |
| Build timeframe | ~2 months (Dec 2025 - Feb 2026) |

---

## WHAT TOMAS DESCRIBED vs WHAT THE CODEBASE REVEALS

### Mentioned
- v0 prototyping
- Airtable/NocoDB exploration
- Claude as build partner
- v1 to v2 rewrite
- Data enrichment concept
- Partners and Staff as core entities
- Google Sheets syncing
- MD file strategy
- Open source discovery
- Working with dev agency (DevWorks)
- ClickUp board for project management
- Design-led approach
- Git/staging workflow education
- Connectors (mentioned sheets, Slack, ClickUp)
- Modules and views
- Adoption strategy (don't force migration)
- Considering OpenClaw/Claude Bot (experimented, returned to building)

### Not Mentioned (But Significant)
- Zero-data-loss source capture (source_data JSONB)
- Entity versioning / time machine (entity_versions table with triggers)
- Field lineage tracking (source provenance per field)
- Value transforms (auto-detection of status/tier normalization)
- AI-assisted column mapping in SmartMapper
- Entity field registry with alias-based fuzzy matching
- Authentication & RBAC system (Google OAuth, role hierarchy)
- Password gate for staging deployments
- PostHog integration (analytics, session replay, error tracking, feature flags)
- Feedback system (Frill-style with voting, roadmap, AI triage, screenshot capture)
- Health heatmap visualization (88k cells, event delegation)
- View builder "inception mode" (iframe + postMessage)
- Module system with 6 widget types
- BigQuery connector (Amazon analytics with computed metrics)
- Google Workspace connector (staff directory with approval queue)
- Slack-ClickUp bridge connector
- Mobile responsiveness work (full responsive design)
- Help documentation system (database-backed, WorkflowCard component)
- Navigation caching for instant page returns
- Standardized API response format across 40+ endpoints
- Rate limiting implementation
- Encryption for sensitive settings
- Security hardening (CSP headers, HSTS, audit logging)
- 56 database migrations documenting schema evolution
- Dry-run preview for sync safety
- Duplicate detection and cleanup (1,100+ records)
- Batch lookup optimization (N queries -> 4, 10x faster)
- Sync locking (prevent concurrent syncs)

---

*This document is a living reference. Update as the journey continues.*
*Generated: 2026-02-17*
