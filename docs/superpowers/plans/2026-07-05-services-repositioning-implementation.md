# Services Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build pass 2 of the KinNoKi Labs site by adding a public Services page, adding Services to navigation, and lightly repositioning the homepage and About page around apps plus practical workflow systems.

**Architecture:** This is a content-first Publish site change. Markdown files in `Content/` define the public pages, `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift` owns the shared navigation, `Sources/KinNoKiLabsSite/main.swift` owns site metadata, and `Output/` is regenerated from source rather than edited directly.

**Tech Stack:** Swift Package Manager executable, Publish `0.8.0`, Plot-based custom theme, Markdown content, committed generated `Output/` for Cloudflare Pages.

## Global Constraints

- Create `/services` by adding `Content/services.md`.
- Update shared navigation order to `Home`, `Services`, `Apps`, `Posts`, `About`.
- Keep the homepage simple and app-forward, but add the second lane.
- Keep About personal and grounded.
- Edit Markdown and theme source, then regenerate `Output/` with Publish.
- Do not manually edit files under `Output/`.
- Do not name AllSteel, DC, or any prospect.
- Do not imply existing client access, client status, private data, or contractor relationship.
- Do not promise automatic bidding decisions, legal/compliance approval, or fully autonomous high-stakes outputs.
- Do not write as if KinNoKi has a large agency team.
- No `/press` page in pass 2.
- No prospect-specific page.
- No new visual identity, logo, social links, scheduler copy, or press kit.
- No App Store badges unless separately verified and scoped.
- No new dependencies.
- Minimum verification before PR: `make generate`, `test -f Output/services/index.html`, content `rg` checks, local preview of `/`, `/services/`, `/about/`, and `/apps/`, `git diff --check origin/main..HEAD`, and Cloudflare Pages after PR creation.

---

## File Structure

- Create `Content/services.md`: new source page for `/services`, with public services positioning, workflow examples, engagement model, guardrails, and email CTA.
- Modify `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`: shared nav only, adding `Services` in the approved order.
- Modify `Content/index.md`: light homepage repositioning, keeping current H1 and app list while adding a Services section.
- Modify `Sources/KinNoKiLabsSite/main.swift`: site description aligned with the new apps-plus-workflow-systems positioning.
- Modify `Content/about.md`: solo-studio founder/operator positioning and grounded services credibility.
- Regenerate `Output/`: generated HTML, RSS, and sitemap changes produced by `make generate`.

## Branch Setup

- [ ] **Step 1: Start from current main**

Run:

```bash
git fetch origin main
git switch -c codex/site-services-repositioning-impl origin/main
```

Expected: a new branch named `codex/site-services-repositioning-impl` tracking current `origin/main`.

- [ ] **Step 2: Confirm worktree state**

Run:

```bash
git status --short --branch
```

Expected:

```text
## codex/site-services-repositioning-impl...origin/main
```

---

### Task 1: Services Page Source And Generated Page

**Files:**
- Create: `Content/services.md`
- Generate: `Output/services/index.html`
- Generate: `Output/sitemap.xml`

**Interfaces:**
- Consumes: Publish top-level page convention where `Content/services.md` becomes `/services/`.
- Produces: Public Services page text and generated page at `Output/services/index.html`; later navigation and homepage tasks link to `/services`.

- [ ] **Step 1: Write the failing existence check**

Run:

```bash
test ! -f Content/services.md
test ! -d Output/services
```

Expected: both commands exit `0`, proving the Services source and generated page are not present before this task.

- [ ] **Step 2: Create `Content/services.md`**

Create `Content/services.md` with exactly this content:

