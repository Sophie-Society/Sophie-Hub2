# Thread 1: "The Setup"

## Series: Building in Public - The Boring Builders
## Thread Title: I'm rebuilding my company's entire internal infrastructure with AI. Here's why.

---

### Format Notes
- Each numbered item = one tweet/post (aim for ~250 chars each, some longer)
- [IMG] = suggested image/screenshot opportunity
- [HOOK] = conversation starter / engagement prompt
- Tone: first person, honest, slightly self-deprecating, no guru energy

---

### 1/ (Hook)

Mark Cuban said the biggest AI opportunity isn't building new startups.

It's integrating AI into existing businesses.

I manage an agency with 120 staff and 700+ brands. Our "tech stack" was 15 Google Sheets, 3 CRMs, and a prayer.

This is what happens when you actually try to fix that.

### 2/

First, some context.

I run operations at an Amazon brand management agency. 120+ people. 700+ partner brands. 600 active right now.

We manage advertising, content, strategy - the full stack of Amazon services.

Our data lives... everywhere.

### 3/

Here's what "everywhere" looks like:

- Master Client Dashboard (a Google Sheet with 20+ tabs)
- Individual dashboards per team lead
- Brand info sheets per partner
- Google Forms for intake
- Close IO for CRM
- Zoho for invoicing
- Subtask for tickets in Slack
- Amazon Seller Central
- BigQuery for analytics

That's 9 systems. None of them talk to each other properly.

### 4/

If you wanted to answer "what's the full picture for Partner X?" you'd need to open 4-5 different tools, cross-reference manually, and hope nothing was out of date.

150 people do this daily.

I knew we needed something better. I just didn't know what "better" looked like yet.

### 5/

I think a lot of companies are in this exact situation.

You grow fast. You duct-tape systems together. Each department picks their own tools. Scripts connect some things. Sheets fill the gaps.

One day you look up and realise your "infrastructure" is a house of cards held together by VLOOKUP formulas.

### 6/

The typical solutions:

a) Hire a dev team to build custom software (expensive, slow, they don't understand your workflows)

b) Buy an off-the-shelf platform (never quite fits, staff resist the change)

c) Keep duct-taping (what most companies actually do)

I tried something different.

### 7/

I started building it myself.

Not because I'm a developer - I'm not. I did some HTML/CSS and basic JavaScript years ago. Standard stuff.

But I deeply understand our workflows. Every spreadsheet. Every process. Every pain point across every team.

That context is worth more than people realise.

### 8/

Here's the thing nobody talks about:

There's always been this gap. The person who understands the company's workflows is rarely the person who can build the solution.

You hire external devs, spend 3 months explaining the business, and end up with something that technically works but misses the point.

AI is closing that gap.

### 9/

But I didn't jump straight to code.

