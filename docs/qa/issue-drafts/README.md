# QA issue drafts — 2026-07-11 (re-confirmed 2026-07-18, 07-25, 08-01)

Draft GitHub issues from the hiring-manager QA passes in `docs/qa/`. Nothing
here has been filed as a real issue unless noted below — review and approve
in the originating PR first, then file whichever ones you want tracked
(title/labels are in each file's frontmatter, ready to copy into
`gh issue create` or the GitHub UI).

**2026-08-01 update:** all 8 findings from the original 07-11 pass (01–08)
are now fixed and merged (#234–#241) — see
`docs/qa/2026-08-01-hiring-manager-qa.md` for the re-verification against
today's `main`. They're kept here for the record with a `RESOLVED` note each;
none need to be filed. One new finding this pass: 10, a content/code
mismatch on the Pipeline Dashboard page — the one item from this round
actually worth filing.

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
| 10 | Pipeline Dashboard's copy describes chess tracking it doesn't do | Medium | **Open — recommend filing** |