```markdown
# Services

KinNoKi Labs helps small businesses turn repeated operational work into practical software, checklists, knowledge systems, and automation. The work starts with the real workflow: the quotes, job folders, forms, emails, spreadsheets, supplier notes, and decisions that already keep the business moving.

I build small, reviewable systems around that work so owners and operators can find what matters, reuse what already exists, and make better decisions with less scrambling.

## Workflow Audits

A workflow audit is a fixed diagnostic for one operational problem. The output is a clear map of how the work happens today, where time or money leaks out, and what a first useful automation would look like.

The recommendation can also be no build. Some workflows need a better checklist, a cleaner source of truth, or a simpler handoff before software is worth the cost.

## Single-Workflow Automation Builds

When a workflow is ready, I build around one narrow job at a time: a quote packet, a bid-room checklist, a reporting handoff, a release pipeline, or another repeated process with a clear owner.

The goal is not a vague transformation project. The goal is a scoped tool that can be reviewed, approved, and improved while the business keeps running.

## Reliable Company Knowledge Bases

Most businesses already have valuable knowledge. It is just scattered across old jobs, spreadsheets, emails, PDFs, quotes, forms, supplier notes, and people's heads.

I build reliable company knowledge bases that make that knowledge easier to find, reuse, and review before important decisions. Reliable means source-linked, owner-controlled, and auditable. AI can help with search, extraction, drafts, and reminders, but the system should still show where information came from and leave high-stakes decisions to people.

That kind of business memory can make money in practical ways:

- faster quoting and bid/no-bid decisions because old assumptions, prices, and supplier notes are easier to find;
- fewer missed requirements because forms, due dates, compliance documents, and checklists are tied back to real jobs;
- less owner bottleneck because repeated decisions and document patterns stop living only in one person's memory;
- less rework because the next job starts from reviewed prior knowledge instead of a blank spreadsheet or copied document;
- better delegation and onboarding because staff can see the company's preferred way to estimate, document, report, and close out work;
- better follow-through after winning work because schedules, reporting obligations, safety paperwork, and closeout requirements stay connected.

## Examples Of Workflows

- Estimate, quote, and bid-room support.
- Lost-bid learning where winning amounts, bid tabs, or debrief data are legitimately available.
- Compliance paperwork and safety or reporting reuse.
- Supplier, pricing, and old-job memory.
- Document source-of-truth cleanup for teams with too many almost-final files.
- Apple-platform rescue work, release-pipeline cleanup, and TestFlight/App Store shipping support.

## How Engagements Start

Most work starts with a paid diagnostic. We pick one workflow, map the current reality, identify the first useful improvement, and decide whether a build is worth doing.

If there is a clear return, the next step is a scoped first build. I favor fixed package language where possible, async-friendly collaboration, and human review for important business decisions.

Want to talk through a workflow? Email [hello@kinnokilabs.com](mailto:hello@kinnokilabs.com).
```

- [ ] **Step 3: Regenerate the site**

Run:

```bash
make generate
```

Expected: command exits `0` and Publish reports a successful generation.

- [ ] **Step 4: Verify the generated Services page**

Run:

```bash
test -f Output/services/index.html
rg -n "Workflow Audits|Reliable Company Knowledge Bases|Single-Workflow Automation Builds|hello@kinnokilabs.com" Content/services.md Output/services/index.html
! rg -n "AllSteel|Dan Cooper|DC" Content/services.md Output/services/index.html
```

