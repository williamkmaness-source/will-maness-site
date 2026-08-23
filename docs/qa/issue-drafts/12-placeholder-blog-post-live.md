---
title: "fix(writing): finish or unpublish the placeholder 'data moat' essay"
labels: bug, content, high-priority
---

## Problem

`content/writing/where-the-data-moat-lives.mdx` has a full title, dek, and
"9 min read" label — everything needed to look finished in every list view
— but the entire body is:

```mdx
{/* Full essay coming in Phase 1 — Will is writing this. */}

Placeholder — full essay coming soon.
```

It's dated 2026-04-01, older than the two fully-written posts (both May
2026), so this shipped incomplete and has sat that way for over four
months. It's reachable in one click from the homepage's "Recent writing,"
from `/writing`, and its title/dek are syndicated in full in `/feed.xml`
and `/sitemap.xml`.

The site's stated premise is proving writing credibility alongside
technical credibility. A visitor who clicks a compelling title and gets one
placeholder sentence reads as abandoned or careless.

## Root Cause

Content shipped before the essay was written, with no gate (draft flag,
build check) preventing an incomplete post from appearing in production
lists/feeds. (Related, smaller issue: `writingSchema` doesn't even define a
`draft` field, so there's no mechanism to hide a post like this even if one
were set — see the "content nits" draft in this same pass.)

## Fix

Either finish the essay, or remove it from `content/writing/` (and
therefore from the feed/sitemap/lists) until it's ready.

## Acceptance Criteria

- [ ] `where-the-data-moat-lives.mdx` either contains the finished essay, or
      is removed from `content/writing/` entirely
- [ ] `/feed.xml` and `/sitemap.xml` no longer reference an unfinished post
- [ ] Homepage "Recent writing" and `/writing` no longer link to a
      placeholder

## Files to Touch

- `content/writing/where-the-data-moat-lives.mdx`

## Blocked by

None — can start immediately (though the "finish it" path depends on Will
actually writing the essay, not code work).

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 12).
