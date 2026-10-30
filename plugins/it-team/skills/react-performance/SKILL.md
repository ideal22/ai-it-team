---
name: react-performance
description: React 19 perf rules - waterfalls, bundle size, re-renders, rendering, React Compiler, Next.js server perf. Use when diagnosing slow loads/interactions or reviewing React code for performance.
---

# React Performance

Prioritized performance rules for React 19.2 (Vite or Next.js App Router 15+). Derived from Vercel
Labs `react-best-practices` (MIT) and adapted to a TanStack Query + Zustand + FSD stack.

## When to Activate

- Slow page loads, slow interactions (INP), high client CPU, or Web Vitals regressions
- Bundle-size audits or a new heavy dependency
- Re-render storms, long lists, janky animations, hydration issues
- Reviewing PRs that touch data loading, routing, or hot UI paths

**Measure first.** Use React DevTools Profiler, the browser Performance panel, and a bundle
visualizer before changing code. Optimizations without a measurement are guesses.

## Priority Index

| Priority | Category | When it matters |
|---|---|---|
| 1 - CRITICAL | Waterfalls | Sequential `await`s / dependent queries |
| 2 - CRITICAL | Bundle size | First-load JS, route imports, third-party libs |
| 3 - HIGH | Client data fetching | TanStack Query usage, listeners, storage |
| 4 - MEDIUM | Re-renders | High-frequency state, store subscriptions |
| 5 - MEDIUM | Rendering | Long lists, animations, hydration |
| 6 - LOW-MEDIUM | JS micro-perf | Hot loops, allocations |
| 7 - HIGH (Next.js) | Server-side | RSC, Server Actions, SSR |

## React Compiler First

