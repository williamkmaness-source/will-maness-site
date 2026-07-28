# QA pass — follow-up, reading the site as a VP-of-Product hiring manager

_2026-07-18. One-week follow-up to the 2026-07-11 pass (`docs/qa/2026-07-11-hiring-manager-qa.md`,
shipped as PR #232, merged same day). That PR's own test plan flagged the 9
findings as drafts only — "Will: review `docs/qa/issue-drafts/` and approve
which findings should become real issues" — and none were filed as real
GitHub issues or fixed in code in the week since. This pass re-verifies all 9
against today's `main` on a clean `pnpm build && pnpm start`, and checks
what changed in the interim._

**What changed since 2026-07-11.** Two commits landed: the QA PR itself, and
`[palette] Slice 3: all harmony schemes + curated results` (#229) for the
Seasonal Color Palette project. Nothing else touched the live site — none of
the 9 findings were addressed.

## Findings 1–3, 6–9: unchanged, re-confirmed

Re-ran the original repro steps against today's build. All still reproduce
exactly as documented, with no drift:

- **`/work/vendor_feed` 500** — still crashes (`No Postgres connection
  string found`), still no `error.tsx`. (`issue-drafts/01`)
- **`/ember` duplicate route** — still 200, still no `noindex`, still a
  second surface for the same crash. (`issue-drafts/02`)
- **`/about` double `<h1>`** — `content/site.mdx` line 38 is still literal
  `# ` heading syntax; `mdx-components.tsx` still has no `h1` override.
  (`issue-drafts/03`)
- **No custom 404** — `src/app/not-found.tsx` still doesn't exist.
  (`issue-drafts/06`)
- **Unused scaffold SVGs** — all five still sitting in `public/`, still
  unreferenced. (`issue-drafts/07`)
- **Stale `MEMORY.md` / missing Phase 1 quiz** — still dated 2026-05-06,
  still says Phase 1 is "Ready to start." (`issue-drafts/08`)
- **Sable positioning** — `project-stellar.mdx` frontmatter unchanged.
  (`issue-drafts/09`)

## Findings 4–5: unchanged, and the gap widened slightly

**#4, raw error-string copy in live-data widgets.** Same finding, but this
pass turned up a third instance not caught last time:
`RequestTypeBreakdown.tsx` (the Boston civic-data department drilldown
chart) has the identical `throw new Error(\`API error ${res.status}\`)` →
render-the-raw-message pattern as `StaffingDashboard` and `EmberDashboard`.
Separately, `#210 fix(ember): restore expired synoptic weather api key` is
currently open — meaning this failure mode isn't just a DB-less-sandbox
artifact, the Ember widget's weather fetch is (or recently was) actually
broken in production, so a visitor could hit this raw string for real right
now. `issue-drafts/04` updated with both details.

**#5, no in-progress indicator on work cards.** Still exactly the same
`WorkCard.tsx` code as last week. The underlying numbers moved against it:
Seasonal Color Palette shipped a genuinely polished "Slice 3" this week (four
harmony-scheme palette cards, clean invalid-hex handling) and is still marked
`status: "in-progress"` with zero visual signal of that on its card — the
best current illustration of why this matters. Project count is now 7 of 10
in-progress (was undercounted as 6 in the original pass, which missed "This
site"). `issue-drafts/05` updated.

## New, not filed as an issue: the palette widget itself is clean

Spot-checked the new `PaletteSkeleton.tsx`/`PaletteCard.tsx` widget
(`/work/seasonal-palette`) against the same failure classes as the rest of
this report — single `<h1>` on the page, invalid-hex input handled with a
plain-English inline message rather than a thrown error's raw text, no crash
on empty/garbage input. No findings. Noting it because it's a useful
counter-example: it's proof the fallback-copy fix requested in #4 is already
the house style for a component built this week, it just hasn't been
backfilled onto the three older widgets.

## Not re-verified this pass

- Chess Tournament Tracker / Lichess Broadcasts widget — still no outbound
  network to lichess.org in this sandbox. Carried over from the original
  report as a manual-pass item against the live site.
- Music pattern analyzer (`#211`–`#219`) — DB schema and Spotify client
  landed this week but there's no `content/projects/` entry or route for it
  yet, so it isn't user-facing and is out of scope for this pass.

## Bottom line

No regressions, no fixes. All 9 original findings are still open exactly as
filed, one (#4) got a bit more evidence behind it, one (#5) got slightly more
material. Recommend treating `docs/qa/issue-drafts/` as current and filing at
least the two High-priority items (01, 02) as real issues this cycle —
they're both one-line deletes.