I started with v0 (Vercel's AI design tool) just drawing concepts. What could a partner dashboard look like? What would a team view feel like?

No databases. No APIs. Just visualising the experience.

This was ~6 months ago. The AI wasn't really there yet for building real tools.

### 10/

Those early prototypes taught me something important though.

I wasn't just thinking about data. I was thinking about how people would *feel* using this thing.

120 staff members who are used to Google Sheets. You can't just dump them into some ugly admin panel and expect adoption.

Design matters. More on that in a future thread.

### 11/

Then I explored the no-code route.

Airtable as a relational database (familiar interface, like Sheets but structured). NocoDB as a frontend layer (role-based views, filters).

The technical people reading this are probably rolling their eyes. "Just use PostgreSQL."

But here's the thing -

### 12/

When you work with 120+ people across departments, at different levels of technical skill, the database needs to be approachable.

"Use a real database" is great advice if your team are developers.

My team manages Amazon advertising campaigns. The tool has to meet them where they are.

### 13/

The no-code detour wasn't wasted time though.

It taught me how relational databases actually work. Primary keys. Foreign keys. How tables connect. What a "join" is in practice, not theory.

These concepts became the foundation for everything I built later - even though the specific tools changed.

### 14/

What killed the no-code path: AI integration.

I wanted Claude to be deeply embedded - helping map data, suggesting connections, analyzing patterns.

Airtable and NocoDB weren't built for that.

With code? You just build it. Just go do it.

So I did.

### 15/

That's when things got interesting.

Claude could now help build actual working applications. Not mockups. Not prototypes. Real tools that connect to real APIs and read real data.

The capability gap from 6 months prior was dramatic.

I connected to our Google Sheets API. And saw our actual live company data in something I built.

### 16/

I didn't know it at the time, but what I was building is called "data enrichment."

I was saying: "This column in this sheet relates to this partner. This email belongs to this staff member."

Taking fragmented data from everywhere and mapping it to two core objects:

**Partners** (brands we manage)
**Staff** (people who do the work)

### 17/

That's the insight that changed everything.

Every single piece of data in our company ultimately ties back to one of two things: a Partner or a Staff member.

ASINs belong to Partners. Training belongs to Staff. Assignments connect them.

Two entities. Everything else is a relationship between them.

### 18/

Once I had that mental model, the first version came together fast.

Messy? Absolutely. But it worked.

Changes in our Google Sheets would sync to the app. Staff could see partner data in one place. The fragmentation was starting to heal.

I was genuinely blown away by how much progress I could make.

### 19/

But here's where I diverge from most "building in public" stories.

I'm not building a SaaS to sell.
I'm not launching a startup.
I'm not a solopreneur shipping a side project.

I'm rebuilding the internal infrastructure of a real company with 120 real employees who need this to work.

The stakes are different.

### 20/

I couldn't just "move fast and break things." People's daily workflows depend on this data.

Partners paying us real money. Staff managing real accounts. Pod leaders running real teams.

So I brought in a professional development agency to work alongside me.

And that's a story almost nobody is telling.

### 21/ [HOOK]

Next thread: How a vibecoder and a dev agency actually work together - the discovery process, the code review that humbled me, and why neither of us could do this alone.

I haven't found much content on this collaboration model. If you have, please share - I'd genuinely love to read it.

### 22/

One more thing.

I'm thinking about building a community around this called **The Boring Builders**.

Not for people building the next unicorn.

For people rebuilding the messy internal tools that real businesses actually run on.

Spreadsheet migrations. Legacy system bridges. Internal dashboards.

The boring stuff that keeps companies alive.

### 23/ [HOOK]

If you're inside a company right now staring at your own Google Sheet disaster and thinking "there has to be a better way" -

There is. And you might be the right person to build it.

You don't need to be a developer. You need to understand the problem.

That's the starting point.

---

## Engagement Notes

**Best posting time:** Weekday mornings (8-10am ET) for business/ops audience

**Potential images/screenshots:**
- Post 3: A blurred screenshot of the actual Google Sheet tab bar (showing 20+ tabs)
- Post 9: v0 prototype screenshots (the early concepts)
- Post 15: First screenshot of the working app showing real data
- Post 17: Simple diagram of Partners/Staff entity model
- Post 22: "Boring Builders" name card / logo concept

**Hashtags (use sparingly, 1-2 per post):**
- #BuildInPublic
- #BoringBuilders
- #InternalTools
- #VibeCoding

**Reply strategy:**
- Respond to everyone who shares their own company's data mess
- Ask questions back ("What tools are you duct-taping together?")
- Be honest about what didn't work, not just what did
- Don't position yourself as an expert - you're sharing the journey

**Quote tweet opportunities:**
- Mark Cuban's AI integration clip
- Any vibecoding discourse (add the "boring" angle)
- Internal tools / ops content from Lenny's Newsletter, Akash Gupta

---

## Thread Stats
- **Posts:** 23
- **Estimated read time:** 4-5 minutes
- **Core narrative:** Problem (fragmented data) -> Exploration (no-code) -> Breakthrough (AI + code) -> Differentiation (not a startup, real business stakes)
- **Cliffhanger:** Dev agency collaboration (Thread 2)
- **Community tease:** Boring Builders
