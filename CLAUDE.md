@AGENTS.md

# project_website — Workstation Instructions

## Identity

This workstation is Will's personal website (willmaness.com) — a Next.js app designed to demonstrate technical fluency to VP-of-Product hiring managers at AI-infrastructure and data-tooling companies. The site is the primary artifact proving technical chops; it must feel considered, current, and human — not templated. Work routes here for site scaffolding, components, content integration, and deployment. Does NOT route here for writing blog posts (project_blogs) or for building the embedded apps themselves (project_311, project_vienna).

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
