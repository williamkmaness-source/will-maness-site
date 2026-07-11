# QA pass — reading the site as a VP-of-Product hiring manager

_2026-07-11. Reviewed the production build (`pnpm build && pnpm start`) and, for
comparison, `https://willmaness.com` directly. Crawled all 17 published routes at
desktop (1440px) and mobile (390px) widths with a headless browser, capturing
console errors, failed requests, and screenshots; cross-checked findings by
reading the relevant source and, where a finding was route- or server-behavior
related, by re-running the production server standalone to rule out dev-only
artifacts._

**Frame.** The site's stated job (per `CLAUDE.md`) is to prove technical fluency
to a VP-of-Product hiring manager at an AI-infra/data-tooling company. That
audience clicks fast, judges on first impression, and treats a broken
demo as signal about engineering judgment, not a minor bug. The findings below
are graded on that basis, not on "does the framework technically work."

**Overall impression.** The core reading experience — home, work index, about,
writing — is genuinely strong: clean type, honest in-progress framing, real
projects, no CMS cruft. The issues below are concentrated in the parts of the
site the brief itself flagged as risk (live third-party data widgets) plus a
handful of leftover routes from before projects were migrated to the MDX
content system.

---

## Findings

### 1. `/work/vendor_feed` — legacy duplicate route crashes with an unhandled 500 (High)

`src/app/work/vendor_feed/page.tsx` is a standalone server component left over
from before the Vendor Intelligence Feed project was migrated to the
content-driven `/work/vendor-feed` (hyphen) page. It fetches from Postgres with
no try/catch and no `error.tsx` boundary in that route segment. Confirmed on a
clean `pnpm build && pnpm start`:

```
/work/vendor_feed -> HTTP 500
⨯ Error: No Postgres connection string found
```

Any transient DB issue (Neon cold start, pool exhaustion, credential rotation)
crashes this URL the same way, and it currently renders Next's bare unstyled
error page — no nav, no footer, no brand. The route isn't linked from the site
and isn't in the sitemap, but it is publicly reachable, and only carries
`noindex`, not a redirect or removal.

**Fix:** delete `src/app/work/vendor_feed/` (superseded by the MDX-driven
`/work/vendor-feed`), or if it must stay temporarily, add an `error.tsx`
boundary and a redirect to the canonical URL.

### 2. `/ember` — duplicate of `/work/ember`, publicly indexable (High)

Same pattern as #1: `src/app/ember/page.tsx` is a standalone page that
duplicates `/work/ember` (the canonical, MDX-driven project page). Confirmed
both return 200 on production build. Unlike `/work/vendor_feed`, `/ember` has
**no `noindex` meta at all**, so search engines can index two URLs with
overlapping content — a duplicate-content signal, and a second surface where
the same Postgres-dependent crash in finding #1 can happen.

**Fix:** delete `src/app/ember/page.tsx` and its route, or 301-redirect
`/ember` → `/work/ember`.

### 3. Two `<h1>` elements on `/about` (Medium)

`content/site.mdx`'s bio text ends with a literal Markdown heading:

```
# If you've come from an outreach email of mine: thank you for actually clicking through.
```

`mdx-components.tsx` registers styling overrides for `h2`, `p`, `blockquote`,
`code`, `pre`, and `a` — but not `h1`. Tailwind's preflight reset means this
renders with no distinguishing size, so it *looks* fine, but it's a real `<h1>`
in the DOM:

```html
<h1 class="font-serif text-[42px] ...">About</h1>
...
<h1>If you've come from an outreach email of mine: ...</h1>
```

Two `<h1>`s on one page is an accessibility/SEO smell (screen readers use `<h1>`
to orient; search engines use it as the page's primary topic signal) and, more
practically, a sign the sentence was authored as a heading by accident.

**Fix:** change the leading `#` to plain text (or a `>` blockquote, which
already has a styled treatment) in `content/site.mdx`.

### 4. Live-data project widgets show a raw error string instead of a designed fallback (Medium)

`StaffingDashboard` (Boston civic data) and `EmberDashboard` (EmberBrief) both
render literally `API error 503` — the raw `Error(...)` message from the fetch
— when their backing route fails. Reproduced locally (no DB configured, so
`/api/311-departments` and `/api/ember-data` 503):

> API error 503

This is developer-facing text shown to a site visitor. It's `font-mono`/styled
enough not to look like a raw stack trace, but the copy itself breaks the "this
person is careful about what visitors see" impression the whole site is going
for — worse, it appears mid-page directly below the project's own pitch
paragraph. `EmberDashboard` already has better copy available
(`"Could not load fire data. The pipeline may still be initializing."`) for the
`!data` branch but only shows it when `error` is falsy; the `error` string
(the raw HTTP message) takes precedence and is what actually renders.

**Fix:** in both components, always show a user-facing fallback sentence
("Live data temporarily unavailable — check back shortly") and keep the raw
error message out of the render path (log it, or put it behind a dev-only
flag).

### 5. No visual "in progress" indicator on work cards (Medium)

The execution brief (`_spec/execution-brief.md`, Phase 1 definition of done)
calls for the `/work` index to show "status indicators (in progress / complete
/ forthcoming)." In the shipped `WorkCard.tsx`, the only behavior tied to
`status` is a `0.65` opacity dim, and only for `status: "forthcoming"` — a
value no current project uses. `status: "in-progress"` (6 of 10 projects:
Boston civic data, EmberBrief, Pipeline Dashboard, Seasonal Color Palette,
Vendor intelligence feed, Sable) renders identically to `"complete"`.

