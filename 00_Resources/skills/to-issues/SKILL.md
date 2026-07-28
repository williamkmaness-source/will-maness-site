---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tickets, or break down work into issues.
---

# To Issues

**Scope:** Decompose a PRD, spec, or multi-part plan into a set of independently-shippable GitHub issues for `williamkmaness-source/will-maness-site`.

**Not this skill:** If the user describes a single thing to build, fix, or clean up — use `new-issue` instead.

---

Before publishing any issue, read `00_Resources/skills/new-issue/SKILL.md` in full. All title format, scope values, type→label mapping, body templates, and the quality checklist defined there apply to every issue filed by this skill.

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user passes an issue number, URL, or file path, read its full body before proceeding.

### 2. Explore the codebase (optional)

If the plan touches code you haven't seen, read the relevant files. Issue descriptions should use the project's actual file paths and domain vocabulary, not generic placeholders.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues — thin vertical slices that each cut through ALL layers end-to-end (schema, API, UI, tests), not horizontal slices of a single layer.

Classify each slice as:
- **AFK** — can be implemented and merged without human input; prefer these
- **HITL** — requires a human decision (architecture choice, design review, external coordination) before or during implementation

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through every layer
- A completed slice is independently demoable or verifiable
- Prefer many thin slices over few thick ones
- Each slice gets its own `type(scope):` title — slices in the same plan may have different types (e.g., one `feat`, one `chore`)
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice show:

- **Title**: `type(scope): description` (follow `new-issue` title format)
- **Type**: AFK or HITL
- **Blocked by**: which earlier slices must ship first
- **User stories covered**: if the source material has them

Ask:
- Does the granularity feel right?
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are HITL/AFK classifications right?

Iterate until the user approves the breakdown.

### 5. Publish in dependency order

File slices in dependency order (blockers first) so real issue numbers are available for "Blocked by" references.

For each slice:
1. Determine its `type` and select the matching body template from `new-issue/SKILL.md`
2. Fill every section — no placeholder text
3. Run the quality checklist from `new-issue/SKILL.md`
4. Apply the type label (per `new-issue` type→label table). Do NOT apply `needs-triage`.
5. If the source was an existing issue, add a `## Parent` section at the top of the body referencing it. Do NOT close or modify the parent issue.

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

Report each issue URL as it's created, and summarize the full dependency graph when done.