React Compiler 1.0 is stable. It is **opt-in** via `babel-plugin-react-compiler` (with
`@vitejs/plugin-react`'s Babel pipeline on Vite, or `reactCompiler: true` in Next.js config).

- With the compiler enabled: do **not** add manual `useMemo` / `useCallback` / `React.memo`.
  They are noise; keep only ones a profile proves are still needed.
- Without the compiler: memoize only when profiled, or when object identity feeds a memoized
  child or an effect dependency.
- The compiler assumes the Rules of React; enable `eslint-plugin-react-hooks` (recommended preset)
  to catch violations that make it bail out.

## 1. Eliminating Waterfalls (CRITICAL)

```ts
// INCORRECT - sequential
const user = await getUser(id);
const posts = await getPosts(id);

// CORRECT - parallel
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);

// Partial dependency - start early, await late
const postsP = getPosts(id);
const profile = await getProfile(id);
if (profile.isPrivate) return null;
const posts2 = await postsP;
```

- Check cheap sync conditions before awaiting remote data; move `await` into the branch that uses it
- Client: avoid parent/child query waterfalls. Hoist queries to the route, use
  `useQueries` / `useSuspenseQueries`, or prefetch in a router loader
  (`queryClient.ensureQueryData(...)`)
- Put `<Suspense>` close to the data so fast parts paint first; reserve space to avoid CLS

## 2. Bundle Size (CRITICAL)

### Barrels: FSD-compatible rule

- **Slice public-API barrels are required** (`@/entities/expense`, `@/features/add-expense`).
  Keep them small: export only the slice's public surface.
- **Avoid giant re-export barrels** inside `shared/ui` (import `@/shared/ui/button`, not a
  re-export-everything index) and for third-party icon libs (import individual icons, or use
  Next's `optimizePackageImports`).
- Mark packages side-effect free (`"sideEffects": false` or a list) so tree-shaking works.

### Code splitting

```tsx
import { lazy, Suspense } from "react";

const SpendingChart = lazy(() => import("@/widgets/spending-chart"));

<Suspense fallback={<ChartSkeleton />}>
  <SpendingChart month={month} />
</Suspense>;
```

- Split at routes first (React Router `lazy`, Next.js automatic per-route)
- Keep dynamic import paths statically analyzable (`import("./a")`, not template strings)
- Load admin-only / rarely used modules conditionally; preload on hover/focus for intent
- Defer analytics and support widgets until after the app is interactive

## 3. Client-Side Data Fetching (MEDIUM-HIGH)

- All server state through TanStack Query; multiple `useQuery` calls with the same key share one
  request and cache entry. Never roll `useEffect` + `fetch`.
- Set a sensible `staleTime` (default `0` refetches aggressively on mount/focus)
- Use `select` to subscribe to a slice of the data and cut re-renders
- Prefer `placeholderData: keepPreviousData` for paginated lists to avoid flashes
- One shared global listener (scroll/resize) per app, `{ passive: true }` for scroll/touch
- `localStorage` is synchronous: read once, cache, store a `version` field, keep payloads small

## 4. Re-render Optimization (MEDIUM)

### Zustand selectors

```ts
// INCORRECT - re-renders on any cart change
const cart = useCartStore((s) => s.cart);
const hasItems = cart.length > 0;

// CORRECT - re-renders only when the boolean flips
const hasItems = useCartStore((s) => s.cart.length > 0);

// Multiple fields: useShallow to avoid new-object-per-render
import { useShallow } from "zustand/react/shallow";
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })));

// Value only needed inside a handler: read on demand, don't subscribe
const onSave = () => save(useCartStore.getState().cart);
```

### Rules

- Derive during render; never `useEffect(() => setX(f(y)), [y])`
- Never define components inside components (new type each render remounts the subtree)
- Primitive effect dependencies (`[id, name]`, not `[{ id, name }]`)
- Hoist default non-primitive props to module scope (`const EMPTY: readonly Item[] = []`)
- Lazy initializer for expensive initial state: `useState(() => parse(input))`
- Push state down to the component that uses it; split Context by concern (Context is for DI)
- `useTransition` / `startTransition` for non-urgent updates; `useDeferredValue` for expensive
  renders driven by fast input
- `useRef` for frequently changing values that should not render

### Stable callbacks inside effects: `useEffectEvent`

`useEffectEvent` (stable in React 19.2) reads the latest props/state without re-running the
effect. It replaces the old "latest ref" pattern that wrote `ref.current` during render.

```tsx
import { useEffect, useEffectEvent } from "react";

function useBudgetSocket(budgetId: string, onAlert: (msg: string) => void) {
  const handleAlert = useEffectEvent((msg: string) => onAlert(msg));

  useEffect(() => {
    const ws = connect(budgetId);
    ws.on("alert", (msg: string) => handleAlert(msg));
    return () => ws.close();
  }, [budgetId]); // handleAlert is NOT a dependency
}
```

Only call effect events from inside effects; never pass them to children or call during render.

## 5. Rendering Performance (MEDIUM)

- Virtualize long lists (`@tanstack/react-virtual`) once rows are many and non-trivial
- `content-visibility: auto; contain-intrinsic-size: auto 80px;` for long static sections
- Animate `transform`/`opacity` on a wrapper, not layout properties or the SVG itself
- `<Activity mode="hidden">` (React 19.2) to keep hidden tabs mounted with state, instead of
  unmount/remount
- Ternary over `&&` with numbers: `{count > 0 ? <Badge /> : null}` (avoid rendering `0`)
- Reserve space for images/charts (explicit width/height or aspect-ratio) to prevent CLS
- React DOM resource hints: `preload`, `preconnect`, `prefetchDNS` from `react-dom`
- `suppressHydrationWarning` only on known-divergent leaf nodes (e.g. timestamps)
- Set theme/locale before hydration with a small inline script to avoid flicker

## 6. JavaScript Performance (LOW-MEDIUM)

- `Map`/`Set` for repeated lookups and membership, not `Array.find`/`includes` in loops
- Single pass instead of `filter().map()` chains on hot paths (`flatMap` or a loop)
- Loop for min/max instead of `sort()`; `toSorted()` when immutability matters
- Hoist `RegExp` and `Intl.NumberFormat`/`Intl.DateTimeFormat` instances out of loops and renders
  (cache formatters per locale in the money/date helpers)
- Early returns; check lengths before expensive comparisons
- `requestIdleCallback` / `scheduler.postTask` for non-critical work

## 7. Next.js (Server-Side, HIGH)

Applies only to Next.js App Router 15+.

- **Parallel through composition:** split sibling async Server Components so they fetch in
  parallel instead of awaiting sequentially in one component
- **`React.cache()`** dedupes the same call within one request
- **`next/dynamic`** for heavy client-only components (`ssr: false` only inside Client Components)
- **`next/script`** with `strategy="afterInteractive"` or `"lazyOnload"` for third-party scripts
- **`optimizePackageImports`** in `next.config` for icon and utility libraries
- **Authenticate every Server Action** like an API route; actions are public endpoints
- **No mutable module-level state** on the server - it is shared across requests/users
- **Minimize Client Component props**: serialize only fields the client needs
- **`after()`** from `next/server` for logging/analytics after the response is sent
- **`@next/bundle-analyzer`** to inspect first-load JS

## Web Vitals Mapping

| Metric | Most relevant sections |
|---|---|
| LCP | Waterfalls, Bundle size, resource hints |
| INP | Re-renders, Rendering, JS perf, transitions |
| CLS | Suspense placement, reserved dimensions |
| TBT | Bundle size, deferred third-party, JS perf |

## Review Checklist

- [ ] A profile or measurement motivates each optimization
- [ ] No manual memo when React Compiler is enabled (unless profiled)
- [ ] No sequential independent awaits / client query waterfalls
- [ ] Slice barrels are lean; no giant `shared/ui` or icon re-export barrels
- [ ] Heavy routes/widgets lazy-loaded; third-party scripts deferred
- [ ] Zustand selectors are narrow (or `useShallow`); Query uses `select`/`staleTime` deliberately
- [ ] `useEffectEvent` instead of render-time ref writes for latest-value callbacks
- [ ] Long lists virtualized; layout space reserved

Rules in this file derive from Vercel Labs `react-best-practices`
(https://github.com/vercel-labs/agent-skills, MIT License, copyright Vercel Engineering).

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
