---
name: release
description: Prepare a release of a team-driven project - DevOps release checklist with full checks, docs and changelog by the tech writer, analytics verification by the data analyst, staging and client UAT; the user merges, pushes, and deploys. Use when the user says "release", "ship v1", or all stories of a release are done.
argument-hint: "[version, e.g. v1.0.0]"
---

# /it-team:release — ready to ship

Version: $ARGUMENTS (default: next from BOARD.md release plan)

Read `docs/run/STATE.md` first; work on the integration branch it names (`release/v1`). Set
Phase `release`. **Journal.** If STATE.md says `Journal: on`, append one row per event as described in TEAM.md →
Run journal (one shell command per event; never read the journal during the run).
If `docs/_team/` is missing (project started before the kit), copy
`${CLAUDE_PLUGIN_ROOT}/team/` there first — role agents read templates from it.

1. Read BOARD.md and STATE.md: list stories in the release not yet `done`, open blocker/major
   bugs, open inbox items, and polish items still undecided. If any, show them and ask whether to
   proceed with a reduced scope or finish them first.
2. Launch in **one message** (each prompt starts with `MODE: <name>`):
   - `it-team:devops-engineer` (`MODE: release`) → `docs/release/checklist.md` with all checks run.
   - `it-team:tech-writer` (`MODE: docs`) → README, CHANGELOG for this version, user guide.
   - `it-team:data-analyst` (`MODE: verify`) → event implementation table.
3. Launch `security-reviewer` on the full app surface touched by this release (auth, API,
   env, deps) and `database-reviewer` on migrations since the last release, in parallel.
4. Summarize for the user: checklist status, failing items, missing events, review findings
   (BLOCKER/MAJOR get routed to the owning engineer with `MODE: fix` and fixed before continuing).
5. Ask to commit the release docs (`chore(release): vX.Y.Z`) on the integration branch.
6. **Staging and acceptance.** Hand over the staging deploy steps from the checklist — the user
   runs them. Client project: write `docs/client/release-<version>.md` (gate-pack style, client
   language): what's in the release, the staging link, how to test it, known limitations. The
   client runs UAT on staging; their fixes become stories (`it-team:product-manager`
   `MODE: groom`) built with `/it-team:sprint`, or are deferred by the owner. Record the client's
   acceptance in `docs/client/approvals.md`. Own project: staging is optional.
7. After acceptance: ask to create the tag `vX.Y.Z` locally on the integration branch, then hand
   over the exact merge-to-main, push, production deploy, and rollback commands from the
   checklist — the user runs them. Never push, never deploy.
8. After the user confirms deployment: `it-team:product-manager` (`MODE: groom`) marks the
   release done in BOARD.md and proposes the next release scope. Update STATE.md: Phase `done`,
   or the next release with its new integration branch `release/v<next>` (cut from main after the
   user's merge).
