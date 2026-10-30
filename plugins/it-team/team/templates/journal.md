# Run journal: <product>

<!-- docs/run/journal.md — append-only, written while STATE.md says `Journal: on`.
The orchestrator appends one row per event with a single shell command and NEVER reads this
file during a run (it only costs tokens). The plugin's permission hook appends `permission`
rows on its own. /it-team:retro reads it once at the end. Rules: TEAM.md → Run journal. -->

| Time | Event | Ref | Detail |
|---|---|---|---|
