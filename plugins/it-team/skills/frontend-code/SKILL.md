---
name: frontend-code
description: The frontend code rules of the team - one component per file, explicit variants instead of mode props, logic outside JSX, TypeScript states as discriminated unions, Next.js Server Components by default with client leaves, tokens instead of arbitrary values, comments that say why, and the self-check before return. Use when writing, fixing, or reviewing React/Next.js/TypeScript code in a team project.
---

# Frontend code

These rules win over `it-team:react-patterns`, `it-team:react-performance`, and habit. Code
reviewers get this file: a violation is **MAJOR**, not polish. The pixel match comes from tokens
and primitives (`it-team:design-system-first`); the structure comes from here, and neither is
traded for the other.

**Scope: the lines your story adds or changes.** Code you write new, or a component you rewrite,
follows every rule. A violation that was already in a file you touch stays as it is: do not fix
it in this story, list it once in the Log as `Legacy: <file> — <rule> ×<count>` for the hardening
story.

Sources adapted: Vercel Labs `react-best-practices` and `composition-patterns` (MIT; rule IDs in
brackets), the pilots' code reviews.

## 1. Files and components
1. **One component per file.** Any function that returns JSX is a component, private helpers
   too. A second component goes into its own file in the same `ui/` segment. Exceptions: shadcn
   primitives in `shared/ui` (`Card`, `CardHeader` stay together) and test files.
2. **Never define a component inside another component**: it remounts on every render and loses
   state [rerender-no-inline-components].
3. File named after its component in the project's file-case convention; named exports only
   (Next route files such as `page.tsx` and `layout.tsx` keep their default export).
4. **Split** at two responsibilities (shaping data and laying it out, two cards) or ~150 lines.
5. **Explicit variants, not modes.** No `variant`/boolean prop that switches the structure or
   most of the classes. Build the shared content once and one small component per variant that
   wraps it [patterns-explicit-variants, architecture-avoid-boolean-props]. A style-only variant
   of a primitive is a `cva` variant in `shared/ui`. `children` over `renderX` props.
   ```tsx
   // ✗ one component, two layouts behind a mode
   <ReceivingAddress variant="inset" /> // every className: inset ? '…' : '…'
   // ✓ receiving-address-lines.tsx renders the content; two wrappers place it
   <ReceivingAddressInset order={order} />   <ReceivingAddressCard order={order} />
   ```

## 2. Logic lives outside JSX
1. A component body holds hooks, one-line derivations, and JSX. A branch on data, string
   assembly, mapping, or a calculation goes into a **pure function** in the slice's `lib/`
   (`model/` when it is domain logic) **with a unit test**. It takes data (and `t` when it
   returns text) and returns what the JSX prints.
   ```ts
   // lib/receiving-address.ts — tested on courier, pickup, no apartment, no floor
   export function receivingAddressLines(order: Order, t: Translate): string[] { … }
   ```
2. **One condition, one name.** Compute `const pickup = …` once and use it everywhere; two
   spellings of the same check drift apart.
3. Derive during render; no `useEffect` to derive state or fetch; interaction logic goes into
   event handlers [rerender-derived-state-no-effect, rerender-move-effect-to-event].
4. Server state lives in TanStack Query (SPA) or is fetched in a Server Component (Next) — never
   copied into `useState` or Zustand.

## 3. TypeScript
1. Types come from the shared Zod schemas (`z.infer`); never re-declare an API shape.
2. **Illegal states are unrepresentable.** Model variants as discriminated unions:
   ```ts
   // ✗ fulfillment: 'courier' | 'pickup'; address: Address | null  → courier without address?
   // ✓ { fulfillment: 'courier'; address: Address } | { fulfillment: 'pickup' }
   ```
   A contract that allows an illegal state is not patched with null checks across the UI: write
   the union to the Log as a request to the backend engineer and, until it lands, narrow once in a
   `lib/` mapper that returns the union.