Expected: `test` exits `0`, the required terms appear in both source and generated output, and the prospect-name guardrail check returns no matches.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add Content/services.md Output
git commit -m "feat: add services page"
```

Expected: a commit containing the new source page and generated Services output.

---

### Task 2: Shared Navigation

**Files:**
- Modify: `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`
- Regenerate: `Output/index.html`
- Regenerate: `Output/services/index.html`
- Regenerate: `Output/apps/index.html`
- Regenerate: `Output/posts/index.html`
- Regenerate: `Output/about/index.html`

**Interfaces:**
- Consumes: existing `navLink(_:_:) -> Node<HTML.ListContext>` helper.
- Produces: shared header navigation containing `Home`, `Services`, `Apps`, `Posts`, and `About` in that order.

- [ ] **Step 1: Write the failing nav check**

Run:

```bash
! rg -n 'navLink\("/services", "Services"\)' Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift
```

Expected: command exits `0` because the Services nav link is absent before this task.

- [ ] **Step 2: Update the nav links**

In `Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift`, replace the current `nav-links` block:

```swift
.element(named: "ul", nodes: [
    .class("nav-links"),
    navLink("/", "Home"),
    navLink("/posts", "Posts"),
    navLink("/apps", "Apps"),
    navLink("/about", "About"),
    .li(
        .button(
            .class("font-toggle"),
            .attribute(named: "onclick", value: "document.body.classList.toggle('font-opendyslexic')"),
            .text("OpenDyslexic")
        )
    )
])
```

with this block:

```swift
.element(named: "ul", nodes: [
    .class("nav-links"),
    navLink("/", "Home"),
    navLink("/services", "Services"),
    navLink("/apps", "Apps"),
    navLink("/posts", "Posts"),
    navLink("/about", "About"),
    .li(
        .button(
            .class("font-toggle"),
            .attribute(named: "onclick", value: "document.body.classList.toggle('font-opendyslexic')"),
            .text("OpenDyslexic")
        )
    )
])
```

- [ ] **Step 3: Regenerate the site**

Run:

```bash
make generate
```

Expected: command exits `0`.

- [ ] **Step 4: Verify generated nav order**

Run:

```bash
rg -n '<a href="/services">Services</a>' Output/index.html Output/services/index.html Output/apps/index.html Output/posts/index.html Output/about/index.html
python3 - <<'PY'
from pathlib import Path
html = Path("Output/index.html").read_text()
labels = [
    '<a href="/">Home</a>',
    '<a href="/services">Services</a>',
    '<a href="/apps">Apps</a>',
    '<a href="/posts">Posts</a>',
    '<a href="/about">About</a>',
]
positions = [html.index(label) for label in labels]
assert positions == sorted(positions), positions
print("nav order ok")
PY
```

Expected: `rg` finds Services in each listed page and the Python check prints `nav order ok`.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift Output
git commit -m "feat: add services navigation"
```

Expected: a commit containing the nav source change and regenerated pages.

---

### Task 3: Homepage Positioning And Site Description

**Files:**
- Modify: `Content/index.md`
- Modify: `Sources/KinNoKiLabsSite/main.swift`
- Regenerate: `Output/index.html`
- Regenerate: `Output/feed.rss`
- Regenerate: `Output/sitemap.xml`

**Interfaces:**
- Consumes: `/services` page from Task 1.
- Produces: homepage copy that introduces both apps and practical workflow systems, plus a site description consistent with that positioning.

- [ ] **Step 1: Write the failing homepage positioning check**

Run:

```bash
! rg -n "practical software systems|/services|Workflow audits" Content/index.md Sources/KinNoKiLabsSite/main.swift
```

Expected: command exits `0` because the new positioning is absent before this task.

- [ ] **Step 2: Replace `Content/index.md`**

Replace all content in `Content/index.md` with:

```markdown
# Building Tools That Make Sense

**KinNoKi Labs** is an independent software studio building focused Apple-platform apps and practical software systems for messy real-world work.

## Services

I help small businesses turn repeated operational work into reviewable tools, checklists, knowledge systems, and automation. That can mean workflow audits, single-workflow automation builds, reliable company knowledge bases, or rescue work for Apple-platform apps and release pipelines.

[See Services](/services)

## Our Apps

Take a look at what we've been working on:

- **[Echo](/apps/echo)**: An audiobook study player that turns listening into learning.
- **[MacroMark](/apps/macromark)**: Apple Watch voice capture for people whose notes live in Markdown.
- **[NS Marks The Spot](/apps/nsmarksthespot)**: Historical Nova Scotia maps, lined up with the map in your hand.
- **[Turn Timer](/apps/visualtimer)**: Visual rounds for real-world countdowns, turns, routines, and reusable sequences.
- **[Routey](/apps/routey)**: Offline-first route support for rural delivery workflows.

---
[About Us](/about) | [Privacy Policy](/privacy)
```

