# CLAUDE.md — ai-it-team

A Claude Code plugin (`plugins/it-team`) plus its local marketplace. No app code, only Markdown
prompts, templates, and one validation script.

## Rules for editing
- Agents (`plugins/it-team/agents/*.md`): frontmatter `name` = file name; sections Mode,
  Inputs, Output / Write scope, process, Rules, Done when. Keep the write-scope ownership in
  sync with `plugins/it-team/team/TEAM.md`.
- Every skill launches a role as `it-team:<role>` with `MODE: <name>` as the first prompt line;
  a new mode goes into the agent's Mode section first.
- Skills: `name` = folder name. Reference plugin files via `${CLAUDE_PLUGIN_ROOT}`; reference
  project files via `docs/_team/...` (the copy kickoff makes). Never hardcode `~/.claude/team`.
- Agent prompts and skills are in English; project docs follow the brief's language.
- A role change touches three places: the agent file, TEAM.md ownership table, README team table.
- The plugin is read in place from this repo: after an edit, `/reload-plugins` picks it up.
  Bump `version` in `plugins/it-team/.claude-plugin/plugin.json` for changes that get distributed
  to other copies (semver: prompt tweaks = patch, new role/skill/workflow change = minor).

## Commands
- Validate: `python3 scripts/validate.py`, `claude plugin validate ./plugins/it-team --strict`,
  `claude plugin validate . --strict`
- Load local changes: `/reload-plugins` (see README → Install).

## Definition of Done
- `python3 scripts/validate.py` passes.
- README and TEAM.md reflect any role, command, or path change.

<!-- claude-reflect: learned rules (saved from the band; edit freely) -->
## Learned rules
- Assume clients supply design references for client projects; the user supplies references only for their own projects.
<!-- end claude-reflect -->
