---
id: S-001
epic: E01
title: <short title>
status: todo # todo | ready | in-progress | review | done | blocked
priority: must # must | should | could
size: S # S | M | L  (L must be split)
risk: normal # normal | high — high = payments, auth/sessions, webhooks, migrations on live data, PII; engineers run on opus
depends_on: []
needs: [] # IDs from docs/client/inputs.md, e.g. [IN-05]; story waits (blocked) until received
roles: [backend, frontend, qa]
prd: [F1, US-1.1]
screens: [docs/design/screens/<screen>.md]
endpoints: ["POST /api/v1/items"]
---

# S-001 — <title>

As a <persona> I want <capability> so that <benefit>.

## Acceptance criteria
```gherkin
Scenario: …
  Given …
  When …
  Then …
```

## Definition of Ready (all checked → `status: ready`)
- [ ] Gherkin AC: happy path + ≥1 edge/error case, testable
- [ ] Screens specified with all states (or "no UI")
- [ ] Endpoints / bot commands listed in api-contract.md (or "no API")
- [ ] `depends_on` and `needs` known; size S or M
- [ ] Seed / fixtures the story needs are named

## Tasks
- **Backend:** contract schemas in packages/shared, endpoint, validation, authz, migration?, tests
- **Frontend:** screen/feature slice, query hooks, form, all UI states, tests
- **QA:** E2E for scenarios …, exploratory focus …
- **Analytics:** events … (from metrics.md)

## Notes / edge cases

## Context pack
<!-- product-manager MODE: groom fills it (it-team:story-context-pack). Paths and line ranges,
     never pasted content; ≤ 60 lines, outside the story's word budget. The orchestrator
     overwrites the (live) line at every launch and owns Stale and Pack gaps. Not part of the
     Definition of Ready: sprint grooms it just before the build. -->
- Filled: <date> · base <commit> · Stale: no
### Outcome
- Done when: <user-visible result + proof (test names, probe)>
- Out of scope: <what neighbouring stories own, by ID>
### Code
- Touch: <files/folders the story changes>
- Do not touch: <paths other roles own>
- Exemplar: <path:line-range of the closest existing slice with the same shape>
- Primitives: <shared/ui components to compose; never re-implement>
- Contract: <schema names — path:line-range; api-contract.md rows>
- Copy keys: <namespace in the message files>
### Design
- Screen: <screens.md section + lines>; states drawn: <list>
- Design files: <provided/prototype file — line range per section>
- Facts: <edges per width, rhythm, radii, one-line rows and their longest locale>
- Not drawn: <state or width — team default>
### Guards
- <PF-xx — one-line rule> (from docs/qa/pitfalls.md); regression pack stays green
### Checks
- <targeted test command> · <typecheck> · <lint> — exact commands, one call each
- (live) App: <url> · routes warmed: <list> · base: <commit>
### Pack gaps
- <date> <role>: <what was missing — where it was found, file:line>

## Log
- <date> <role>: <what happened>
