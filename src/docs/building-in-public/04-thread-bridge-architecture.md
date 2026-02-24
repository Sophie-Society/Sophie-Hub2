# Thread 4: "The Bridge Architecture"

## Series: Building in Public - The Boring Builders
## Thread Title: We didn't replace our Google Sheets. We built a bridge from them. Here's the architecture.

---

### Format Notes
- Each numbered item = one tweet/post
- [IMG] = suggested image/screenshot opportunity
- [HOOK] = conversation starter
- This is the most technical thread so far - but written for operators, not engineers
- The metaphor: bridges, not bulldozers

---

### 1/ (Hook)

Everyone told us to "just migrate off Google Sheets."

We manage 1,800 accounts across 15+ spreadsheets with 120 staff.

You can't "just migrate" that. You'd break every workflow overnight.

So we built a bridge instead. And the architecture behind it is the most interesting thing in our entire project.

### 2/

The conventional wisdom when your company outgrows spreadsheets:

"Export everything to a proper database. Switch everyone over. Decommission the sheets."

Sounds clean. Makes sense on a whiteboard.

Has anyone who says this ever tried to change how 120 people work? In the middle of managing 600 active client accounts?

### 3/

Here's what actually happens when you force a hard cutover:

- Day 1: "Where's my data?"
- Day 3: "This doesn't show the thing I need"
- Day 7: Someone creates a shadow spreadsheet
- Day 14: Half the team is using the old sheets anyway
- Day 30: You have TWO systems and ZERO source of truth

Ask me how I know.

### 4/

Our approach is different.

We don't replace the sheets. We build a bridge FROM them.

The sheets stay. Staff keep using them. But the data flows automatically into a proper database, enriched, normalised, and connected.

Over time, as the new tool proves itself, people voluntarily cross the bridge.

### 5/ [IMG: simple diagram of the bridge concept]

The mental model:

```
[Google Sheets] ──bridge──> [Database] ──> [New App]
     ↑                                        ↑
  Staff edit here                    Staff use here
  (familiar)                         (better experience)
```

Both sides stay live. The bridge keeps them in sync.

Nobody is forced to change anything on day one.

### 6/

"But isn't that more complex than just migrating?"

Yes. Significantly.

But complexity in the architecture beats chaos in the organisation. I'd rather have a sophisticated sync engine than a staff revolt.

### 7/

Let me walk you through what the bridge actually does.

It's not just copying cells from a spreadsheet into a database. It's a five-step process that took months to get right.

### 8/

**Step 1: Discovery.**

Our Master Client Dashboard has 20+ tabs. Each tab has different columns, different formats, different headers.

Some tabs have headers on row 0. Our main one has headers on row 9. Nine rows of notes and formatting before the actual data starts.

The system has to detect this automatically.

### 9/

We built a SmartMapper that:

1. Reads the first 20 rows of a sheet
2. Scores each row on "how likely is this the header?"
3. Presents candidates to the admin: "Is this row 0 or row 9?"
4. Saves that choice. Every future sync uses it.

Sounds simple. It's not. But it only needs to be configured once per sheet.

### 10/

**Step 2: Classification.**

Once we know the headers, every column needs to be classified.

"Brand Name" = this is a Partner field.
"Pod Leader" = this is a Staff assignment.
"1/6/25, 1/13/25, 1/20/25..." = these are weekly status columns.
"Internal Notes" = skip this entirely.

### 11/

Each column gets three decisions:

**Category:** Partner? Staff? Product? Weekly data? Skip?

**Target field:** Which database column does this map to?

**Authority level:** Is this sheet the Source of Truth for this field, or just a Reference?

That last one is crucial.

### 12/

**Authority levels explained:**

Your Master Client Sheet says the Pod Leader is "John Smith."
An individual Brand Info sheet also lists the Pod Leader as "Jane Doe."

Which one wins?

Whatever you've marked as Source of Truth for that field. The Reference source gets captured but doesn't overwrite.