This compounds finding #4: a hiring manager who lands on the EmberBrief card,
clicks through, and hits the raw `API error 503` has no prior signal that
they're looking at a project still being built — it just reads as broken.

**Fix:** render the status as a small label/dot on the card (the design system
already has `ClayDot` and `Tag` primitives suited to this), at minimum for
`in-progress`.

### 6. No custom 404 page (Low)

`/nonexistent-page-test-404` and `/ember` variants... 404 falls through to
Next's bare default (`404 | This page could not be found.`, no nav, no
footer). `_spec/execution-brief.md` explicitly defers a "custom 404" to Phase
4, so this is in scope and expected — flagging only because it's the one place
on the site that currently breaks visual continuity by design, and it's a
cheap fix relative to the rest of Phase 4's scope (search, newsletter, `/now`).

**Fix:** add `src/app/not-found.tsx` reusing `Container`/`Nav`/`Footer` with a
one-line message and a link home.

### 7. Unused Next.js scaffold assets still in `public/` (Low)

`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` are the default
`create-next-app` placeholder icons, unreferenced anywhere in `src/` or
`content/`. Harmless functionally, but the repo is explicitly part of the
credibility pitch ("Repo: Public GitHub — codebase is part of the credibility
pitch," `MEMORY.md`) and a hiring manager who browses the repo (not just the
site) will see them.

**Fix:** `rm public/{file,globe,next,vercel,window}.svg`.

### 8. Process docs are stale relative to shipped work (Low)

`docs/MEMORY.md` still shows "Phase 1 | 🟡 Ready to start" as of its last
update (2026-05-06), while `docs/build-log.md` and the actual routes show
Phase 1 shipped long ago and multiple post-MVP projects (chess tracker, Ember,
seasonal palette, vendor feed, pipeline dashboard) are live. Separately,
`_spec/execution-brief.md` calls for a `docs/quizzes/phase-N.md` at the end of
each phase; `docs/quizzes/` has `phase-0.md` and `phase-2.md` but no
`phase-1.md`. Neither affects the live site, but both docs are part of the
"teaching overlay" process this repo is built to demonstrate, and a technical
reviewer who opens the repo (plausible, given the positioning) will notice the
gap between the stated process and its artifacts.

**Fix:** update `MEMORY.md`'s status table, and either write the missing
Phase 1 quiz or note in the doc why it was skipped.

### 9. "Sable" project sits in Selected Work without a technical framing (Low / consider)

`content/projects/project-stellar.mdx` ("Sable") is tagged `game design`,
`writing`, `art direction` — no `engineering` tag, and its summary is pure
narrative pitch. It's a fine piece of writing, but it's the one entry in the
work grid that doesn't reinforce the site's stated purpose (technical fluency
for AI-infra/data-tooling hiring managers) and currently isn't marked
`featured`, so it only shows on `/work`, not the homepage — that part's fine.
Worth a deliberate call: keep it as "range of interests" texture, or add a
sentence connecting it to the technical work (tooling built for it, systems
thinking, etc.) so it doesn't read as off-brand to the target reader.

---

## Not filed as issues

- `va.vercel-scripts.com` connection errors and `net::ERR_CONNECTION_RESET` in
  the crawl logs — sandbox has no outbound network to Vercel's analytics
  CDN; not reproducible as a real issue and won't occur in production.
- Next.js dev-mode indicator badge overlapping body text on mobile
  (`desktop`/`mobile` screenshots taken against `next dev`) — confirmed this
  is the framework's own dev-only overlay; does not appear in the production
  build.
- `/dev/components` — confirmed it correctly 404s on a production build
  (`pnpm build && pnpm start`); the dev-only gate works as documented.
- Chess Tournament Tracker and other client-fetch widgets (Lichess Broadcasts
  API) couldn't be fully exercised in this sandbox (no outbound network to
  lichess.org). Worth a manual pass against the live site to confirm the
  "no active broadcast" empty state reads well, since the same
  raw-error-string risk in finding #4 could apply.
