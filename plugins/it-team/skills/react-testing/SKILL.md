---
name: react-testing
description: React component and hook testing with Vitest, React Testing Library, MSW v2, and vitest-axe. Use when writing, fixing, or reviewing tests for React components, hooks, forms, or pages.
---

# React Testing

Behavior-focused tests for React 19 components and hooks. Default runner is **Vitest** (Jest is
acceptable where a project already uses it). Run tests via the lockfile's package manager
(yarn default).

## When to Activate

- Writing tests for components, custom hooks, forms, or pages
- Adding coverage to untested code, or fixing flaky / `act()`-warning tests
- Mocking network requests or TanStack Query
- Adding accessibility assertions
- Deciding between a component test and a Playwright E2E test (see `it-team:e2e-testing`)

## Core Principle

Test what the user sees and does, not implementation details.

- Render with the same providers as production (`renderWithProviders`)
- Interact via accessible queries and `userEvent`
- Assert visible output and observable effects (callback called, request sent, text shown)
- Do NOT assert on internal state, hook calls, render counts, or child props

## Query Priority

1. `getByRole` (with `name`), `getByLabelText`, `getByText`, `getByDisplayValue`
2. `getByAltText`, `getByTitle`
3. `getByTestId` - escape hatch only

Variants: `getBy*` throws, `queryBy*` returns `null` (assert absence), `findBy*` is async.

Because UI strings go through i18n, match on the rendered translation from the test i18n
instance (e.g. `t("common.save")`) or a regex, not on hardcoded keys.

## Provider Wrapper

Create a **fresh `QueryClient` per test** with `retry: false` so cache and retries never leak
between tests.

```tsx
// shared/test/render.tsx
import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { testI18n } from "./i18n"; // i18next instance initialised synchronously with real resources

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, "wrapper"> & {
  route?: string;
  queryClient?: QueryClient;
};

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", queryClient = createTestQueryClient(), ...options }: Options = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export * from "@testing-library/react";
```

The `QueryClient` is created once per call, outside `Wrapper`, so it survives re-renders.
For Next.js App Router, replace `MemoryRouter` with a mocked `next/navigation` as needed.

Reset Zustand stores between tests (call each store's reset action, or `setState(initial)` in
`afterEach`) so client state does not leak.

## User Interaction

```tsx
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/shared/test";

test("submits the expense", async () => {
  const user = userEvent.setup();
  const onDone = vi.fn();
  renderWithProviders(<AddExpenseForm onDone={onDone} />);

  await user.type(screen.getByLabelText(/amount/i), "15000");
  await user.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
});
```

- `userEvent.setup()` once per test; always `await` its calls
- Prefer `userEvent` over `fireEvent`

## Async Patterns

```tsx
expect(await screen.findByText(/loaded/i)).toBeInTheDocument();
await waitFor(() => expect(saveSpy).toHaveBeenCalled());
await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));
```

Never `setTimeout` + assert. For timers, use `vi.useFakeTimers()` and
`userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.

## Network Mocking with MSW v2

Mock at the network layer so fetch, the API client, Zod parsing, and TanStack Query all run as in
production.

```ts
// shared/test/msw.ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

type NewExpense = { amountMinor: number; note: string };

export const handlers = [
  http.get("/api/expenses", () =>
    HttpResponse.json([{ id: "e1", amountMinor: 1_500_000, note: "Groceries" }]),
  ),
  http.post<never, NewExpense>("/api/expenses", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "e2", ...body }, { status: 201 });
  }),
];

export const server = setupServer(...handlers);
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { server } from "@/shared/test/msw";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: "error"` makes unmocked requests fail loudly.

```tsx
test("shows an error when loading fails", async () => {
  server.use(http.get("/api/expenses", () => new HttpResponse(null, { status: 500 })));
  renderWithProviders(<ExpenseList month="2026-10" />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});
```

If the app uses a fake in-memory API instead of HTTP, seed/reset that layer in `beforeEach`
rather than mocking modules.

## Custom Hook Testing

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

test("useExpenses returns the month's expenses", async () => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useExpenses("2026-10"), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0]?.amountMinor).toBe(1_500_000);
});
```

- Wrap synchronous state changes in `act`; test through the hook's public API only
- Pure logic (money math, insight rules, Zod schemas) gets plain unit tests, no React

## Accessibility Assertions (vitest-axe)

```tsx
import { axe } from "vitest-axe";

test("AddExpenseForm has no a11y violations", async () => {
  const { container } = renderWithProviders(<AddExpenseForm onDone={vi.fn()} />);
  expect(await axe(container)).toHaveNoViolations();
});
```

Jest alternative: `jest-axe` with `expect.extend(toHaveNoViolations)`.

axe in jsdom catches missing labels, invalid ARIA, missing alt text, and heading-order issues.
It cannot check real color contrast or layout - cover those in Playwright (`it-team:e2e-testing`).
See `it-team:frontend-a11y` for the patterns being asserted.

## Error and Suspense Boundaries

```tsx
function Broken(): never {
  throw new Error("boom");
}

test("error boundary renders fallback", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    renderWithProviders(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByText("fallback")).toBeInTheDocument();
  } finally {
    spy.mockRestore();
  }
});
```

For Suspense, assert the fallback first, then `await screen.findBy...` the resolved content.

## Snapshots

Avoid DOM snapshots of components - brittle and rubber-stamped. Acceptable for stable pure-data
serialization. For visual regression use Playwright screenshots.

## Component Test vs E2E

| Scenario | Tool |
|---|---|
| Hook, pure logic, presentational component, form logic | Vitest + RTL |
| Needs real layout, scrolling, drag-drop, clipboard, real CSS | Playwright (component or E2E) |
| Multi-page user journey, auth, routing | Playwright E2E (`it-team:e2e-testing`) |

## Coverage

Follow the project's configured coverage thresholds. Cover behavior and edge cases (empty,
error, loading, boundary values like zero or max money amounts), not lines for their own sake.

## Anti-Patterns

- `container.querySelector(...)` instead of accessible queries
- Asserting render counts or internal state
- Mocking React, TanStack Query internals, or child components by default
- Sharing a `QueryClient` or store state across tests
- Ignoring `act()` warnings - they signal real async bugs
- Leaving `vi.spyOn` / fake timers un-restored

## Commands

```bash
yarn vitest              # watch
yarn vitest run          # single run (CI)
yarn vitest run path/to/file.test.tsx
yarn vitest run --coverage
```

Use the project's `test` script if one exists (`yarn test`).

For a TDD workflow, hand off to the `tdd-guide` agent; `react-reviewer` reviews test quality.

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