### 13/

This means multiple sheets can feed data about the same partner without stepping on each other.

Master Sheet owns core fields (name, status, tier).
Brand Info sheets own contact details (email, phone).
Analytics feeds own metrics (revenue, ad spend).

Each source has its lane. No conflicts.

### 14/

We also built auto-matching.

The database field is called `pod_leader_name`. But your sheet column might say "PPC Strategist" or "Pod Leader" or just "PL."

Every field has aliases. When you classify a column, the system tries to auto-match based on the column header. Gets it right about 80% of the time.

### 15/

**Step 3: Transformation.**

Google Sheets are messy. People type whatever they want.

Status column in the sheet: "Active", "ACTIVE", "active", "Active ", " Active"

Database needs: "active"

The transform layer normalises everything during sync.

### 16/

We have 10 transform types:

- **Trim** – remove extra spaces
- **Lowercase/Uppercase** – normalise case
- **Value mapping** – "Active" becomes "active", "Churned" becomes "churned"
- **Date** – parse "01/15/2024" to proper ISO format
- **Currency** – extract 1234.56 from "$1,234.56"
- **Boolean** – "Yes"/"No"/"1"/"0" to true/false
- **Number** – parse "1,234" to 1234

### 17/

The clever bit: auto-detection.

When you map a column to the `status` field, the system automatically applies value mapping with all known status values.

When you map to `tier`, it knows "Tier 1" should become "tier_1".

You don't configure this. It just works.

### 18/

**Step 4: The Sync.**

This is the engine. 1,200+ lines of code that orchestrate the actual data flow.

Here's what happens when someone clicks "Sync":

### 19/

**4a. Load config** (1 query)
Which sheet? Which tab? Which columns? What transforms?

**4b. Fetch source data** (1 API call)
Pull the sheet data, respecting the header row.

**4c. Batch lookup** (4 queries for 1,800 rows)
Check which partners already exist in the database.

This used to be 1 query per row. 1,800 queries. Took forever.

Now it chunks into groups of 500. Four queries total. 10x faster.

### 20/

**4d. Process each row:**

For each of 1,800 rows, in memory:
- Apply transforms (Active → active)
- Check authority (can this source update this field?)
- Determine action: create new? update existing? skip?
- Capture ALL raw values (even unmapped columns)

**4e. Write changes** (batches of 50)
- New records: insert
- Existing records: upsert (update on conflict)
- Progress logged every 500 rows

### 21/ [HOOK]

**Step 5: The part I'm most proud of.**

Zero-data-loss capture.

Every single value from every single column of the source sheet is preserved. Even columns you didn't map to anything. Even columns you marked as "skip."

Nothing. Is. Ever. Lost.

### 22/

Here's what that looks like in the database:

Every partner has a `source_data` field that stores the raw values from every source that's fed data about them.

```
Partner: ACME Corp
source_data: {
  "Master Client Sheet": {
    "Brand Name": "ACME Corp",
    "Status": "Active",
    "Pod Leader": "John Smith",
    "Random Internal Note": "check Q3 targets"
  }
}
```

That last field? Not mapped to anything. Preserved anyway.

### 23/

Why does this matter?

Because six months from now, when someone says "Hey, there was a column called Random Internal Note in the old sheet - do we still have that data?"

Yes. We do. It's right there in the source_data.

You never have to go back to the original sheet. The bridge captured everything.

### 24/

But wait, there's more. (I know, I know.)

**Field lineage.**

Every field on every partner tracks WHERE it came from.

Pod Leader changed from John to Jane? The system records:
- Which sheet triggered the change
- Which tab and column
- The old value and new value
- When it happened
- Which sync run caused it

### 25/

In the UI, you can hover over any field and see a tooltip:

"Source: Master Client Sheet → Partners tab → Column D (Pod Leader)"
"Last updated: Feb 15, 2026 via sync"

It's provenance. For every single data point.

