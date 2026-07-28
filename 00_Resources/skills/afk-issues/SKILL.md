---
name: afk-issues
description: Autonomously review and resolve open GitHub issues with no human-in-the-loop. Fetches issues, prioritizes by completability, groups by component overlap, implements fixes on a branch, and opens a PR. Use when the user says "afk issues", "work through issues", or wants autonomous issue resolution.
model: opus
---

# AFK Issues — Autonomous Issue Resolution

**Scope:** Fetch open issues from a GitHub repo, triage them by autonomous completability, group related ones, implement fixes, and open a PR — all without asking for human input mid-run.

**Not this skill:** Filing new issues from scratch (use `new-issue`), reviewing open PRs (use `qa-routine`), or any work requiring design decisions, external credentials, or ambiguous requirements.

---

## Model requirement

This skill must run on **Opus High**. Before doing anything else: if the current model is not Opus, spawn the full workflow as a subagent using the Agent tool with `model: "opus"`, passing the repo and all context. Do not proceed in-conversation on a non-Opus model.

---

## Safety rules

- **Never merge a PR.** Open it and stop.
- **Never commit or push to `main` or the default branch.** Run `git branch --show-current` before every commit and abort if you're on the default branch.
- **Never approve reviews, modify branch protection rules, or take any action outside of code changes and PR creation.**
- **Stop on ambiguity.** The moment an issue requires a decision you cannot make autonomously, leave a comment on it explaining the blocker and move on to the next issue.

---

## Workflow

### 1. Confirm the target repo

If the user did not provide a GitHub repo, ask for it now before doing anything else. All subsequent steps depend on this.

### 2. Fetch open issues

```bash
gh issue list --repo <owner/repo> --state open --limit 100 --json number,title,body,labels,assignees
```

If there are no open issues, report that and exit.

### 3. Prioritize by autonomous completability

Score each issue and sort descending. Skip anything that scores 0.

| Score | Category |
|-------|----------|
| 4 | Self-contained bug — clear reproduction, fix is localizable to a small surface area |
| 3 | Well-specified feature — explicit, complete acceptance criteria, no design decisions needed |
| 2 | Dependency / config update — version bump, lockfile, env fix |
| 1 | Refactor / cleanup — low risk, no behavior change |
| 0 | **Skip** — requires design decisions, external credentials, ambiguous spec, or human judgment |

For any issue scored 0, leave a comment and move on:

```bash
gh issue comment <number> --repo <owner/repo> --body "Skipping in AFK pass — this issue requires [specific blocking reason] before it can be resolved autonomously."
```

### 4. Group by component overlap

Before touching any code, scan all qualifying issues (score ≥ 1) and group them:

- Two issues touch the same file or module → same group
- One issue is a prerequisite for another → same group
- No overlap with any other → solo group

Aim to combine related issues into one branch and PR. Only split into separate branches when there is no meaningful overlap.

Identify and record which issues belong to each group, then select the **single highest-priority group** (by the highest score of any issue in the group) to work on. State your grouping and selection clearly before writing any code.

### 5. Confirm all issues in the selected group are self-contained

Re-read the full body of every issue in the group. If any issue in the group turns out to require a decision you cannot make autonomously, pull it from the group (leave a blocking comment on it) and re-evaluate whether the remaining issues still form a coherent group.

### 6. Set up a branch

Name the branch using the pattern:

- `fix/<issue-numbers>-<shared-slug>` for bugs/refactors (e.g. `fix/12-14-nav-layout`)
- `feat/<issue-numbers>-<shared-slug>` for features (e.g. `feat/22-dark-mode-toggle`)

```bash
git checkout <default-branch>
git pull
git checkout -b fix/<issue-numbers>-<slug>
```

### 7. Implement the fixes

Work through each issue in the group in dependency order (prerequisites first). For each:

- Read every referenced file before making changes
- Make only the changes needed to close that specific issue — nothing more
- Commit after each issue is resolved:

```bash
git branch --show-current   # must NOT be the default branch — abort if it is
git add <specific files>
git commit -m "fix(scope): <imperative description> (closes #<n>)"
```

### 8. Run tests and linting

After all fixes are committed, run the repo's standard checks. Look for a `package.json`, `Makefile`, or CI config to discover what the test/lint commands are. Common patterns:

```bash
pnpm test        # or npm test / make test
pnpm exec tsc --noEmit
pnpm lint
```

If any check fails due to your changes, diagnose and fix before pushing. Do not push with failing checks. If a pre-existing failure is unrelated to your changes, note it in the PR description but do not fix it.

### 9. Push and open a PR

```bash
git push -u origin <branch-name>
```

Then open one PR against the default branch:

```bash
gh pr create \
  --repo <owner/repo> \
  --base <default-branch> \
  --title "<type>: <shared description> (<issue-numbers>)" \
  --body "$(cat <<'EOF'
## Issues closed

- Closes #<n> — <one-line description>
- Closes #<m> — <one-line description>

## What changed

<Per-issue summary of what was changed and why. One short paragraph per issue.>

## Uncertainty / left for human review

<Anything you were uncertain about, any edge case you did not cover, or any follow-on work that became visible during implementation. Omit section if nothing to flag.>

## Checks

- [ ] Tests pass
- [ ] Type-check passes
- [ ] Lint passes
EOF
)"
```

Report the PR URL when done.

### 10. Report back

Summarize what was done:

- Issues worked: list with title and number
- Issues skipped: list with title, number, and blocking reason
- PR opened: link
- Groups not started: note that they were identified but not actioned this run

---

## Output format (end-of-run summary)

```markdown
## AFK Issues — Run Summary

**Repo:** owner/repo
**Issues scanned:** N
**Issues worked:** N
**Issues skipped:** N

### Worked

- #N — <title> (group with #M)
- #M — <title> (group with #N)

### Skipped

- #P — <title> — blocked by: <reason>
- #Q — <title> — blocked by: <reason>

### PR opened

<PR URL>

### Groups identified but not started

- Group 2: #R, #S — <shared slug> (next highest priority)
```
