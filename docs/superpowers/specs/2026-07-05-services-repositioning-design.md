# Services Repositioning Design

## Goal

Pass 2 should reposition the KinNoKi Labs site from an app-only portfolio into a
credible studio site for two public lanes:

- native Apple-platform apps built in public; and
- practical business workflow systems for small operators with messy,
  high-value work.

The pass should support a warm lead who checks `kinnokilabs.com` before or after
an in-person conversation. It should make KinNoKi Labs look real, specific, and
useful without naming private prospects or implying client work that has not
started.

## Recommended Approach

Use a services-led repositioning pass:

1. Add a new `/services` page.
2. Add a `Services` link to the top navigation.
3. Lightly update the homepage so the first screen says KinNoKi Labs builds both
   apps and practical workflow systems.
4. Lightly update the About page so the founder/operator story supports the new
   services lane.
5. Keep `/press` out of this pass.

This is the best fit because the urgent business need is credibility for
workflow-automation conversations. A founder-story-first pass would be more
editorial, and a press-kit-first pass would be useful later, but neither gives a
warm business lead the clearest next step today.

## Public Positioning

The new public frame:

> KinNoKi Labs builds focused Apple-platform apps and practical software systems
> for messy real-world work.

The services copy should avoid generic AI-consulting language. Lead with
business outcomes and concrete workflow shapes:

- estimates, quotes, bid rooms, and old-job comparisons;
- reliable company knowledge bases;
- compliance, safety, and reporting paperwork reuse;
- single-workflow automation builds;
- fixed diagnostic reviews and workflow maps;
- Apple-platform rescue and release-pipeline help.

The copy should treat AI as a tool inside reviewable systems, not the product.
Use language like source-linked, reviewable, owner-controlled, searchable,
reusable, and auditable.

## Services Page

Create `Content/services.md` as a top-level Publish page at `/services`.

Structure:

1. `# Services`
2. Short intro: KinNoKi Labs helps small businesses turn repeated operational
   work into practical software, checklists, knowledge systems, and automation.
3. `## Workflow Audits`
   - fixed diagnostic;
   - workflow map;
   - recommended first automation;
   - explicit no-build recommendation when automation is not worth it.
4. `## Single-Workflow Automation Builds`
   - scoped, reviewable, and owner-approved before use;
   - built around one workflow rather than a vague transformation project.
5. `## Reliable Company Knowledge Bases`
   - scattered knowledge across old jobs, spreadsheets, emails, PDFs, quotes,
     forms, supplier notes, and people's heads;
   - make it easier to find, reuse, and review before important decisions;
   - explain money logic: faster quoting, fewer missed requirements, less owner
     bottleneck, less rework, better delegation/onboarding, better follow-through
     after winning work.
6. `## Examples Of Workflows`
   - estimate/quote/bid-room support;
   - lost-bid learning where winning amounts, bid tabs, or debrief data are
     legitimately available;
   - compliance paperwork and safety/reporting reuse;
   - supplier and pricing memory;
   - Apple-platform rescue or release-pipeline cleanup.
7. `## How Engagements Start`
   - paid diagnostic first;
   - scoped first build only if there is a clear ROI;
   - fixed package language where possible;
   - async-friendly work style;
   - human review for high-stakes business decisions.
8. CTA: email `hello@kinnokilabs.com`.

Guardrails:

- Do not name AllSteel, DC, or any prospect.
- Do not imply existing client access, client status, private data, or
  contractor relationship.
- Do not promise automatic bidding decisions, legal/compliance approval, or
  fully autonomous high-stakes outputs.
- Do not write as if KinNoKi has a large agency team.

## Homepage Changes

Keep the homepage simple and app-forward, but add the second lane.

Recommended shape:

- Keep the current H1 unless a better compact H1 naturally emerges.
- Revise the opening paragraph to mention practical software systems for
  real-world workflows, not only native apps.
- Add a short `## Services` section before `## Our Apps` or after it. The section
  should link to `/services` and mention workflow audits, automation builds, and
  reliable company knowledge bases.
- Keep the five-app list from pass 1.
- Do not add hero art, complex cards, or a broad redesign in this pass.

## About Changes

Keep About personal and grounded.

Add or revise copy so it says:

- KinNoKi Labs is a solo independent studio.
- The same operator-first approach behind the apps also applies to business
  workflow systems.
- The work favors small, reviewable systems over vague transformations.
- The background includes building tools around real field constraints, not just
  abstract software taste.

Avoid overclaiming enterprise consulting experience. The About page should make
Dan credible as a practical builder, not pretend KinNoKi is a big consultancy.

## Navigation

Update the shared navigation in `KinNoKiTheme.swift`:

- `Home`
- `Services`
- `Apps`
- `Posts`
- `About`

Keep footer links unchanged unless implementation reveals a layout issue.

## Generated Output

Edit Markdown and theme source, then regenerate `Output/` with Publish. Do not
manually edit `Output/`.

Expected generated additions/changes:

- `Output/services/index.html`
- regenerated home, about, section/nav-bearing pages, RSS, and sitemap as needed.

## Verification

Minimum verification before PR:

- `make generate`
- `test -f Output/services/index.html`
- `rg -n "Workflow Audits|Reliable Company Knowledge Bases|Single-Workflow Automation Builds|Routey|Turn Timer" Content Output`
- local preview, using port `8001` if `8000` is occupied:
  - `/`
  - `/services/`
  - `/about/`
  - `/apps/`
- `git diff --check origin/main..HEAD`
- Cloudflare Pages after PR creation.

## Non-Goals

- No `/press` page in pass 2.
- No prospect-specific page.
- No AllSteel/DC references.
- No new visual identity, logo, social links, scheduler copy, or press kit.
- No App Store badges unless separately verified and scoped.
- No new dependencies.
