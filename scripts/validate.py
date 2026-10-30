#!/usr/bin/env python3
"""Validate the it-team plugin: manifests, frontmatter, and cross-references."""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGIN = os.path.join(ROOT, "plugins", "it-team")
errors: list[str] = []
AGENT_WORDS = 900          # prompt body per agent (audit ratchet)
# Ratchet exceptions: measured after the 0.16.0 trim; lower them, never raise them.
AGENT_WORDS_MAX = {"ux-ui-designer": 1250}  # five modes; drops when the extraction script (audit §9 item 6) lands
SKILL_LINES = 500          # SKILL.md
PRELOAD_WORDS = 1200       # all preloaded skills of one role together
PRELOAD_WORDS_MAX = {"frontend-engineer": 2400}  # design-system-first + frontend-code: rules that were on demand went unread


def body_words(fm: dict[str, str]) -> int:
    return len(fm["__body__"].split())


def frontmatter(path: str) -> dict[str, str]:
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        errors.append(f"{path}: missing frontmatter")
        return {}
    fm: dict[str, str] = {"__raw__": m.group(1), "__body__": text[m.end():]}
    for line in m.group(1).splitlines():
        kv = re.match(r"^([a-zA-Z-]+):\s*(.*)$", line)
        if kv:
            fm[kv.group(1)] = kv.group(2)
    return fm


for manifest in [os.path.join(ROOT, ".claude-plugin", "marketplace.json"),
                 os.path.join(PLUGIN, ".claude-plugin", "plugin.json")]:
    try:
        json.load(open(manifest, encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        errors.append(f"{manifest}: {e}")

agents = sorted(glob.glob(os.path.join(PLUGIN, "agents", "*.md")))
agent_names = {os.path.basename(a)[:-3] for a in agents}
skill_files = {os.path.basename(os.path.dirname(s)): s
               for s in glob.glob(os.path.join(PLUGIN, "skills", "*", "SKILL.md"))}
own_skills = set(skill_files)
skill_words = {name: len(open(path, encoding="utf-8").read().split()) for name, path in skill_files.items()}
templates = {os.path.basename(t)[:-3] for t in glob.glob(os.path.join(PLUGIN, "team", "templates", "*.md"))}

for path in agents:
    fm = frontmatter(path)
    if not fm:
        continue
    expected = os.path.basename(path)[:-3]
    if fm.get("name") != expected:
        errors.append(f"{path}: name '{fm.get('name')}' != '{expected}'")
    if not fm.get("description"):
        errors.append(f"{path}: empty description")
    if "\n## Mode\n" not in fm["__body__"] or "BLOCKED: mode" not in fm["__body__"]:
        errors.append(f"{path}: missing '## Mode' section with the 'BLOCKED: mode' rule")
    preload_total = 0
    for skill in re.findall(r"^\s+-\s+(\S+)$", fm["__raw__"], re.M):
        short = skill.removeprefix("it-team:")
        if not skill.startswith("it-team:") or short not in own_skills:
            errors.append(f"{path}: preloaded skill '{skill}' must be a plugin skill named 'it-team:<name>'")
            continue
        preload_total += skill_words[short]
    preload_cap = PRELOAD_WORDS_MAX.get(expected, PRELOAD_WORDS)
    if preload_total > preload_cap:
        errors.append(f"{path}: preloaded skills total {preload_total} words (cap {preload_cap})")
    for key in ("tools", "effort", "maxTurns", "model"):
        if not fm.get(key):
            errors.append(f"{path}: frontmatter lacks '{key}'")
    cap = AGENT_WORDS_MAX.get(expected, AGENT_WORDS)
    if body_words(fm) > cap:
        errors.append(f"{path}: body is {body_words(fm)} words (cap {cap})")

for path in glob.glob(os.path.join(PLUGIN, "skills", "*", "SKILL.md")):
    fm = frontmatter(path)
    if fm and fm.get("name") != os.path.basename(os.path.dirname(path)):
        errors.append(f"{path}: name mismatch")
    lines = open(path, encoding="utf-8").read().count("\n") + 1
    if lines > SKILL_LINES:
        errors.append(f"{path}: {lines} lines (cap {SKILL_LINES})")

for path in agents + glob.glob(os.path.join(PLUGIN, "skills", "*", "SKILL.md")):
    body = open(path, encoding="utf-8").read()
    if "~/.claude/team" in body:
        errors.append(f"{path}: hardcoded ~/.claude/team path")
    for group in re.findall(r"docs/_team/templates/\{?([a-z,\-]+)\}?\.md", body):
        for name in group.split(","):
            if name not in templates:
                errors.append(f"{path}: unknown template '{name}'")
    for name in re.findall(r"\bit-team:([a-z0-9]+(?:-[a-z0-9]+)*)", body):
        if name not in agent_names | own_skills:
            errors.append(f"{path}: unknown 'it-team:{name}'")
    # a bare skill name of a plugin skill must carry the namespace, or the Skill tool will not find it
    for name in re.findall(r"`([a-z]+(?:-[a-z]+)+)`", body):
        if name in own_skills and f"it-team:{name}" not in body:
            errors.append(f"{path}: skill '{name}' referenced without the 'it-team:' namespace")
    for name in re.findall(r"`([a-z]+(?:-[a-z]+)+)`", body):
        if name.endswith(("-engineer", "-analyst", "-researcher", "-designer", "-manager", "-writer")) \
                and name not in agent_names:
            errors.append(f"{path}: unknown agent '{name}'")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"OK: {len(agents)} agents, {len(own_skills)} skills, {len(templates)} templates; "
      f"caps: agent body ≤ {AGENT_WORDS} words, SKILL.md ≤ {SKILL_LINES} lines, preload ≤ {PRELOAD_WORDS} words")
