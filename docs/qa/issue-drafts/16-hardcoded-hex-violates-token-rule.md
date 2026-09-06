---
title: "chore(tokens): add a warning/yellow token, remove hardcoded hex"
labels: chore, polish, low-priority
---

## Summary

`CLAUDE.md`'s workflow section states: "Tokens are the single source of
truth — no raw hex in components, no magic numbers." Status colors mostly
follow this (`var(--accent)` for success, `var(--clay)` for failure), but
the in-progress/warning yellow is hardcoded raw hex, absent from the token
system entirely:

- `src/components/projects/boston-civic-data/DepartmentCard.tsx:16,22` —
  `yellow: "#C49A2A"` / `"#F5EDD4"`
- Same pattern in `StackList.tsx` and `GameModal.tsx`

The repo is public specifically to demonstrate disciplined engineering
practice — a reviewer who reads `CLAUDE.md` and greps the codebase will find
the rule broken in the first component that needs a third status color.

## Steps

- [ ] Add a `warning`/`yellow` token pair to `src/lib/tokens.ts`, matching
      the existing accent/clay pattern (both the CSS variable and the
      TypeScript constant)
- [ ] Replace the hardcoded hex in `DepartmentCard.tsx`, `StackList.tsx`,
      and `GameModal.tsx` with the new token
- [ ] Grep the rest of `src/components/` for any other raw hex to catch
      what this pass didn't

## Why this matters

The project's own contributor instructions state this rule explicitly;
leaving it broken undercuts the credibility signal the public repo is meant
to send.

## Blocked by

None — can start immediately.

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 16).

**Update (2026-08-30 re-check): still reproduces.** `DepartmentCard.tsx:16,22` still hardcode `#C49A2A` / `#F5EDD4` outside the token system. Confirmed via grep against today's `main`.

**Update (2026-09-06 re-check): still reproduces in `DepartmentCard.tsx`.**
Confirmed via grep against today's `main`. Note: this pass could not find
the same literal `#C49A2A`/`#F5EDD4` pair in `StackList.tsx` or
`GameModal.tsx` as originally stated — worth double-checking those two
files specifically when this is filed, though the core finding (no
warning/yellow token exists) holds regardless.
