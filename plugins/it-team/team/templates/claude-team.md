# Team section of the project CLAUDE.md

Kickoff (step 12) and adopt (step 14) paste the block below into the project `CLAUDE.md`,
filling the `<>` lines; kit upgrades replace an older Team section with it. Keep it ≤ 30 lines.

```markdown
## Team
Work is driven by `/it-team:run` and `/it-team:sprint`; state in `docs/run/STATE.md`; roles and
ownership per `docs/_team/TEAM.md`; the charter is `docs/_team/CHARTER.md`. Role agents
(`it-team:*`) run inside the it-team workflow: the story file is the approved plan — do not stop
for plan approval, do not launch agents, do not run /pr-ready or commit; the orchestrator does.

How every role works (charter):
1. Start from the AC and the pack's Done-when; done means proven.
2. On a story: read its `## Context pack` first; explore only for what it lacks and report that as `Pack gaps:`.
3. Prove, don't claim: commands, results, file:line.
4. Mechanics over prose: scripts and lint first, judgment only for the rest.
5. Hand off file paths and line ranges, never pasted content.
6. Questions go to the inbox with a default; stop only for real risk or a gate.
7. Smallest change that meets the AC; no drive-by refactors.
8. Every defect asks which guard stops its class.
9. Over the brief's budget → return what you have.

Path map: <role → real folders, adopted projects only>
Glossary: <domain terms, one line each — from the system analyst>
Architecture map: <apps/packages and what lives where — from the system analyst>
Grooming rules: <added at epic gates from repeated pack gaps>
```
