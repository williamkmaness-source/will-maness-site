# QA issue drafts — 2026-07-11, updated through 2026-09-06

Draft GitHub issues from the hiring-manager QA passes in `docs/qa/`. Nothing
here has been filed as a real issue unless noted below — review and approve
in this PR first, then file whichever ones you want tracked (title/labels
are in each file's frontmatter, ready to copy into `gh issue create` or the
GitHub UI).

**2026-09-06 update:** this PR consolidates and supersedes PR #245
(2026-08-01), PR #248 (2026-08-23), and PR #249 (2026-08-30) — all three
sat open and unreviewed, and #249 itself was written to supersede the
other two but never got merged either. `main` has now gone **five weeks**
without a commit (still at `dd40435`, from 2026-08-01). Every finding below
was independently re-verified against today's `main` — re-read from source,
not copy-pasted forward — plus a full `pnpm build`, `pnpm exec vitest run`
(471/471), and `pnpm lint`, all clean. Recommend closing #245, #248, and
#249 without merging once this PR is reviewed. See
`docs/qa/2026-09-06-hiring-manager-qa.md` for the full write-up.

| # | Title | Priority | Status |
| - | ----- | -------- | ------ |
| 01 | `/work/vendor_feed` legacy route crashes with an unhandled 500 | High | Resolved (#234) |
| 02 | `/ember` is an indexable duplicate of `/work/ember` | High | Resolved (#236) |
| 03 | About page renders two `<h1>` elements | Medium | Resolved (#238) |
| 04 | Live-data widgets show raw error string instead of designed fallback | Medium | Resolved (#235) |
| 05 | Work index doesn't show in-progress status (per execution brief) | Medium | Resolved (#237) |
| 06 | Add a custom 404 page | Low | Resolved (#239) |
| 07 | Remove unused create-next-app placeholder assets | Low | Resolved (#240) |
| 08 | MEMORY.md is stale and Phase 1 quiz is missing | Low | Resolved (#241) |
| 09 | Consider: "Sable" doesn't reinforce the technical-fluency narrative | Low / discussion | Open — editorial call, not a bug |
| 10 | Pipeline Dashboard's copy describes chess tracking it doesn't do | Medium | Superseded by 15 — recommend filing 15 instead |
| 11 | Homepage share image (`og:image`) fails to render (missing `display:flex`) | **High / blocker** | **Open 3 weeks — recommend filing now** |
| 12 | A live blog post is placeholder text | **High / blocker** | **Open 2 weeks — recommend filing now** |
| 13 | Mobile footer contact row overflows on every page | Medium | Open — recommend filing |
| 14 | `/work/[slug]` is force-dynamic despite having `generateStaticParams` | Medium | Open — recommend filing |
| 15 | Pipeline Dashboard has four disagreeing sources of truth for what it tracks | Medium | Open — recommend filing (supersedes 10) |
| 16 | Hardcoded hex colors violate the project's own token rule | Low | Open — recommend filing |
| 17 | No route-level error boundaries anywhere in the app | Low | Open — recommend filing |
| 18 | Confusing near-duplicate URLs: `/work/vendor-feed` vs `/work/vendor_feed` | Low | Open — recommend filing |
| 19 | Small content nits from the August pass (bundled) | Low | Open — recommend filing |

**Recommended next step:** merge this PR (and close #245, #248, and #249
without merging — all three are fully superseded), then file 11 and 12 as
real issues first — both are one-file fixes with outsized visibility (the
homepage's own share preview, and a five-month-old placeholder post
syndicated in the site's RSS feed) — before working through 13–19 and
making a call on 09.
