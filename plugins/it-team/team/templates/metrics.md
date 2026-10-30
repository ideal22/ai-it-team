# Metrics & tracking plan: <product>

## Metric tree
- **North-star:** <metric> — why it reflects user value
  - Input metric 1 (activation): …
  - Input metric 2 (retention): …
  - Input metric 3 (monetization, if any): …

## Funnel
| Step | Event | Target conversion |
|---|---|---|

## Tracking plan
| Event name (snake_case, object_action) | Trigger | Properties (name: type) | Story |
|---|---|---|---|
| signup_completed | account created | method: 'email'\|'google' | S-00x |

Rules: no PII in properties; ids only. One event = one user intent.

## Dashboards / questions to answer after launch
- …

## Tooling
- Recommended: PostHog (free tier) | none for v1. Integration is a story in the backlog.
