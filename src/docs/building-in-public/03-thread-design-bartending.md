# Thread 3: "Design is Adoption Strategy"

## Series: Building in Public - The Boring Builders
## Thread Title: I used to be a bartender. It taught me more about software design than any design course.

---

### Format Notes
- Each numbered item = one tweet/post
- [IMG] = suggested image/screenshot opportunity
- [HOOK] = conversation starter
- This is the "why design matters for internal tools" thread
- The bartending analogy is the throughline

---

### 1/ (Hook)

I used to be a bartender.

TGI Fridays. Cocktail bars. The works.

It taught me more about building internal software than any design course ever could.

Let me explain - because this changed how I think about every tool I build for my 120-person company.

### 2/

In bartending, there are two kinds of flair.

**Show flair:** Throw the bottle in the air, spin it behind your back, catch it. Crowd loves it. Looks amazing. Slows you down.

**Functional flair:** Lift from the speed rack in one move, toss, catch, pour. Smooth. Fast. The customer barely notices - but they get their drink faster.

### 3/

At TGI Fridays, the show flair was part of the experience. Entertainment was the product.

But at the serious cocktail bars I worked at? Nobody wanted a circus act.

They wanted their Old Fashioned made perfectly, served quickly, with a bartender who made the whole experience feel effortless.

That's functional flair.

### 4/

Software design works exactly the same way.

There's a temptation - especially with AI tools now making everything possible - to make things flashy. Fancy animations. Dramatic transitions. Impressive-looking dashboards.

But internal tools don't need a circus act.

They need functional flair.

### 5/

Here's my situation: I'm building an operations platform for 120 staff managing 700+ brands.

These people open this tool every day. Multiple times a day. For years.

If a button bounces too much, it's annoying by day three.
If a page transition takes 400ms too long, it's maddening by week two.
If loading states are ugly, people assume the tool is broken.

### 6/

Most internal tools look like garbage.

Not because the developers don't care. Because there's this assumption that internal = it just needs to work.

"It's not customer-facing, so who cares how it looks?"

Your staff. Your staff cares. And their willingness to adopt the tool depends on it.

### 7/ [HOOK]

Here's the insight most people miss:

**Design isn't vanity for internal tools. It's adoption strategy.**

Pretty tools get used voluntarily.
Ugly tools get used reluctantly - or not at all.

When you're trying to migrate 120 people off Google Sheets, that difference is everything.

### 8/

So I took design seriously from day one.

Not because I'm a designer. I'm not. I run operations.

But I'm a deeply design-conscious person. I think about how interfaces feel, not just what they do. How interactions flow, not just that they function.

And I found two resources that changed how I build.

### 9/

**Resource 1: Interface Craft** (Josh Puckett)

Their philosophy: "Build interfaces with uncommon care."

Not flashy. Not impressive. Careful. Considered. Every pixel serves a purpose.

I added their methodology as a skill in my Claude setup. When I finish a feature, I trigger a design critique pass. It checks the work against the principles.

### 10/

**Resource 2: animations.dev** (Emil Kowalski)

Emil is a design engineer and his work on animation principles is outstanding.

The key insight: most UI animations are wrong. They use the wrong easing, the wrong duration, or they exist for no reason.

His principles are baked into our animation system.

### 11/

Let me get specific. Here's what our design system actually looks like in code.

Every animation in the app follows one rule:

**Use `ease-out` for user interactions. Always.**

`ease-out` means: fast start, gentle finish. The UI responds INSTANTLY to your click, then settles smoothly.

### 12/

The opposite - `ease-in` - means: slow start, fast finish.

Ever clicked a button and felt like the UI was thinking about whether to respond? That's `ease-in`. It feels sluggish. Unresponsive. Like the tool doesn't respect your time.

We banned it entirely from our codebase.

One line in our design rules: "Never use ease-in. Avoid completely."

### 13/ [IMG: the duration tiers]

Duration matters as much as easing.