3. Narrow with `switch` on the discriminant; exhaustiveness is linted, so no `default` that
   swallows a new member.
4. No `any`, no `as` (only `as const`), no enums (string unions from Zod); `satisfies` for config
   objects; non-null `!` only with a comment proving it.
5. Optional props only where absence means something; a named `type <Name>Props` per component.

## 4. Next.js: server and client
1. **Server Component by default.** `'use client'` only in a file that needs state, effects,
   event handlers, refs, or browser APIs, and that file is a leaf. Translations, formatting,
   `next/image`, and links do not need the client: next-intl `useTranslations` works in a
   non-async Server Component, `getTranslations` in an async one.
2. **Push the boundary down:** a server card with a small client island (`<CopyOrderNumber>`),
   not a client card.
3. Server → client props are serializable and minimal: pass the fields the island uses, not the
   whole entity [server-serialization]. Never import a Server Component into a client file;
   pass it as `children`.
4. `params` and `searchParams` are Promises (await them). Independent fetches run in
   `Promise.all`; slow parts stream behind `<Suspense>`; `React.cache` dedupes a request's
   fetches [async-parallel, async-suspense-boundaries, server-cache-react].
5. Server Actions live in their own `'use server'` file and authenticate and Zod-validate inside:
   each one is a public endpoint [server-auth-actions]. Server-only modules
   `import 'server-only'`.
6. No mutable module-level state on the server: it is shared across requests
   [server-no-shared-module-state].
7. Vite SPA: the same minus RSC — queries and mutations as hooks in `model/`, routes lazy-loaded.

## 5. React
1. `key` from ids, never the array index of a dynamic list.
2. `cond ? <X /> : null`, not `count && <X />` when the value can be `0`
   [rendering-conditional-render].
3. No `memo`/`useMemo`/`useCallback` by reflex (React Compiler); measure first
   (`it-team:react-performance`).
4. React 19: `ref` is a prop (no `forwardRef`); `use(Context)`. Context only for dependency
   injection and compound components [react19-no-forwardref].

## 6. Styling
1. Tokens and primitives only. **No arbitrary values** (`p-[22px]`, `text-[13px]`, `h-[74px]`):
   a drawn value outside the scale is a design question with the nearest token as your default
   in the Log. Lint flags them outside `shared/ui`; shape values such as `grid-cols-[auto_1fr]`
   are fine. Tailwind v4 spacing is a multiple of `--spacing` (4px by default): `p-[22px]` is
   `p-5.5`, `gap-[3px]` is `gap-0.75`; a font size needs a token.
2. `cn()` merges the caller's `className`. A class string built from ternaries over several
   lines is a variant component or a `cva` variant (§ 1.5).

## 7. Comments
1. Comment **why**, never what the JSX already says. An exported component may have one line on
   its purpose.
2. Never in code: design-file references (`OrderSuccess.html 72-87`), story, decision, bug, or
   polish IDs (`S-014`, `D-33`, `PF-07`), pixel notes. They go into the story Log. An ADR
   (`ADR-007`) may be named in a why-comment — it outlives the story.

## Self-check before you return
Over the lines you added or changed, one command per check:
1. One component per file (§ 1.1–1.2) — read each new file's top-level functions; in an old file,
   only the components you added.
2. Arbitrary values: `git diff -U0 -- <files> | grep -E '^\+' | grep -E -- '-\[-?[0-9.]+(px|rem|em|%)?\]'`
   (new files: `grep -nE` on the file).
3. Process traces: `git diff -U0 -- <files> | grep -E '^\+' | grep -E '\.html|\b(S|D|PF|B|US)-[0-9]'`.
4. Each `'use client'`: name the hook, handler, or browser API that needs it, or remove it.
5. Logic in a component body (§ 2), a condition spelled twice, a nullable field that is really a
   variant (§ 3.2).

Return line: `Guide: ok`, or `Guide: <rule> <file> — <why it stays>` per deviation in your own
lines; then `Legacy: <n> logged` or `Legacy: none`.
