@AGENTS.md

# project_website — Workstation Instructions

## Identity

This workstation is Will's personal website (willmaness.com) — a Next.js app designed to demonstrate technical fluency to VP-of-Product hiring managers at AI-infrastructure and data-tooling companies. The site is the primary artifact proving technical chops; it must feel considered, current, and human — not templated. Work routes here for site scaffolding, components, content integration, and deployment. Does NOT route here for writing blog posts (project_blogs) or for building the embedded apps themselves (project_311, project_vienna).

## Memory System

At the start of every session, read MEMORY.md before responding. Use what you find to inform your work. Don't announce what you found, just be informed by it.

When I say "remember this," write the information to MEMORY.md immediately and confirm you've done it.

**Where things go:** Apply two tests when deciding where to save something. Test 1: Does it prescribe behavior? Look for words like "always," "never," "before doing X, do Y." If yes, add it to this file (CLAUDE.md) under the appropriate section. Test 2: Does it describe a fact about the world that could change? Project status, decisions, things I've told you to remember. If yes, add it to MEMORY.md. When unsure, suggest which file you think it belongs in and ask me to confirm.

## Preferences

- Write in a professional but conversational tone. If it sounds like a corporate memo, rewrite it.
- Keep responses concise, under 300 words unless I ask for more detail.
- Use bullet points for lists, but write explanations in natural paragraphs.
- Give me one strong recommendation. Don't give me 3 options unless I specifically ask for alternatives.

## Rules

- Always ask clarifying questions before starting a complex task.
- If you're not sure about something, say so. Don't guess.
- When a skill trigger is matched, read the full skill file from `00_Resources/skills/` before responding.

## Resources

| Resource | Read when... |
| -------- | ------------ |
| `_spec/personal-site-plan.md` | Reviewing IA, tech stack rationale, or phased plan |
| `_spec/execution-brief.md` | Starting any build phase; this is the canonical build spec |
| `_spec/design-tokens.md` | Touching any color, typography, spacing, or radius value |
| `_spec/site-mockup.html` | Implementing or QA-ing the homepage |
| `_spec/site-project-page.html` | Implementing or QA-ing a project page |
| `_spec/site-about-page.html` | Implementing or QA-ing the about page |

## Workflow

1. Read the execution brief before starting any phase.
2. Tokens are the single source of truth — no raw hex in components, no magic numbers.
3. Every component gets a 2–4 line header comment. Update `docs/build-log.md` after every meaningful unit of work.
4. Default to server components. Use Framer Motion only where it earns its keep.
5. No hardcoded copy in components — all human-readable text lives in MDX or typed content files under `content/`.
6. Lighthouse 95+ on home, project page, and about page is a hard requirement.
7. After completing a phase, run the phase quiz in `docs/quizzes/`.

## Skills

| Skill file | Invoke when... |
| ---------- | -------------- |
| `00_Resources/skills/grill-me/SKILL.md` | I say "grill me" or want to stress-test a plan or design |
| `00_Resources/skills/to-prd/SKILL.md` | I say "convert to PRD" or want to create a PRD for a project |
| `00_Resources/skills/to-issues/SKILL.md` | I say "convert to issues" or want to turn a PRD into development tickets |
| `00_Resources/skills/new-issue/SKILL.md` | I want to file a single GitHub issue |
| `00_Resources/skills/afk-issues/SKILL.md` | I want autonomous triage of open GitHub issues |
| `00_Resources/skills/qa-routine/SKILL.md` | I want to run a QA pass before shipping |
| `00_Resources/skills/tdd/SKILL.md` | I want to build a feature test-first |
| `00_Resources/skills/improve-codebase-architecture/SKILL.md` | I want to review or deepen module/interface design |