- [ ] **Step 3: Update the site description**

In `Sources/KinNoKiLabsSite/main.swift`, replace:

```swift
var description = "We build native applications for Apple platforms with an emphasis on clarity, performance, and craftsmanship."
```

with:

```swift
var description = "We build focused Apple-platform apps and practical software systems for messy real-world work."
```

- [ ] **Step 4: Regenerate the site**

Run:

```bash
make generate
```

Expected: command exits `0`.

- [ ] **Step 5: Verify homepage output**

Run:

```bash
rg -n "practical software systems|See Services|Reliable company knowledge bases|Routey|Turn Timer" Content/index.md Output/index.html
rg -n "messy real-world work" Sources/KinNoKiLabsSite/main.swift Output/feed.rss Output/sitemap.xml
! rg -n "AllSteel|Dan Cooper|DC" Content/index.md Output/index.html
```

Expected: positioning and app-list terms are present, generated metadata reflects the new description where Publish emits it, and the prospect-name guardrail check returns no matches.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add Content/index.md Sources/KinNoKiLabsSite/main.swift Output
git commit -m "feat: reposition homepage for services"
```

Expected: a commit containing the homepage, site description, and regenerated output.

---

### Task 4: About Page Repositioning

**Files:**
- Modify: `Content/about.md`
- Regenerate: `Output/about/index.html`

**Interfaces:**
- Consumes: services positioning from Tasks 1 and 3.
- Produces: About page copy that explains KinNoKi Labs as a solo studio and supports the services lane without agency overclaiming.

- [ ] **Step 1: Write the failing About positioning check**

Run:

```bash
! rg -n "solo independent studio|small, reviewable systems|field constraints|operator-first" Content/about.md
```

Expected: command exits `0` because the new About positioning is absent before this task.

- [ ] **Step 2: Replace `Content/about.md`**

Replace all content in `Content/about.md` with:

```markdown
# About KinNoKi Labs

**KinNoKi Labs** is a solo independent studio building focused Apple-platform apps and practical software systems for real-world workflows.

## What I Do

I build native applications for Apple platforms - iOS, macOS, watchOS, and visionOS - with an emphasis on clarity, performance, and craftsmanship.

I also help small businesses turn repeated operational work into reviewable tools, checklists, knowledge systems, and automation. The same operator-first approach behind the apps applies there too: understand the real work, find the painful handoff, and build the smallest useful system around it.

## My Approach

- **Swift-first.** I use Swift across the stack, from apps to server-side tooling.
- **Pragmatic design.** I don't chase trends. I build interfaces and workflows that feel obvious in daily use.
- **Reviewable systems.** I favor small, source-linked systems over vague transformations, especially when business decisions carry real cost.
- **Open source.** I share what I learn. Many of my internal tools and libraries are published under permissive licenses.

## Background

KinNoKi Labs is a personal endeavor born out of an obsession with developer tools, productivity software, and getting the details right. The work is grounded in real field constraints: spotty connectivity, repeated paperwork, old job history, shipping deadlines, and the need for tools that still make sense on a busy day.

---

*Want to work together or just say hello? Reach out at [hello@kinnokilabs.com](mailto:hello@kinnokilabs.com).*
```

- [ ] **Step 3: Regenerate the site**

Run:

```bash
make generate
```

Expected: command exits `0`.

- [ ] **Step 4: Verify About output**

Run:

```bash
rg -n "solo independent studio|reviewable tools|small, source-linked systems|field constraints|hello@kinnokilabs.com" Content/about.md Output/about/index.html
! rg -n "AllSteel|Dan Cooper|DC|agency team" Content/about.md Output/about/index.html
```

Expected: the grounded solo-studio terms appear in source and generated output, and the guardrail check returns no matches.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add Content/about.md Output
git commit -m "feat: ground about page in services work"
```

Expected: a commit containing the About source change and regenerated output.

---

### Task 5: Full Verification, Preview, And PR

**Files:**
- Verify: all files changed since `origin/main`