When you're responsible for 1,800 accounts, knowing where data came from isn't a nice-to-have. It's survival.

### 26/

And then there's the time machine.

Every INSERT, UPDATE, and DELETE on the partners table is automatically captured by a database trigger.

Full row snapshot. Before and after. Which fields changed. When.

Want to know what a partner's record looked like last Tuesday? Query the versions table. It's all there.

### 27/

So in total, there are three layers of data protection:

1. **Source Data** – raw capture of everything from every import
2. **Field Lineage** – per-field provenance tracking
3. **Entity Versions** – full row snapshots on every change

Belt, suspenders, and a safety net.

### 28/

"Isn't that overkill for an internal tool?"

We manage client accounts worth real money. A wrong status change could affect how a Pod Leader prioritises their work. A lost data point could mean a client falls through the cracks.

When the data matters, the protection can't be optional.

### 29/

Now let me tell you about the dry-run preview.

Before any sync actually writes to the database, you can run it in preview mode.

It shows you:
- New records that will be created (green)
- Existing records that will be updated, with field-level diffs (yellow)
- Records that won't change (grey)

### 30/

The first time we ran a real sync?

1,823 partners pulled from the Master Client Sheet.

1,523 new records created.
300 existing records updated.
0 data lost.

Then we found 1,100 duplicates from earlier test runs and cleaned them up with proper upsert logic (update on conflict instead of creating new rows).

Real engineering problems. Solved by getting it wrong first.

### 31/

There's also sync locking.

If someone clicks "Sync" while a sync is already running, the system blocks it. One sync per sheet at a time.

Without this, two concurrent syncs could create duplicate records, overwrite each other's changes, or corrupt the batch tracking.

Simple safeguard. Prevents real chaos.

### 32/

One more thing about the bridge: **weekly data pivoting.**

Our Master Client Sheet has columns like: 1/6, 1/13, 1/20, 1/27...

Each one is a weekly status for that partner. Hundreds of date columns stretching back years.

The sync engine detects these, pivots them into proper time-series rows:

### 33/

```
Sheet row:
ACME | OK | At Risk | At Risk | OK

Becomes:
partner: ACME, week: Jan 6, status: OK
partner: ACME, week: Jan 13, status: At Risk
partner: ACME, week: Jan 20, status: At Risk
partner: ACME, week: Jan 27, status: OK
```

This is how we built the 156-week health heatmap from Thread 3. The bridge transforms wide spreadsheet data into a proper time-series database structure.

### 34/

And all of this is designed to be **connector-agnostic.**

Google Sheets is our first connector. But the bridge architecture is pluggable.

We've since added:
- BigQuery (Amazon analytics)
- Google Workspace (staff directory)
- Slack (team communication)
- ClickUp (task management)

Same entity model. Same transforms. Same protection. Different source.

### 35/

The pluggability matters because the question isn't "how do we get data from Google Sheets?"

The question is "how do we get data from ANYWHERE into a single source of truth?"

Sheets today. Slack tomorrow. Amazon API next week. The bridge handles them all.

### 36/

Now, here's the honest part.

This architecture is complex. More complex than "just dump it in a database."

But the complexity lives in ONE place: the sync engine. Staff never see it. They see a clean app with their data in it.

And the complexity pays for itself in:
- No data loss (ever)
- Full audit trail (always)
- Gradual migration (no big bang)
- Multiple sources feeding one truth

### 37/

If you're thinking about building something similar, here's what I'd tell you:

1. **Start with your entities, not your sources.** What are the two or three things your business actually cares about? Everything maps to those.

2. **Capture everything.** Even data you don't think you need. Storage is cheap. Regret is expensive.

### 38/

3. **Authority levels prevent chaos.** Decide which source owns which fields. Write it down. Enforce it in code.

4. **Transforms are boring but essential.** "Active" vs "active" will haunt you if you don't normalise on import.

5. **Dry-run everything.** Never write to the database without previewing first. Your future self will thank you.

