---
name: react-patterns
description: Idiomatic React 19 patterns - state placement, RSC/client boundaries, Suspense, forms, composition. Use when writing, refactoring, or reviewing React components, hooks, or component trees.
---

# React Patterns

Idiomatic React 19 patterns for a stack of TS strict, Vite or Next.js App Router 15+, Tailwind +
shadcn/Radix, TanStack Query v5, Zustand, React Hook Form + Zod, and Feature-Sliced Design (FSD).

## When to Activate

- Writing or modifying function components, custom hooks, or component trees
- Deciding where a piece of state should live
- Working across the Server/Client Component boundary (Next.js App Router)
- Building forms, Suspense/error boundaries, or compound components (perf: `it-team:react-performance`)

## Core Principles

1. **Render is pure.** Derive values during render; never mirror props/state into state via `useEffect`.
2. **Side effects live in event handlers or effects**, never in the render body.
3. **Compose, don't inherit.** Use `children`, named slot props, or compound components.
4. **Components render; logic lives elsewhere.** Business logic goes in slice `model/` hooks and
   entity functions, not JSX.
5. **No hardcoded user-facing strings** - every label, error, and aria text goes through i18n.

```tsx
// Good: derive during render. Money is integer minor units; format via the money helper.
function CartTotal({ items }: { items: readonly CartItem[] }) {
  const totalMinor = items.reduce((sum, i) => sum + i.priceMinor * i.qty, 0);
  return <span>{formatMoney(totalMinor)}</span>;
}

// Bad: useState + useEffect(() => setTotal(...), [items]) - extra render, can desync
```

## Hooks Discipline

- Top-level only, never conditional
- Clean up every subscription, interval, and listener
- Functional updater (`setX((prev) => prev + 1)`) when next state depends on previous
- Do not memoize by default - see `it-team:react-performance` (React Compiler, profiling first)
- Extract a custom hook when the same hook sequence appears in 2+ places, or to move logic out of JSX
- Non-reactive logic read inside an effect belongs in `useEffectEvent` (React 19.2), not in deps

## State Location Decision Tree

```
Comes from a server / API?
  -> TanStack Query (queries + mutations). Never copy it into useState/Zustand.

Lives in the URL (filters, tab, page, search)?
  -> router search params (React Router useSearchParams / Next.js searchParams)

Shared client state across distant parts of the tree (session, theme, wizard)?
  -> Zustand store with narrow selectors

Used by one component or a small subtree?
  -> useState / useReducer, lifted to the nearest common ancestor if needed

Need to inject a dependency or wire a compound component?
  -> React Context (DI / compound components ONLY - not a state store)
```

Do not prop-drill server data: each consumer calls the query hook; the cache dedupes.

## Data Fetching (TanStack Query v5)

All server state goes through TanStack Query. In FSD, the query key factory and hooks live in the
entity slice (`entities/<name>/model`) and are exported via the slice's `index.ts`.

```ts
// entities/expense/model/queries.ts
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

export const expenseKeys = {
  all: ["expenses"] as const,
  list: (month: string) => [...expenseKeys.all, "list", month] as const,
};

export const expensesQuery = (month: string) =>
  queryOptions({
    queryKey: expenseKeys.list(month),
    queryFn: () => expenseApi.list(month), // returns Promise<Expense[]>, Zod-parsed
  });

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: expenseApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseKeys.all }),
  });
}
```

```tsx
import { useQuery } from "@tanstack/react-query";
import { expensesQuery } from "@/entities/expense"; // through the barrel

function ExpenseList({ month }: { month: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery(expensesQuery(month));
  if (isPending) return <ExpenseListSkeleton />;
  if (isError) return <p role="alert">{t("expenses.loadError")}</p>;
  return <ul>{data.map((e) => <ExpenseRow key={e.id} expense={e} />)}</ul>;
}
```

Avoid `useEffect` + `fetch` for application data: races, no cache, no retry, no Suspense.
Use `useSuspenseQuery` when the component sits under a Suspense + error boundary.

## Server / Client Components (Next.js App Router 15+)

In Next 15+, `params` and `searchParams` are **Promises** - await them.

```tsx
// app/expenses/[id]/page.tsx - Server Component (default)
import { notFound } from "next/navigation";

export default async function ExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = await getExpense(id);
  if (!expense) notFound();
  return <ExpenseView expense={expense} />;
}
```

Server Actions live in their **own file with a top-level `"use server"`** - never inline inside a
`"use client"` file.