**Interfaces:**
- Consumes: completed Tasks 1 through 4.
- Produces: a ready PR with local verification and hosted Cloudflare status.

- [ ] **Step 1: Run full generation**

Run:

```bash
make generate
```

Expected: command exits `0` and `git status --short` shows no new untracked generated files outside the intended `Output/` changes.

- [ ] **Step 2: Run full content checks**

Run:

```bash
test -f Output/services/index.html
rg -n "Workflow Audits|Reliable Company Knowledge Bases|Single-Workflow Automation Builds|Routey|Turn Timer|practical software systems|solo independent studio" Content Output
! rg -n "AllSteel|Dan Cooper|DC" Content Output
```

Expected: required terms appear and the prospect-name guardrail check returns no matches.

- [ ] **Step 3: Run Swift package build**

Run:

```bash
swift build
```

Expected: command exits `0`.

- [ ] **Step 4: Run diff hygiene check**

Run:

```bash
git diff --check origin/main..HEAD
```

Expected: no output and exit `0`.

- [ ] **Step 5: Preview generated pages**

First try the Publish runner:

```bash
make preview
```

Expected: local server starts at `http://localhost:8000`.

If port `8000` is occupied or the Publish runner exits with the known local `NSConcreteTask terminate` crash after generation, serve the generated output directly:

```bash
python3 -m http.server 8001 --directory Output
```

Then open and inspect:

```text
http://localhost:8001/
http://localhost:8001/services/
http://localhost:8001/about/
http://localhost:8001/apps/
```

Expected: pages load, Services appears in the nav, the Services page is readable, homepage and About copy do not crowd the existing layout, and app pages remain reachable.

- [ ] **Step 6: Commit any final generated differences**

Run:

```bash
git status --short
```

If `make generate` or preview changed generated files after Task 4, commit them:

```bash
git add Output
git commit -m "chore: regenerate services site output"
```

Expected: either no final generated differences exist, or they are captured in a regeneration commit.

- [ ] **Step 7: Push and open PR**

Run:

```bash
git push -u origin codex/site-services-repositioning-impl
gh pr create --repo dfakkeldy/KinNoKiLabsSite --base main --head codex/site-services-repositioning-impl --title "Add services repositioning pass" --body "## Summary
- add a public Services page for workflow audits, automation builds, company knowledge bases, and Apple-platform rescue work
- add Services to the shared navigation
- lightly reposition the homepage and About page around apps plus practical workflow systems
- regenerate committed Output for Cloudflare Pages

## Verification
- make generate
- test -f Output/services/index.html
- rg content checks for Services/company-KB/app terms and prospect-name guardrails
- swift build
- git diff --check origin/main..HEAD
- local preview of /, /services/, /about/, and /apps/"
```

Expected: GitHub returns a PR URL against `main`.

- [ ] **Step 8: Watch Cloudflare Pages**

Run:

```bash
gh pr checks --repo dfakkeldy/KinNoKiLabsSite --watch --interval 10
gh pr view --repo dfakkeldy/KinNoKiLabsSite --json number,state,mergedAt,url,statusCheckRollup --jq '{number,state,mergedAt,url,checks: [.statusCheckRollup[]? | {name, status, conclusion}]}'
```

Expected: Cloudflare Pages reports `SUCCESS`. If the PR auto-merges, report the merged timestamp. If it stays open, report the PR URL and hosted check state.

---

## Self-Review

- Spec coverage: Task 1 creates `/services`; Task 2 adds Services navigation in the approved order; Task 3 updates homepage and site description; Task 4 updates About; Task 5 covers generation, preview, diff hygiene, PR, and Cloudflare. Non-goals are captured in Global Constraints and guardrail checks.
- Filler scan: The plan contains exact files, exact Markdown, exact Swift blocks, exact commands, and expected results for every task.
- Type consistency: The only Swift interface used is the existing `navLink(_:_:) -> Node<HTML.ListContext>` helper; no new functions, dependencies, or data types are introduced.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-services-repositioning-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.
