---
name: new-issue
description: Create a well-formed GitHub issue for the will-maness-site repo. Use when the user wants to file a new issue, bug report, feature request, or chore ticket.
---

# New Issue

**Scope:** Create a single GitHub issue from scratch — when the user describes one specific thing to build, fix, or clean up.

**Not this skill:** If the user has a PRD, spec, or multi-part plan that needs to be broken into several issues, use `to-issues` instead.

---

Repo: `williamkmaness-source/will-maness-site`

## Issue types

| Type | When to use | Label |
|------|-------------|-------|
| `feat` | New feature or capability | `enhancement` |
| `fix` | Bug or broken behavior | `bug` |
| `chore` | Maintenance, cleanup, config, migrations | *(none — no chore label exists)* |
| `docs` | Documentation only | `documentation` |
| `perf` | Performance improvement | `enhancement` |
| `refactor` | Code restructure, no behavior change | *(none)* |
| `test` | Adding or fixing tests only | *(none)* |

## Scope values

Use the feature area slug as the scope. Common values: `ember`, `vendor-feed`, `pipeline`, `chess`, `311`, `vienna`, `stellar`. Omit scope for site-wide `chore`, `docs`, or `test` changes.

## Title format

```
type(scope): brief imperative description
```

- All lowercase
- Imperative mood ("add", "fix", "remove", not "added", "fixes", "removes")
- No period at the end
- Scope is optional for `chore`, `docs`, `test`

Examples:
- `feat(ember): add precipitation and wind gusts to county conditions`
- `fix(pipeline): remove stale chess card from dashboard`
- `chore: delete orphaned will-maness-site Vercel project`
- `docs: add architecture reference HTML for each project`

---

## Process

### 1. Gather context

Work from whatever the user has described. If they reference an existing issue or file, read it. If the scope is unclear, ask before drafting.

### 2. Classify the issue

Determine the type and scope from context. When ambiguous, ask one focused question — don't ask for information you can infer.

### 3. Select and fill the template

Choose the right template based on type (see below). Fill every section. Do not leave placeholder text.

### 4. Review with the user

Present the full draft — title, labels, and body. Ask for approval or edits before filing. Show the draft in a code block so the formatting is visible.

### 5. File the issue

Once approved:

```bash
gh issue create \
  --repo williamkmaness-source/will-maness-site \
  --title "type(scope): description" \
  --label "label" \
  --body "$(cat <<'EOF'
<body here>
EOF
)"
```

Report the issue URL when done.

---

## Templates

### Feature (`feat`, `perf`)

```markdown
## Summary

One to two sentences. What is being added and why it matters.

## Motivation

Why now? What user need or system gap does this address?

## Proposed Solution

What to build. For multi-layer changes, use numbered subsections by file or layer (e.g., `### 1. weather-client.ts`). Describe end-to-end behavior, not implementation minutiae.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Files to Touch

- `src/path/to/file.ts` — what changes here

## Blocked by

- #N — brief reason
Or: None — can start immediately.

## Notes

Gotchas, out-of-scope items, follow-up issues, or open questions.
```

### Bug (`fix`)

```markdown
## Problem

What's broken. Include current behavior vs. expected behavior.

## Root Cause

If known, explain the cause. If unknown, omit this section.

## Fix

What needs to change to resolve the bug.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Files to Touch

- `src/path/to/file.ts` — what changes here

## Blocked by

None — can start immediately.

## Notes

Anything that might complicate the fix or suggest a follow-up.
```

### Chore / Refactor / Test (`chore`, `refactor`, `test`)

```markdown
## Summary

What this chore/refactor/test covers and why it's needed.

## Steps

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Why this matters

One sentence explaining the risk of not doing it.

## Blocked by

None — can start immediately.
```

### Docs (`docs`)

```markdown
## Summary

What documentation is being added or changed and why.

## Deliverables

- [ ] Deliverable 1
- [ ] Deliverable 2

## Notes

Audience, format constraints, or cross-references to keep in sync.
```

---

## Quality checklist (run before filing)

- [ ] Title is `type(scope): description` — lowercase, imperative, no period
- [ ] Scope matches a known feature area or is intentionally omitted
- [ ] Every acceptance criterion is an independently verifiable checkbox
- [ ] "Blocked by" is present (even if "None")
- [ ] No placeholder text remains in the body
- [ ] Label matches the type (or explicitly noted as unlabeled)