### 39/

6. **Track provenance.** When someone asks "where did this data come from?" - and they will - you need an answer.

7. **Build for reversibility.** Entity versioning costs almost nothing (~1KB per change) and saves you when something goes wrong.

8. **The bridge is temporary by design.** The goal is for people to eventually work in the new tool directly. The bridge is how you get there without burning the old one.

### 40/ [HOOK]

The bridge architecture is our answer to the question every growing company faces:

"How do we modernise without disrupting?"

We don't have all the answers. But we have 1,823 synced partners and zero data lost.

If you're facing the same question, I'd love to hear your approach.

### 41/

Next thread: Open source changed everything - how 42 MIT-licensed packages became the foundation for an enterprise-grade internal tool, and the licensing lesson that almost caught us out.

### 42/ [HOOK]

Building **The Boring Builders** community for people who care about data integrity, migration architecture, and building bridges between legacy and modern systems.

Not the sexiest topic. But if your company runs on spreadsheets and you're thinking about what's next - this is for you.

---

## Engagement Notes

**Best posting time:** Weekday mornings (8-10am ET), or Tuesday/Wednesday (mid-week focus)

**This thread will resonate with:**
1. Operations/data people who've tried and failed at sheet migrations
2. CTOs/technical leads evaluating migration strategies
3. Data engineers who appreciate the provenance architecture
4. Anyone who's lived through a failed "just migrate everything" project

**Potential images/screenshots:**
- Post 5: Bridge diagram (sheets → database → app)
- Post 13: Authority levels diagram (which source owns which fields)
- Post 21: source_data JSONB example (redacted real data)
- Post 29: Dry-run preview screenshot (new/updated/skipped counts)
- Post 33: Weekly pivot diagram (wide sheet → time-series rows)

**Engagement magnets:**
- Post 3 will trigger war stories ("Ask me how I know" is invitation to share failures)
- Post 6 is a quotable line: "Complexity in the architecture beats chaos in the organisation"
- Post 21 (zero-data-loss) will attract data engineering community
- Post 40 asks directly for alternative approaches - will drive technical discussion

**Reply strategy:**
- Engage with anyone sharing migration horror stories
- Ask data engineers: "How do you handle provenance in your pipelines?"
- If people suggest "just use Fivetran/Airbyte" - acknowledge the tools, explain why custom fits better for this use case (agency-specific entity model, non-standard sheet structures)
- Be honest about the 1,100 duplicate cleanup - real problems are relatable

**Quote tweet opportunities:**
- Any "just migrate your spreadsheets" advice (respectful counter with the bridge approach)
- Data engineering content about lineage/provenance
- Posts about failed migrations or change management
- dbt/data pipeline content (different domain, similar principles)

**Technical credibility moments:**
- Post 19: The batch lookup optimisation (N queries → 4) shows real engineering
- Post 26: Entity versioning with triggers shows database knowledge
- Post 32: Weekly pivot is a real data transformation challenge
- Post 34: Connector-agnostic design shows architectural thinking

**Thread-specific risk:**
- This is the most technical thread. Some followers from Thread 1-3 may find it dense.
- Mitigation: the "bridge, not bulldozer" metaphor carries non-technical readers through
- The emotional hooks (post 3 war story, post 28 "when data matters") keep it human

---

## Thread Stats
- **Posts:** 42
- **Estimated read time:** 8-9 minutes
- **Core narrative:** Why migration fails → Bridge concept → Five-step process (discovery, classification, transformation, sync, zero-data-loss) → Three protection layers → Practical advice
- **Cliffhanger:** Open source discovery (Thread 5)
- **Community tease:** Boring Builders (data integrity angle)
- **Strongest posts:** 3 (war story), 6 (quotable), 21 (zero-data-loss), 27 (three layers), 37-39 (practical advice)
- **Technical depth:** Highest of the series so far, but metaphor-led to stay accessible
