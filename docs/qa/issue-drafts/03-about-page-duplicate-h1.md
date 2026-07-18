---
title: "About page renders two `<h1>` elements"
labels: bug, accessibility, content
---

## Problem

`content/site.mdx`'s bio text ends with a line that's literal Markdown
heading syntax, apparently by accident:

```
# If you've come from an outreach email of mine: thank you for actually clicking through. ...
```

`mdx-components.tsx` registers styled overrides for `h2`, `p`, `blockquote`,
`code`, `pre`, and `a` — but not `h1`. Combined with Tailwind's preflight
reset (which removes default browser heading sizing), this renders with no
visually distinguishing style, so it silently passes visual QA. But it is a
real second `<h1>` in the DOM:

```html
<h1 class="font-serif text-[42px] font-medium ...">About</h1>
...
<h1>If you've come from an outreach email of mine: thank you for actually click...</h1>
```

Verified via:

```
$ curl -s http://localhost:3000/about | grep -o '<h1[^>]*>.\{0,80\}'
<h1 class="font-serif text-[42px] ...">About</h1>...
<h1>If you&#x27;ve come from an outreach email of mine: thank you for actually click
```

Two `<h1>`s on one page is an accessibility smell (screen readers use `<h1>`
to orient users to the page's primary topic) and a minor SEO smell (search
engines use `<h1>` as a strong topical signal). Practically, it's a sign the
sentence was authored as a heading unintentionally — it reads as a normal
paragraph everywhere else in the same block.

**Update (2026-07-18 re-check):** still reproduces — `content/site.mdx` is
unchanged since the original report, `mdx-components.tsx` still has no `h1`
override.

## Suggested fix

In `content/site.mdx`, change the leading `#` to plain text, or wrap the
sentence in a `>` blockquote (already has a styled treatment via
`mdx-components.tsx`) if the intent was to set it apart visually.

## Repro

1. `pnpm dev` (or production build)
2. `curl -s http://localhost:3000/about | grep -o '<h1[^>]*>.\{0,80\}'`
3. Observe two `<h1>` matches
