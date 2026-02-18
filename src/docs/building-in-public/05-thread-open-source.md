# Thread 5: "Open Source Changed Everything"

## Series: Building in Public - The Boring Builders
## Thread Title: 42 open source packages. $0 in licensing fees. Here's what's inside the tool I built for my 120-person company.

---

### Format Notes
- Each numbered item = one tweet/post
- [IMG] = suggested image/screenshot opportunity
- [HOOK] = conversation starter
- Tone: genuine amazement at what's freely available, not a tutorial
- The Twenty.com story is the cautionary tale

---

### 1/ (Hook)

The internal tool I'm building for my 120-person company uses:

- 42 open source packages
- $0 in software licensing fees
- Every single one commercially free

Six months ago I didn't know what "MIT license" meant.

Here's what I've learned about open source - and the licensing mistake that almost caught us.

### 2/

Before I started building, I assumed that serious software required serious money.

Enterprise databases. Paid UI frameworks. Licensed charting libraries. Monthly subscriptions for every piece of the stack.

Turns out that's not even close to true.

### 3/

The open source ecosystem is overwhelmingly generous.

Nearly everything you need to build a production-grade internal tool - from the database to the charts to the animations to the icons - is available for free, with explicit permission for commercial use.

The barrier isn't access to tools. It's knowing they exist.

### 4/

Let me walk you through what's actually inside our app and what each piece does.

Not to show off the stack. But because six months ago, I wish someone had just shown me what's possible when you compose these things together.

### 5/ [IMG: the dependency tree diagram]

**The foundation: Next.js + React + TypeScript**

Next.js is the framework that runs everything. It handles routing (each URL maps to a file), server-side rendering (pages load fast), and API routes (backend logic alongside frontend).

React renders the interface. TypeScript catches bugs before they reach users.

All three: MIT licensed. Free. Used by Netflix, Shopify, TikTok.

### 6/

**The database: Supabase (PostgreSQL)**

This was a breakthrough moment for me.

Supabase gives you a full PostgreSQL database with a dashboard, authentication, and real-time features. The open source version is free.

It's what replaced our Airtable idea. Same relational structure. Infinitely more powerful.

### 7/

What Supabase gives us that Airtable couldn't:

