---
name: qa-routine
description: Daily QA review of open PRs to the will-maness-site GitHub repo. Use when the user wants to review, fix, and push feedback on open PRs.
model: opus
---

# QA Routine

**Scope:** Review open PRs to `williamkmaness-source/will-maness-site`, implement mechanical fixes, and comment findings.

**Repo local path:** `/Users/viktor/Documents/will-maness-site`

**Not this skill:** Filing new issues for standalone bugs or features — use `new-issue` for that.

---

## Model requirement

This skill must run on **Opus High**. Before doing anything else: if the current model is not Opus, spawn the full workflow as a subagent using the Agent tool with `model: "opus"`, passing all PR context. Do not proceed in-conversation on a non-Opus model.

---

## Safety rules

- **Never commit or push to `main`.** Before any `git commit` or `git push`, run `git branch --show-current` and verify it is NOT `main`. If you are on `main`, stop and switch to the correct branch.
- **Fix mechanical issues autonomously.** Comment-only on design-level concerns, architectural choices, or anything requiring a product decision.

---

## Workflow

### 1. Check for open PRs

```bash
cd /Users/viktor/Documents/will-maness-site && gh pr list
```

If no open PRs exist, report that and exit. Do not proceed.

### 2. Clean the working tree

Before checking out any branch, ensure the working directory is clean:

```bash
git status --short
```

If there are uncommitted changes, stash them first:

```bash
git stash push -m "qa-routine pre-checkout stash"
```

### 3. For each open PR

**Skip if already reviewed.** Before checking out, check whether this skill has already posted a QA report on the PR:

```bash
gh pr view <number> --json comments --jq '[.comments[].body | startswith("## QA Report")] | any'
```

If the output is `true`, skip this PR and note it was already reviewed. Do not post a second report.

Otherwise, proceed:

```bash
gh pr checkout <number>
git diff main...HEAD
```

Review the full diff against all five areas below. Collect all findings before implementing any fix.

### 4. Implement mechanical fixes

Fix issues in these categories without asking:
- Wrong imports or missing exports
- Missing `export const dynamic = 'force-dynamic'` on DB-backed pages
- Inline `style=` overrides on Tailwind layout containers (convert to `className`)
- Unhandled promise rejections with no user-facing error
- Hardcoded values that belong in env vars
- `@ts-ignore` / `as any` casts that can be removed with a proper type

Do NOT autonomously fix:
- Component restructuring or naming
- Data model changes
- Anything that changes the PR's stated behavior

### 5. Verify

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm audit
```

If any check fails, diagnose and fix before committing. Do not push with failing checks.

### 6. Commit and push

```bash
git branch --show-current   # must NOT be main — abort if it is
git add <specific files>
git commit -m "fix: qa review fixes for PR #N"
git push
```

### 7. Comment on the PR

Post the structured report (format below) as a PR comment:

```bash
gh pr comment <number> --body "$(cat <<'EOF'
<report here>
EOF
)"
```

Post the comment even if no fixes were made. A clean report is useful signal.

---

## Review areas

### 1. Code quality & style
- Naming: camelCase frontend, snake_case backend
- Single responsibility: flag functions or components >~40 lines or with mixed concerns
- Duplicated logic that should be extracted
- `@ts-ignore`, `@ts-expect-error`, or `as any` casts in the diff

### 2. Test coverage
- New logic with zero new tests
- Tests covering only the happy path (missing nulls, empty inputs, error states)
- API route changes missing integration tests
- Frontend component changes missing render or interaction tests

### 3. Security
- User input not validated or sanitized (XSS, SQLi, command injection)
- Routes missing auth or authorization checks
- Hardcoded secrets, tokens, or credentials anywhere in the diff
- New dependencies — run `pnpm audit` to check for known CVEs

### 4. Performance
- N+1 query patterns in backend loops
- Missing memoization on expensive frontend computations or components
- Sequential `await` chains that could be `Promise.all`
- Whole-library imports where a single function would suffice

### 5. Functionality & correctness
- **Project-specific:** DB-backed Next.js pages missing `export const dynamic = 'force-dynamic'` (causes Vercel build-time prerender failure)
- **Project-specific:** Tailwind responsive prefixes broken by `style=` inline overrides on layout containers
- Changes that exceed the stated PR scope
- Off-by-one errors, wrong operators, or incorrectly mutated state
- API response shape changes not matched by frontend update (or vice versa)
- Unhandled errors, silent catch blocks, missing user-facing error messages

---

## Output format

```markdown
## QA Report — PR #N: <title>

**Risk level:** low / medium / high  
**Issues found:** N  
**Fixes committed:** yes / no

## Issues

**[Area] — Short title**
File: `path/to/file.ext`, line N
Problem: what is wrong and why it matters.
Fix: what was done or what should be done.

## Passed

- Code quality & style
- Test coverage
- ...
```
