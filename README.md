# personal-skills

My personal [Claude Code](https://claude.com/claude-code) skills.

| Skill | What it does |
|---|---|
| [persona-qa](persona-qa/SKILL.md) | A QA lead that runs 5 first-time-user personas through an app. Each reads the code, then drives the live web app in its own Playwright browser. The lead merges their findings into one ranked fix list, with retest and fix modes. |
| [owasp-audit](owasp-audit/SKILL.md) | A security lead that runs 10 auditors through an app, one per OWASP Top 10 risk (with the Mobile Top 10 folded in), and merges their findings into one verified, ranked list. A fix phase follows, then 2 gate agents (Exploit Verifier and Build Guardian) cross-check every fix. Both must pass before anything is committed. |

## Install

Claude Code loads personal skills from `~/.claude/skills/`. Link each skill folder there so this repo stays the single source of truth.

**Windows** (a junction, no admin needed):
```cmd
mklink /J "%USERPROFILE%\.claude\skills\persona-qa" "%CD%\persona-qa"
```

**macOS / Linux:**
```sh
ln -s "$PWD/persona-qa" ~/.claude/skills/persona-qa
```

## Adding a skill

1. Create `<skill-name>/SKILL.md` with `name` and `description` frontmatter. The description decides when the skill triggers.
2. Put supporting files next to it and link them from `SKILL.md`.
3. Link the folder into `~/.claude/skills/` as above, and add a row to the table.