- Row-Level Security (different users see different data)
- Database triggers (automatically record every change)
- JSONB columns (store flexible data alongside structured data)
- Direct SQL (for complex queries the UI can't do)

And it connects to AI tools natively. That was the dealbreaker.

### 8/

**The UI components: shadcn/ui + Radix UI**

This one blew my mind.

shadcn/ui gives you 24 pre-built, professionally designed components: buttons, dialogs, dropdowns, tables, forms, tooltips.

But here's the key - you don't install a package. You copy the code into your project. You OWN it. Modify it however you want.

### 9/

Under the hood, shadcn sits on top of Radix UI.

Radix handles all the hard stuff: keyboard navigation, screen reader support, focus management, scroll locking.

You never see Radix. You just get components that work properly for everyone - including people using assistive technology.

11 Radix packages. 24 usable components. All accessible by default. MIT license.

### 10/

**The styling: Tailwind CSS**

Instead of writing CSS files, you style directly in your HTML: `className="text-sm font-medium text-gray-600"`

Sounds messy. In practice, it's incredible.

Every spacing value, every colour, every breakpoint is consistent because they come from the same system. Design consistency by default.

### 11/

**The animations: Framer Motion**

Remember the functional flair from Thread 3? This is the library that makes it possible.

Spring physics for natural movement. Exit animations when things disappear. Layout animations when elements move.

Our entire animation system - easing curves, durations, spring configs - is built on top of this one library.

### 12/

**The charts: Recharts**

For the reporting dashboards. Bar charts, line charts, composed charts.

Drop in a `<ResponsiveContainer>`, add your `<Bar>` and `<Line>` components, pass data. Done.

It automatically scales to fit the container, handles hover tooltips, supports dark mode.

Free. MIT.

### 13/

**The flow diagrams: React Flow**

We built a visual Data Flow Map showing how data moves from Google Sheets through our enrichment pipeline into the database.

Entity nodes, source nodes, mapping edges. Zoom, pan, minimap.

Would have taken months to build from scratch. Took days with React Flow.

### 14/

**The whiteboard: Excalidraw**

When staff submit bug reports, they can draw annotations on screenshots. Circles, arrows, text.

Excalidraw is the same drawing tool used by millions of people online. It's MIT licensed. We embedded it directly.

Dynamic import so it only loads when needed (it's a big library). Theme-aware so it matches light/dark mode.

### 15/

**The drag and drop: dnd-kit**

Dashboard widgets can be rearranged by dragging. Sections can be reordered.

dnd-kit handles collision detection, visual feedback during drag, smooth animations on drop.

Three packages. Composable. Lightweight. MIT.

### 16/

**The search: MiniSearch**

Client-side fuzzy search across 700+ partners. Type "acm" and "ACME Corp" appears instantly.

No server round-trip. No latency. Works offline.

The entire search index is under 100KB. It builds in milliseconds from the partner list.

Sometimes the simplest tool is the best one.

### 17/

**The icons: Lucide**

1,200+ SVG icons. Consistent 24px grid. Every icon we need: settings, refresh, trash, chevrons, charts, users.

One import. Type-safe. Tree-shakeable (only the icons you use get bundled).

We probably use 50+ different icons across the app. Total bundle cost: negligible.

### 18/

**The notifications: Sonner**

Toast messages. "Saved." "Sync complete." "Error: try again."

Sonner handles positioning, auto-dismiss, action buttons, dark mode.

One line: `toast.success('Saved')`. That's it. Elegant defaults.

### 19/

**The dates: date-fns**

Parse dates. Format dates. Calculate week numbers. Find intervals.

Our health heatmap needs ISO week numbering across 156 weeks. date-fns handles all of it.

Lighter than Moment.js (which is basically deprecated). Tree-shakeable. MIT.

### 20/

**The analytics: PostHog**

Session replay, error tracking, feature flags, analytics events.

If something breaks in production, we can watch the recording of what the user was doing. Identify the bug from their perspective.

The free tier is extremely generous. We're nowhere near the limits.

### 21/

**The AI: Anthropic SDK**

Claude helps with column mapping suggestions during data enrichment.

"This column is called 'PPC Strategist' - I think it maps to the pod_leader_name field with 92% confidence."

Structured output via tool-use. Rate-limited to prevent cost overruns. Haiku for quick tasks. Sonnet for deeper analysis.

### 22/

**The screenshots: html2canvas**

When staff submit a bug report, the app captures a screenshot of the current page before the modal opens.

This preserves whatever state they were looking at - open dropdowns, hover states, error messages.

One library. Automatic. Users don't have to figure out how to take a screenshot.

### 23/

That's 42 packages. Here's what strikes me:

Every single one is MIT or Apache 2.0 licensed. Commercially free. No royalties. No per-seat fees. No "call us for enterprise pricing."

People built these things and gave them away so others could build on top of them.

The generosity is staggering.

### 24/

Now the cautionary tale.

While exploring open source options, I found Twenty.com - an open-source CRM. Beautiful UI. Great feature set. Looked perfect.

Then I read the license.

### 25/

Twenty uses AGPL (GNU Affero General Public License).

AGPL means: if you modify the code and deploy it (even internally on a server), you must share YOUR modified source code publicly.

For an internal company tool? That's a dealbreaker. We can't share our codebase.

### 26/

This taught me something crucial:

**"Open source" doesn't always mean "free to use however you want."**

There are two worlds:

**Permissive** (MIT, Apache 2.0): Do whatever you want. Just include the copyright notice. Commercial use explicitly allowed.

**Copyleft** (GPL, AGPL): You can use it, but your modifications must also be open-sourced.

### 27/

For building internal company tools:

MIT/Apache 2.0 = safe. Use freely.
AGPL = check carefully. May require you to publish your code.
GPL = generally fine for internal-only tools (no distribution), but gets complex.

When in doubt, check the LICENSE file. It takes 30 seconds.

### 28/ [HOOK]

If you're new to this like I was, here's the cheat sheet:

| License | Can I use it commercially? | Do I need to share my code? |
|---------|:-:|:-:|
| MIT | Yes | No |
| Apache 2.0 | Yes | No |
| BSD | Yes | No |
| AGPL | Yes, but... | Yes (if deployed) |
| GPL | Yes, but... | If distributed |

### 29/

Now, here's the part that fascinates me about composition.

None of these 42 packages know about each other. They weren't designed to work together.

But when you compose them thoughtfully, you get something that feels cohesive. Like a single product, not a Frankenstein of libraries.

### 30/

For example:

Radix provides accessible dropdown behaviour.
shadcn styles it with Tailwind.
Framer Motion animates the open/close.
Lucide provides the chevron icon.
Sonner shows a toast if the action succeeds.

Five libraries. One dropdown. Feels like one piece of software.

### 31/

The skill isn't knowing every library. It's knowing which ones to pick and how they fit together.

Like a chef doesn't grow their own vegetables. They source the best ingredients and combine them well.

The open source ecosystem is your farmers market. The composition is the cooking.

### 32/

What composition looks like in practice:

Our feedback system uses:
- shadcn for the modal UI
- html2canvas for screenshot capture
- Konva for drawing annotations on screenshots
- Excalidraw for freehand sketches
- Supabase for storage
- PostHog for session replay linking
- Anthropic SDK for AI-assisted bug triage
- Sonner for confirmation toasts

8 open source packages. One feature. Seamless.

### 33/

And the cost of all that?

Supabase: free tier
PostHog: free tier
Claude API: ~$0.05 per bug analysis (we use Haiku for quick summaries at $0.001)
Everything else: $0

The most expensive part of our feedback system is the AI triage. At roughly 5 cents per deep analysis.

### 34/

I want to address something that more technical people might be thinking:

"Isn't 42 dependencies a liability? What about supply chain risk?"

Fair point. Here's how we think about it:

### 35/

1. **Every dependency is from an established, well-maintained project.** React has 200k+ GitHub stars. Tailwind has 80k+. Radix, Recharts, date-fns - all battle-tested by millions.

2. **We pin versions.** No automatic updates that could break things.

3. **The dev agency reviews dependency choices.** They flag anything that looks risky or unmaintained.

4. **We keep it minimal.** 42 sounds like a lot, but many projects have 200+. We actively avoid adding packages when native solutions exist.

### 36/

What we deliberately DON'T use:

- No Redux (React hooks + TanStack Query handle state)
- No GraphQL (REST + Zod validation is simpler for our use case)
- No ORM (Supabase client + raw SQL when needed)
- No CSS-in-JS (Tailwind is faster and more consistent)
- No monorepo tools (single package, single build)

Sometimes the best dependency decision is the one you don't add.

### 37/

Here's what I wish someone had told me six months ago:

You don't need to build everything from scratch.
You don't need to pay for enterprise software.
You don't need a computer science degree to compose open source tools.

You need to know what exists, check the license, and start building.

### 38/

The open source community built these tools and said: "Here, use this. Build something great with it."

42 packages. Thousands of contributors. Millions of hours of work.

All free. All commercially licensed. All powering an internal tool for a real company.

That's remarkable. And I don't think enough non-technical builders know about it.

### 39/ [HOOK]

What open source package has been the biggest surprise for you?

The one you didn't know existed until you needed it, and then it changed how you build things?

For me it was shadcn/ui. The idea that you can own the components instead of depending on a library was a paradigm shift.

### 40/

Next thread: The numbers - what 2 months of building actually produced. 171 components, 56 database migrations, 6 data connectors, and the metrics that tell the real story of progress.

### 41/ [HOOK]

The **Boring Builders** community is growing.

If you're composing open source tools into internal platforms for real businesses - not shipping SaaS, not building startups - you're one of us.

The ingredients are free. The recipe is the hard part. Let's share recipes.

---

## Engagement Notes

**Best posting time:** Weekday mornings (8-10am ET)

**This thread has wide appeal:**
1. Non-technical operators who don't know what's available (primary audience)
2. Developers who will validate the stack choices (credibility)
3. Open source advocates who love seeing adoption stories
4. Indie hackers comparing their own stacks

**Potential images/screenshots:**
- Post 5: Simplified dependency tree diagram (framework → UI → data → viz → utils)
- Post 28: License comparison table (clean graphic)
- Post 30: The "5 libraries, 1 dropdown" diagram
- Post 32: The feedback system package breakdown

**Engagement magnets:**
- Post 1 hook: "$0 in licensing fees" will get attention
- Post 24-27: The Twenty.com/AGPL story is novel - most people don't know about this trap
- Post 28: The license cheat sheet will get bookmarked and shared
- Post 31: The cooking analogy is quotable
- Post 39: "What open source package surprised you?" will drive massive engagement

**Reply strategy:**
- When people suggest alternative packages: "Thanks, I'll check it out" (genuine curiosity, not defensive)
- When devs critique the stack: "What would you have picked instead?" (learn in public)
- When people ask about specific packages: Give honest mini-reviews
- When open source maintainers reply: Engage heavily, they're your heroes in this narrative

**Quote tweet opportunities:**
- shadcn/ui posts (you're a case study in the "copy, don't install" philosophy)
- Open source sustainability discussions (add the "business user" perspective)
- "Build vs buy" discourse (open source is a third option)
- Any AGPL/licensing discourse (you have a real story)

**Specific shoutouts to consider tagging:**
- @shadcn (shadcn/ui creator)
- @emilkowalski_ (Sonner creator + animations.dev from Thread 3)
- @leaborato / Radix team
- @suaboreto / Supabase team
- Any maintainers of libraries you use who are active on X

**Thread-specific note:**
- This is the most "shareable" thread in the series so far
- The license cheat sheet (post 28) will circulate independently
- The cooking analogy (post 31) is meme-able
- Consider making post 28 into a standalone graphic for maximum shareability

---

## Thread Stats
- **Posts:** 41
- **Estimated read time:** 7-8 minutes
- **Core narrative:** Discovery of open source → Tour of 42 packages → The AGPL lesson → Composition philosophy → What's deliberately absent → Encouragement for non-technical builders
- **Cliffhanger:** The numbers / full build metrics (Thread 6)
- **Community tease:** Boring Builders ("ingredients are free, recipes are the hard part")
- **Breakout potential:** HIGH - the license cheat sheet and package tour format are inherently shareable