```ts
// features/update-profile/api/actions.ts
"use server";

import { ProfileSchema } from "@/entities/user";

export type ProfileState = { errorKey: string | null };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await getSession();
  if (!session) return { errorKey: "errors.unauthorized" };
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errorKey: "errors.invalidInput" };
  await saveProfile(session.userId, parsed.data);
  return { errorKey: null };
}
```

```tsx
// features/update-profile/ui/ProfileForm.tsx
"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "../api/actions";

const initial: ProfileState = { errorKey: null };

export function ProfileForm() {
  const { t } = useTranslation();
  const [state, formAction, pending] = useActionState(updateProfile, initial);
  return (
    <form action={formAction}>
      <label htmlFor="name">{t("profile.name")}</label>
      <input id="name" name="name" required />
      <button type="submit" disabled={pending}>{t("common.save")}</button>
      {state.errorKey ? <p role="alert">{t(state.errorKey)}</p> : null}
    </form>
  );
}
```

Boundaries:

- Server -> Client: pass serializable props or `children`
- Never import a Server Component into a Client Component file; compose via `children`
- Every `"use server"` export is a public endpoint - authenticate and validate inside it

## Suspense + Error Boundaries

```tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<BudgetSkeleton />}>
    <BudgetOverview month={month} />
  </Suspense>
</ErrorBoundary>
```

- Place Suspense close to the data, not at the route root
- Use `react-error-boundary`; pair with `QueryErrorResetBoundary` for retry

## Forms (React Hook Form + Zod)

Zod schemas are the source of truth for validation and types. Error messages are i18n keys.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const ExpenseFormSchema = z.object({
  amountMinor: z.number().int().positive({ message: "expense.errors.amountPositive" }),
  note: z.string().max(200, { message: "expense.errors.noteTooLong" }),
});
type ExpenseFormValues = z.infer<typeof ExpenseFormSchema>;

export function AddExpenseForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const addExpense = useAddExpense();
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(ExpenseFormSchema),
    defaultValues: { amountMinor: 0, note: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    addExpense.mutate(values, { onSuccess: onDone }),
  );

  const amountError = form.formState.errors.amountMinor?.message;
  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Prefer the shadcn <Form>/<FormField> wrappers; they wire label/aria for you */}
      <label htmlFor="amount">{t("expense.amount")}</label>
      <MoneyInput
        id="amount"
        aria-invalid={amountError ? true : undefined}
        aria-describedby={amountError ? "amount-error" : undefined}
        {...form.register("amountMinor", { valueAsNumber: true })}
      />
      {amountError ? <p id="amount-error">{t(amountError)}</p> : null}
      <button type="submit" disabled={addExpense.isPending}>{t("common.save")}</button>
    </form>
  );
}
```

## Composition Recipes

```tsx
// Compound components - Context is the right tool here (DI, not app state).
// Prefer a Radix/shadcn primitive (Tabs, Accordion) before hand-rolling one.
<Tabs defaultValue="month">
  <TabsList>
    <TabsTrigger value="month">{t("period.month")}</TabsTrigger>
    <TabsTrigger value="year">{t("period.year")}</TabsTrigger>
  </TabsList>
  <TabsContent value="month"><MonthView /></TabsContent>
  <TabsContent value="year"><YearView /></TabsContent>
</Tabs>
```

## Zustand for Shared Client State

```ts
import { create } from "zustand";

type UiState = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

// Subscribe with narrow selectors so unrelated changes don't re-render
const open = useUiStore((s) => s.sidebarOpen);
```

## FSD Placement

- Layers import downward only: `app -> pages -> widgets -> features -> entities -> shared`
- Import other slices only through their public `index.ts` barrel (required)
- Inside `shared/ui`, import components individually; avoid a giant re-export-everything barrel

## Accessibility

Semantic HTML before `role`; Radix/shadcn primitives for dialogs, menus, and comboboxes; every
input labelled. See `it-team:frontend-a11y` for patterns and `it-team:react-testing` for axe assertions.

## Review Checklist

- [ ] No derived state in `useEffect`; no effect-driven data fetching
- [ ] Server data via TanStack Query only; URL state in search params; shared UI state in Zustand
- [ ] Context used only for DI / compound components
- [ ] Next 15+: `params`/`searchParams` awaited; Server Actions in separate `"use server"` files
- [ ] Forms use RHF + Zod; error messages are i18n keys
- [ ] Stable `key`s from ids, never array indexes for dynamic lists
- [ ] Money as integer minor units, formatted via the money helper
- [ ] Cross-slice imports go through public barrels

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
