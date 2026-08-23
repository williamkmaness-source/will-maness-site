# QA issue drafts — 2026-07-11 (re-confirmed 2026-07-18, 07-25, 08-01, 08-23)

Draft GitHub issues from the hiring-manager QA passes in `docs/qa/`. Nothing
here has been filed as a real issue unless noted below — review and approve
in the originating PR first, then file whichever ones you want tracked
(title/labels are in each file's frontmatter, ready to copy into
`gh issue create` or the GitHub UI).

**2026-08-23 update:** all 8 findings from the original 07-11 pass (01–08)
are confirmed fixed and merged on current `main` — independently
re-verified this pass, matching what PR #245 (2026-08-01, still open and
unreviewed after three weeks) already reported. Finding 09 remains an open
editorial call. Finding 10 is still unfixed and still unfiled — this pass
found the underlying mismatch runs deeper than originally described, so
**15 supersedes 10** with the fuller diagnosis (recommend filing 15, not
10). Eight new items this pass: 11–19, two of them (11, 12) high-priority
and both "first five minutes" visible. Full write-up:
`docs/qa/2026-08-23-hiring-manager-qa.md`.

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
| 11 | Homepage share image (OG image) fails to render in production | **High** | **Open — recommend filing** |
| 12 | "Where the data moat lives" blog post is placeholder text, live in production | **High** | **Open — recommend filing** |
| 13 | Every page overflows horizontally on mobile (footer contact row) | Medium | Open — recommend filing |
| 14 | `/work/[slug]` force-dynamic contradicts the site's own static-by-default claim | Medium | Open — recommend filing |
| 15 | Pipeline Dashboard: four sources of truth disagree on tracked pipelines | Medium | Open — recommend filing (supersedes 10) |
| 16 | Hardcoded hex colors violate the project's own token-only rule | Low | Open — recommend filing |
| 17 | No route-level error boundaries anywhere in the app | Low | Open — recommend filing |
| 18 | Confusing near-duplicate URLs: `/work/vendor-feed` vs `/work/vendor_feed` | Low | Open — recommend filing |
| 19 | Content nits (typo, stale comment, no-op `draft` field, unsourced metric) | Low | Open — recommend filing |

**Recommended next step:** review this PR, file whichever of 11–19 (and 15
in place of 10) you want tracked, and close PR #245 without merging — this
PR independently re-derives everything #245 reported plus three more weeks
of findings, so #245 is now redundant.
