# Thread 2: "The Dev Agency"

## Series: Building in Public - The Boring Builders
## Thread Title: How a vibecoder and a dev agency actually work together (the part nobody talks about)

---

### Format Notes
- Each numbered item = one tweet/post
- [IMG] = suggested image/screenshot opportunity
- [HOOK] = conversation starter
- Continues from Thread 1 cliffhanger

---

### 1/ (Hook)

I vibecoded an internal platform for my 120-person company.

171 components. 40+ API endpoints. 6 data connectors.

Then I brought in a professional dev agency.

Here's what that collaboration actually looks like - the good, the awkward, and the things nobody warns you about.

### 2/

Quick recap: I run ops at an Amazon agency. Built an internal tool with Claude to replace our fragmented Google Sheets mess.

It worked. Staff could see partner data, sync from sheets, track health metrics.

But I knew I was approaching a ceiling I couldn't see past.

### 3/

The honest reason I brought in a dev team:

I didn't know what I didn't know.

The app ran. Features worked. But I had no idea if the code was structured well, if it would scale, if there were security holes, or if I was building on sand.

That uncertainty is uncomfortable. And it's worth taking seriously.

### 4/

So we engaged a development agency. Not to rebuild everything. Not to take over.

To work alongside.

That distinction matters. This isn't outsourcing. It's a partnership between someone who knows the domain inside-out and people who know engineering inside-out.

### 5/

Here's the first thing nobody tells you:

**The alignment phase takes longer than you expect.**

I'd been living inside this project for months. Every architectural decision made sense to me. The data enrichment flow. The entity model. Why we sync from sheets instead of replacing them.

None of that context transferred automatically.

### 6/

I'd explain the data enrichment process and get back: "Why not just migrate everything to the new database directly?"

Fair question. But the answer requires understanding:
- 150 staff across departments
- Different technical skill levels
- Existing workflows they depend on daily
- Change resistance in large teams

That's business context, not technical context. And it's hard to compress.

### 7/

Lesson learned: **Don't assume your reasoning is obvious just because the conclusion makes sense to you.**

I had to slow down and explain the WHY behind every major decision:

- Why entity-first (not source-first)
- Why sync (not migrate)
- Why design-led (not function-first)
- Why these two core entities and not more

Each one was a conversation, not a sentence.

### 8/ [IMG: simplified version of the onboarding checklist]

Before any code gets reviewed, there's a setup process that took longer than I expected:

- Repository access (GitHub)
- Supabase database access
- Google Cloud project access
- .env.local configured with all the secrets
- Added to Google OAuth redirect URIs
- Verified they could sign in and see data
- Joined communication channels

### 9/

That last point - "added to Google OAuth redirect URIs."

Sounds trivial. Took me a surprisingly long time to figure out.

You need to add their localhost AND their deployment URL as authorized origins and callbacks in Google Cloud Console.

Non-technical leads: budget time for these small blockers. They add up.

### 10/

Once they had access, the first real milestone was the **code review**.

They went through the entire codebase. And this is the part that requires some ego management.

### 11/

When someone who actually knows engineering looks at code you vibecoded with AI, they're going to find things.

Not because you're bad at this. Because there's a difference between "it works" and "it's engineered well."

Both matter. But they're not the same thing.

### 12/

Some of what came back:

- Code structure that could be cleaner
- Patterns that wouldn't scale under load
- Security considerations I'd never thought about
- Opportunities for proper testing
- Places where the architecture was solid (this was validating)

The review wasn't a roast. It was a map of where to go next.

### 13/

Here's what surprised me though:

They were genuinely impressed by the architectural decisions.

The entity-first model. The zero-data-loss capture (storing ALL raw source data, even unmapped columns). The field lineage tracking.

These came from deeply understanding the problem - not from engineering training.

### 14/

This is the key insight of this whole thread:

**Domain expertise and engineering expertise are complementary, not interchangeable.**

I brought the "what" and "why."
They brought the "how to do it properly."

Neither of us could have done the other's job efficiently.

### 15/

After the code review, we set up a ClickUp board.

They listed features they identified. I added the ones I was actively building that they hadn't catalogued yet.

Priorities got assigned. Active work got tracked.

Standard project management stuff - but new to me in this context.

### 16/

Then came the part that fundamentally changed how I work:

**Git education.**

I'd been using Git. Committing. Pushing. Basic stuff.

But "using Git" and "using Git properly in a team" are very different things.

### 17/

What they taught me:

- Branch strategy (staging vs main)
- Why you never push directly to production
- How to review changes before they go live
- What a proper merge flow looks like
- How staging environments catch problems before users see them

### 18/ [IMG: simple diagram of staging -> review -> main flow]

The workflow we landed on:

1. All development happens on `staging` branch
2. Changes deploy automatically to a staging URL
3. We review and test there
4. When confident, merge to `main` for production release
5. The dev team handles the merge to main

Simple. But it requires discipline I didn't have before.

### 19/

We also set up validation gates:

- `npm run build` must pass before any merge request
- Lint checks catch code quality issues
- Automated smoke tests verify core functionality
- Security sweep checklists for sensitive changes

The boring stuff that prevents 2am emergencies.

### 20/

One pattern that emerged was a **review loop** for new features:

```
00-context.md       (business goals)
01-proposal.md      (first plan draft)
02-plan.md          (detailed breakdown)
03-review.md        (findings + feedback)
04-revision.md      (responses + fixes)
FINAL-APPROVED.md   (the thing we build)
```

### 21/

That loop forces something valuable:

