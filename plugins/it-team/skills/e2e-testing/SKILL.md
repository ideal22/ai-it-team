---
name: e2e-testing
description: Playwright E2E patterns - role-based locators, web-first assertions, page objects, config, CI, and flake fixes. Use when writing Playwright tests, structuring page objects, or fixing flaky E2E runs.
---

# E2E Testing (Playwright)

Stable, fast, maintainable Playwright suites for React apps on Vite or Next.js. Run commands via
the lockfile's package manager (yarn default).

## When to Activate

- Writing or reviewing Playwright specs or page objects
- Setting up `playwright.config.ts` or an E2E CI job
- Investigating flaky or slow E2E tests
- Covering critical journeys (auth, onboarding, money-moving flows) end to end

For component-level tests use `it-team:react-testing`; to execute and triage suites, hand off to the
`e2e-runner` agent.

## File Organization

```
e2e/
  auth/sign-in.spec.ts
  onboarding/wizard.spec.ts
  expenses/add-expense.spec.ts
  pages/            # page objects
  fixtures/         # custom test fixtures, seeded data, storageState
playwright.config.ts
```

## Locator Priority

1. `getByRole(role, { name })` - mirrors how users and assistive tech find things
2. `getByLabel` - form fields
3. `getByText`, `getByPlaceholder`, `getByAltText` - when no role/label fits
4. `getByTestId` - fallback for elements with no accessible handle

If a control is hard to locate by role or label, that is usually an accessibility bug - fix the
markup (see `it-team:frontend-a11y`) before reaching for a test id.

Because strings are localized, pin the test locale (e.g. `use: { locale: 'en-US' }` plus the
app's language setting) or match with regexes from the test locale's translations.

## Web-First Assertions

Use `expect(locator)` assertions; they auto-retry until the timeout. Never sleep.

```ts
// Good - auto-waits and retries
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
await expect(page.getByRole('listitem')).toHaveCount(3)
await expect(page).toHaveURL(/\/dashboard$/)

// Bad - snapshot-in-time checks, no retry
expect(await page.getByRole('listitem').count()).toBe(3)
expect(await page.isVisible('text=Dashboard')).toBe(true)
```

To wait for a specific request, use `page.waitForResponse` with a URL predicate, started
**before** the action that triggers it.

## Page Object Model

```ts
import { expect, type Locator, type Page } from '@playwright/test'

export class ExpensesPage {
  readonly page: Page
  readonly amountInput: Locator
  readonly noteInput: Locator
  readonly saveButton: Locator
  readonly rows: Locator

  constructor(page: Page) {
    this.page = page
    this.amountInput = page.getByLabel(/amount/i)
    this.noteInput = page.getByLabel(/note/i)
    this.saveButton = page.getByRole('button', { name: /save/i })
    this.rows = page.getByRole('list', { name: /expenses/i }).getByRole('listitem')
  }

  async goto(): Promise<void> {
    await this.page.goto('/expenses')
    await expect(this.page.getByRole('heading', { name: /expenses/i })).toBeVisible()
  }

  async addExpense(amount: string, note: string): Promise<void> {
    await this.amountInput.fill(amount)
    await this.noteInput.fill(note)
    await this.saveButton.click()
  }
}
```

Page objects expose locators and intent-level actions; assertions stay in the spec.

## Test Structure

```ts
import { test, expect } from '@playwright/test'
import { ExpensesPage } from './pages/ExpensesPage'

test.describe('Expenses', () => {
  test('adds an expense and shows it in the list', async ({ page }) => {
    const expenses = new ExpensesPage(page)
    await expenses.goto()

    await expenses.addExpense('15000', 'Groceries')

    await expect(expenses.rows.filter({ hasText: 'Groceries' })).toHaveCount(1)
  })

  test('shows a validation error for an empty amount', async ({ page }) => {
    const expenses = new ExpensesPage(page)
    await expenses.goto()

    await expenses.saveButton.click()

    await expect(expenses.amountInput).toHaveAttribute('aria-invalid', 'true')
  })
})
```

- Each test is independent: seed its own data, never depend on test order
- Authenticate once via a setup project + `storageState`, not through the UI in every test
- Reset app data between tests (API call, seeded fixture, or cleared `localStorage` via
  `page.addInitScript` for client-only mock backends)

## Playwright Configuration

```ts
import { defineConfig, devices } from '@playwright/test'

// Read the port from the project: Vite defaults to 5173, Next.js to 3000.
const PORT = Number(process.env.PORT ?? 5173)
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'yarn dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- Include a mobile project for mobile-first apps
- In CI, prefer testing a production build (`yarn build && yarn preview` for Vite,
  `yarn build && yarn start` for Next.js) when dev-mode behavior differs
- Artifacts (traces, screenshots, videos) land in `test-results/`; open traces with
  `yarn playwright show-trace <path>`

## Flaky Tests

### Common causes and fixes

| Cause | Fix |
|---|---|
| Fixed sleeps | Web-first assertion on the expected end state |
| Waiting on "the network to settle" | Assert the UI that the response produces, or `waitForResponse` |
| Clicking during animation | Locator actions auto-wait for actionability; assert visibility first if needed |
| Shared data between tests | Per-test seeded data, isolated accounts |
| Order dependence | `fullyParallel: true` locally to surface it |
| Time / locale drift | Fix `timezoneId`, `locale`, and use `page.clock` for time-dependent UI |

### Detect

```bash
yarn playwright test e2e/expenses --repeat-each=10
yarn playwright test --retries=3
```

### Quarantine (temporary, with an issue link)

```ts
test('complex search', async () => {
  test.fixme(true, 'Flaky - issue #123')
  // ...
})

test('third-party widget', async () => {
  test.skip(!!process.env.CI, 'Flaky in CI - issue #123')
  // ...
})
```

## Accessibility Checks in E2E

```ts
import AxeBuilder from '@axe-core/playwright'

test('dashboard has no detectable a11y violations', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('main')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

Real-browser axe covers color contrast, which jsdom cannot.

## Critical Money Flows

- Assert exact formatted amounts as the user sees them (locale-aware), not raw numbers
- Test boundary values: zero, maximum allowed, over-budget states
- Never run money-moving E2E against production data or real payment credentials; use test
  environments and provider test modes

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/e2e.yml
name: E2E
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn
      - run: yarn install --frozen-lockfile   # Yarn Berry: yarn install --immutable
      - run: yarn playwright install --with-deps
      - run: yarn playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 14
```

## Review Checklist

- [ ] Role/label locators first; test ids only as fallback
- [ ] Only web-first assertions; no sleeps or "network settled" waits
- [ ] Tests are independent and seed their own data
- [ ] Auth via `storageState`, not repeated UI login
- [ ] Config: trace on first retry, screenshot/video retained on failure
- [ ] Mobile project included; locale/timezone pinned
- [ ] Quarantined tests reference an issue

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