Our scale:
- **Button press:** 150ms (micro - you shouldn't consciously notice it)
- **Dropdowns & modals:** 200ms (fast enough to feel instant, slow enough to track)
- **Page transitions:** 300ms (smooth but never sluggish)

Everything above 400ms needs a very good reason to exist.

### 14/

Here's a detail that took me a while to learn:

**Don't animate things when the page loads.**

Sounds obvious. But when you're building with AI and Framer Motion, every component wants to fade in, slide up, scale from zero.

On first load, that's just flickering. It's noise. It's the show flair.

### 15/

The fix is two words: `initial={false}`

Tell the animation library: "Don't animate on mount. Only animate when the state changes."

Badge appears on page load? No animation. Just there.
User clicks to expand a section? NOW animate.

The difference between these is the difference between a tool that feels calm and one that feels anxious.

### 16/

Now, the bartending analogy goes deeper than animation.

Remember: functional flair means the customer barely notices, but they get their drink faster.

In software terms: the user doesn't notice the design decisions, but everything feels right. Fast. Calm. Trustworthy.

Here are some of those invisible decisions.

### 17/

**Press feedback.**

Every button in our app has `active:scale-[0.97]` - when you press it, it shrinks by 3%.

You will never consciously notice this. But your brain registers it. It feels like you pressed a real thing. Tactile. Physical.

Remove it and the buttons feel flat. Dead. Like clicking into a void.

150ms. 3% scale. Invisible. Essential.

### 18/

**Tabular numbers.**

When a counter updates - say, partner count goes from 598 to 612 - the digits shouldn't shift the layout around.

`font-variant-numeric: tabular-nums` makes every digit the same width. The number changes but nothing jumps.

You'll never notice it's there. You'd absolutely notice if it wasn't.

### 19/

**Shadows instead of borders.**

Most apps use `border: 1px solid grey` to separate elements.

We use `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` instead.

The visual difference is subtle. But shadows blend with the background instead of sitting on top of it. The interface feels softer. More cohesive. Less like a spreadsheet.

### 20/

**Loading skeletons with shimmer.**

When data is loading, you could show a spinner. Or you could show the shape of the data that's coming, with a gentle diagonal light sweep moving across it.

Our shimmer wave: 1.5 second cycle, staggered 40ms per cell, `ease-in-out`. Creates a calm, flowing effect.

It communicates: "Data is coming. We know what shape it'll be. Relax."

### 21/ [IMG: screenshot of the shimmer loading state]

Compare that to a spinner.

A spinner says: "Something is happening. No idea what or when it'll finish."

A shimmer skeleton says: "Here's exactly what you'll see in a moment. The layout is already here."

One creates anxiety. The other creates trust.

That's functional flair.

### 22/

**Empty states that guide.**

When there's no data in a section, we never show just "No data."

Instead:
1. A contextual icon (muted, not dramatic)
2. A specific heading ("No sections yet" not "Empty")
3. Guidance text (what this is for, what to do next)
4. A clear action button ("Add First Section")

Every dead end becomes a signpost.

### 23/

Let me tell you about the heatmap.

We built a GitHub-style health visualization showing 156 weeks of partner status data. Think: a grid of tiny coloured cells showing which partners are healthy, at risk, or churning.

700 partners. 156 weeks each. That's 88,000+ cells on one screen.

### 24/ [IMG: screenshot of the health heatmap]

The design challenge wasn't making it pretty. It was making it *not destroy the browser*.

88,000 individual click handlers would crash the page.

So we used event delegation - one handler on the container, reading data attributes from whatever cell you hover. The grid doesn't care how many cells exist.

### 25/

The tooltip appears after a 150ms delay (not instant - prevents flicker when scanning). Disappears instantly on scroll. Cells resize on mobile (14px vs 12px desktop) for touch targets.

Four sorting modes: At Risk, Most Turbulent, Healthiest, Most Data.

None of these performance decisions are visible to the user. They just see: "Fast. Smooth. Works."

Functional flair.

### 26/

Our vote button on the feedback system has a spring animation.

When you upvote an idea, the count doesn't just increment. It pops - scale to 130%, bounces back with spring physics. Subtle. 150ms. You feel it more than see it.

And it's optimistic - the UI updates instantly, then confirms with the server. If the API fails, it silently reverts.

You click, you see the result. No waiting. No spinners.

### 27/

Dark mode follows the same philosophy.

When you toggle themes, background colours transition over 300ms with `ease-out`. Border colours transition faster at 150ms.

And on initial page load? `transition: none` until hydration completes. Otherwise you'd see a flash of white-to-dark. Ugly. Distracting.

The good theme toggle is one you don't think about.

### 28/

Mobile gets its own set of invisible decisions.

Touch targets are 44px minimum (Apple's guideline). But we go further:

Buttons are `h-10` (40px) on mobile, `h-9` (36px) on desktop. Labels hide on mobile, showing only icons - more space, less clutter.

Inputs are 16px minimum font size. Not because of preference - because iOS auto-zooms on inputs smaller than 16px. Breaks the whole layout.

### 29/

Here's one that comes directly from Dieter Rams:

**"Good design is as little design as possible."**

Our spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Nothing else.

Z-index scale: dropdown 100, modal 200, tooltip 300, toast 400. Fixed. Predictable.

Max 2-3 font sizes per view. Colour is purposeful, not decorative.

Constraints create consistency. Consistency creates trust.

### 30/

Now, someone might read all this and think: "This is over-engineering for an internal tool."

Let me tell you what happened when I showed the early version to team leads.

"This looks... real."

Not "this is cool" or "nice animation." Their reaction was trust. It looked like a tool they could rely on. That's the goal.

### 31/

Here's why this matters for anyone building internal tools:

Your staff have been using Google Sheets, Notion, Slack, Linear, Figma. Tools built by world-class design teams.

Then you give them your internal dashboard with default Bootstrap styling and a loading spinner from 2015.

The gap is visceral. They don't trust it. They go back to the sheet.

### 32/

The design investment isn't about making things look nice.

It's about making the migration from legacy tools feel like an **upgrade**, not a downgrade.

Staff should log in and think: "Oh, this is better."

Not: "Oh, I guess I have to use this now."

One gets voluntary adoption. The other gets resistance.

### 33/

I want to be clear: I'm not saying this is the best way to do it.

Our design system is borrowed from people much smarter than me. Emil Kowalski. Josh Puckett's Interface Craft. Dieter Rams' principles. Apple's HIG. Linear's attention to detail.

I just applied their thinking to a "boring" internal tool. And it works.

### 34/

The design docs we maintain:

- **UX Standards** - 200+ lines covering spacing, typography, borders, z-index, touch targets, forms, empty states
- **Animation System** - Centralised easing curves, durations, spring configs, shimmer constants
- **Component Checklist** - Pre-ship verification for every new component

These live in the repo. Claude reads them. The dev team enforces them.

### 35/

Here's my checklist for anyone building internal tools:

- [ ] Buttons have press feedback (scale 0.97, 150ms)
- [ ] No animation on page load (initial={false})
- [ ] Loading shows skeleton shapes, not spinners
- [ ] Empty states guide the next action
- [ ] Touch targets are 44px+ on mobile
- [ ] Transitions use ease-out, never ease-in
- [ ] Dynamic numbers use tabular-nums
- [ ] Theme transitions don't flash on load

### 36/

None of these are expensive. None require a design team. They're just care.

The same care a good bartender puts into every pour. Not flashy. Not slow. Just right.

Functional flair.

Your staff deserve tools built with uncommon care. Even the boring internal ones.

Especially the boring internal ones.

### 37/ [HOOK]

What invisible design decisions have made the biggest difference in tools you use daily?

Not the big redesigns. The tiny things. The details you feel but can't point to.

I bet it's smaller than you think.

### 38/

Next thread: The "bridge architecture" - why we sync FROM legacy Google Sheets instead of forcing everyone onto a new system, and what zero-data-loss actually means when you're responsible for 1,800 accounts.

### 39/ [HOOK]

Still building **The Boring Builders** community.

For people who think deeply about design, data, and adoption for internal tools at real companies.

Not startup vibes. Operations vibes.

If the bartending-to-software pipeline resonates, you're one of us.

---

## Engagement Notes

**Best posting time:** Weekday mornings (8-10am ET), or Sunday evening (reflective content)

**This thread has broad appeal beyond the core audience:**
- Designers will engage with the animation/easing specifics
- Developers will engage with the code examples (press feedback, tabular-nums, event delegation)
- Product managers will engage with the adoption strategy angle
- Non-technical people will engage with the bartending analogy

**Potential images/screenshots:**
- Post 1: Photo from bartending days (if available) or a cocktail bar image
- Post 13: Duration tier diagram (150ms / 200ms / 300ms with labels)
- Post 21: Side-by-side: shimmer skeleton vs spinner
- Post 24: Screenshot of the health heatmap (redacted partner names)
- Post 35: The checklist as a clean graphic

**Engagement magnets:**
- Post 7 will get quote-tweeted by design Twitter ("Design is adoption strategy")
- Post 12 ("We banned ease-in") is a spicy take that will get engagement from animation nerds
- Post 37 is the best conversation starter - people love sharing invisible details they've noticed
- The bartending analogy is inherently shareable - it's a novel frame

**Reply strategy:**
- Engage with anyone who shares their own "functional flair" examples
- Ask designers: "What's the most impactful invisible detail in your product?"
- If people push back on "over-engineering" internal tools, lean into the adoption data
- Share specific before/after examples if people ask

**Quote tweet opportunities:**
- Emil Kowalski animation content (you're applying his principles)
- Linear design posts (they embody this philosophy)
- Any "internal tools don't need design" takes (respectful counter-perspective)
- Josh Puckett / Interface Craft content

**Cross-reference:**
- Tag/mention Emil Kowalski and Interface Craft (they may engage)
- Reference the specific tools: Framer Motion, Tailwind, shadcn/ui
- Dieter Rams content always gets engagement from the design community

---

## Thread Stats
- **Posts:** 39
- **Estimated read time:** 7-8 minutes
- **Core narrative:** Bartending flair types -> Functional vs show flair in software -> Specific design decisions in the codebase -> Why this matters for adoption -> Checklist for boring builders
- **Cliffhanger:** Bridge architecture and zero-data-loss (Thread 4)
- **Community tease:** Boring Builders (bartending pipeline angle)
- **Unique frame:** Bartending -> software design is a novel comparison that hasn't been made before in tech Twitter. This could be the breakout thread of the series.