Before any code is written, there's a document trail that captures:
- What are we building and why
- What's in scope and what isn't
- What are the phases and dependencies
- What needs to be set up manually (API keys, env vars, migrations)
- What does "done" look like

### 22/

We use this for every significant feature now. Each data connector, each major UI piece.

It means when someone picks up the work - whether it's me, the dev team, or Claude - there's a shared, written agreement on what "done" means.

No more "I thought we were building X" / "No, I meant Y" conversations.

### 23/

The staging password gate is a good example of the collaboration output.

I needed a way to protect the staging URL without paying for Vercel's enterprise tier.

The dev team helped architect a custom middleware solution. Cookie-based. 30-day expiry. Toggle on/off via environment variable.

Simple. Free. Works.

### 24/

Another collaboration win: the security hardening.

6 concurrent review sections. Pre-execution gates. Post-execution verification. Risk severity levels (P1/P2/P3).

This is not something I would have thought to do on my own. And it's exactly the kind of thing that separates "side project" from "production tool."

### 25/

We also set up automated tracking between Slack and ClickUp.

Daily sync at 14:00 UTC. Reads updates from our Slack channel, maps them to ClickUp tasks, posts summaries back.

Means nobody has to manually update the project board. The conversation IS the update.

### 26/

So what does the day-to-day look like now?

I build features with Claude at AI speed. Rapid iteration. Design exploration. Quick prototyping.

The dev team reviews, hardens, and catches things I miss. Proper engineering discipline.

Both streams feed into the same staging branch.

### 27/

The rhythm:

**Me (vibecoder):**
- Build new feature in a session with Claude
- Push to staging
- Document what was built and why

**Dev team (agency):**
- Review the code
- Identify improvements
- Harden for production
- Handle the merge to main

### 28/

Is it perfect? No.

Things I'd improve:

- Get the dev team involved EARLIER. I waited until I had a big codebase. Should have brought them in after the entity model was proven.
- Formalise the handoff process sooner. We figured it out, but it was ad hoc for too long.
- Write the feature docs BEFORE building, not after.

### 29/

Things that work better than expected:

- The vibecoder builds speed + agency engineering quality is a genuine multiplier
- Domain expertise earns respect from engineers (they don't have to guess at requirements)
- The review loop docs eliminate most misunderstandings
- AI-speed iteration means the dev team always has something to review

### 30/

The cost question people will ask:

A dev agency isn't free. But compare it to:

a) Hiring a full dev team (much more expensive, slower to start)
b) Outsourcing everything (they don't know your domain)
c) Doing it all yourself (ceiling you can't see)

The hybrid model sits in a sweet spot I haven't seen people talk about.

### 31/

What I wish someone had told me before starting this:

1. Budget 2-3 weeks for alignment before any real work starts
2. The access setup (OAuth, env vars, database) takes longer than you think
3. The code review will humble you - and that's the point
4. Git discipline is non-negotiable when working with others
5. Document the "why" as much as the "what"

### 32/

6. Your engineering partner will catch things you can't see. That's the value.
7. Your domain expertise will save them months of discovery. That's YOUR value.
8. The review loop docs are worth every minute invested
9. Staging environments save relationships (and production databases)
10. Neither of you could do this alone. That's not weakness, it's how it works.

### 33/ [HOOK]

I genuinely haven't found much content on this collaboration model.

Vibecoder + dev agency.
AI-speed prototyping + engineering discipline.
Domain expertise + technical expertise.

If you're doing something similar, or you're an agency working with non-technical builders, I'd love to hear how you're approaching it.

### 34/

Next thread: Why I obsess over design for an INTERNAL tool - and how "boring builders" should think about UX as an adoption strategy, not vanity.

(Spoiler: functional flair in bartending taught me more about software design than any design course.)

### 35/ [HOOK]

Reminder: I'm thinking about starting a community called **The Boring Builders**.

For people rebuilding internal infrastructure at real companies. Not launching startups. Not shipping SaaS.

Making the messy internal tools work better.

If that's you, drop a follow. More coming.

---

## Engagement Notes

**Best posting time:** Weekday mornings (8-10am ET)

**This thread will resonate with two audiences simultaneously:**
1. Non-technical operators thinking about engaging dev help (the primary target)
2. Dev agencies/freelancers looking for how to work with AI-augmented clients (secondary - they'll share it)

**Potential images/screenshots:**
- Post 1: Stats overlay (171 components, 40+ endpoints, etc.)
- Post 8: Simplified onboarding checklist (redacted)
- Post 18: Staging flow diagram (staging -> review -> main)
- Post 20: Folder structure of the review loop (redacted filenames)

**Reply strategy:**
- Engage heavily with dev agencies/freelancers who reply - they're potential amplifiers
- Ask engineers: "What would YOU want to know before working with a vibecoded codebase?"
- Ask operators: "What's stopping you from engaging a dev team?"
- Be specific about what didn't work, not just what did

**Quote tweet opportunities:**
- Any AI coding discourse (add the "but then what?" angle)
- Dev agency content (add the client perspective)
- Project management posts (add the vibecoder context)

---

## Thread Stats
- **Posts:** 35
- **Estimated read time:** 6-7 minutes
- **Core narrative:** Why bring in a dev team -> The alignment dance -> Code review humility -> Git discipline -> Review loops -> The hybrid rhythm -> What I'd do differently
- **Cliffhanger:** Design as adoption strategy (Thread 3)
- **Community tease:** Boring Builders (reinforced)
- **Unique angle:** This thread serves both sides of the relationship simultaneously
