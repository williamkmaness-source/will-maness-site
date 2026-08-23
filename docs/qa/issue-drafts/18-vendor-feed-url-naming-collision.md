---
title: "chore: rename /work/vendor_feed to avoid one-character URL collision"
labels: chore, low-priority
---

## Summary

Two live, public routes differ by exactly one character — a hyphen versus
an underscore — for related but different things: `/work/vendor-feed` is
the MDX-driven project narrative; `/work/vendor_feed` is the standalone
live dashboard (kept, not deleted, per the fix for draft 01). Both are real
and easy to mistype into each other, and now that `vendor_feed` is staying
long-term rather than being a soon-to-be-deleted legacy route, the
naming collision is worth resolving on its own.

## Steps

- [ ] Rename `/work/vendor_feed` to something unambiguous (e.g.
      `/work/vendor-feed/live` or `/vendor-feed-dashboard`)
- [ ] Update any internal links/references to the old path
- [ ] Confirm the old path either 301-redirects or intentionally 404s (per
      whatever the team prefers for a renamed internal route)

## Why this matters

A one-character difference between two live URLs for related-but-distinct
content is an easy source of confusion for anyone bookmarking, sharing, or
typing the URL from memory.

## Blocked by

None — can start immediately (independent of draft 01/15's fixes, though
sequencing after them avoids touching the same file twice).

## Notes

Found in the 2026-08-23 QA pass (`docs/qa/2026-08-23-hiring-manager-qa.md`,
finding 18).
