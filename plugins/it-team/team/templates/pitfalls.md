# Pitfalls: <product>

<!-- docs/qa/pitfalls.md — the bug classes this project has already hit, so they are not written
again. Owner: qa-engineer. When QA files a bug, it adds the bug ID to its class or opens a new
class. Engineers read the rules before coding. Guard = what catches the class automatically:
`pack` (a check in e2e/regression/), `lint` (a rule in the lint config), `primitive` (a shared
helper the rule makes mandatory), or `—` (none yet: an epic-gate story candidate). One line per
class, at most 20 classes. -->

| ID | Class | Rule for engineers | Guard | Bugs / polish |
|---|---|---|---|---|
| PF-01 | Persisted state differs before hydration (flash or layout shift on reload) | Read persisted stores only through the hydration primitive; reserve the final size | pack (reload with seeded storage), primitive | B-015, P-014 |
