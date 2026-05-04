# Phase 0 Quiz

Answer these before moving to Phase 1. They're not gotchas — they're a check on whether the foundation makes sense to you before we build on top of it. Write your answers below each question, then we'll go through the ones you got wrong.

---

**Q1.** You open `src/app/work/page.tsx` and notice it exists. Without running the dev server, what URL will this file be available at, and why does the file path determine the URL?

*Your answer:*

---

**Q2.** The `Nav` component has `"use client"` at the top. The `Footer` component does not. What does that difference mean in practice — what can `Nav` do that `Footer` can't, and what does `Footer` get in return?

*Your answer:*

---

**Q3.** You want to add a new project to the site. List the exact steps: which file do you create, where does it go, and what happens in the browser without any other code changes?

*Your answer:*

---

**Q4.** `globals.css` has both a `:root` block and an `@theme inline` block. They both define `--accent` and `--color-accent`. Why are there two? When would you use `var(--accent)` vs `className="text-accent"`?

*Your answer:*

---

**Q5.** Where does Newsreader (the serif font) actually come from at runtime — does the browser fetch it from Google? How is it loaded, and where in the code does that happen?

*Your answer:*

---

**Q6.** You add a new field `client: z.string()` to `projectSchema` in `content-schemas.ts` but forget to add `client: "Acme Corp"` to one of the existing project MDX files. What happens when you run `pnpm build`, and where exactly does the error come from?

*Your answer:*

---

**Q7.** The brief says "no hardcoded human copy in components." The `Footer` component has `"Will Maness · Boston"` hardcoded in it. Is this a violation? Why or why not — and if it is, what would the fix look like?

*Your answer:*

---

*Answers and discussion in the next session.*
