# Test plan: <product>

## Strategy
| Level | Tool | What | Owner |
|---|---|---|---|
| Unit | Vitest | pure logic, schemas, money/date math | dev |
| Component | RTL + MSW | UI states, forms | frontend |
| API | Vitest/Jest + Supertest | endpoints, authz, validation | backend |
| E2E | Playwright | critical journeys | qa |
| Exploratory | browser | per story charters | qa |

## Critical journeys (E2E)
| ID | Journey | Stories | Spec file | Status |
|---|---|---|---|---|

## Per-story coverage
| Story | AC scenario | Test (file › name) | Result |
|---|---|---|---|

## Environments & data
Seed data, test accounts (from seed files), viewport matrix (375, 768, 1280).

## Exit criteria for a release
- All Must stories done; all E2E green; no open Blocker/Major bugs; a11y check passed.
