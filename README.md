# personal-skills

My personal [Claude Code](https://claude.com/claude-code) skills.

| Skill | What it does |
|---|---|
| [persona-qa](persona-qa/SKILL.md) | A QA lead that runs persona agents through an app (impatient, skeptic, constrained mobile, non-native or icon navigator, breaker, plus staff, owner, regular-user and role-boundary variants from a catalogue). Each reads the code, then drives the live web app in its own Playwright browser. The lead merges their findings into one ranked fix list and estimates what each problem could cost the business (every figure tagged DATA / OWNER / ASSUMPTION / UNKNOWN). It writes a results record before a scoped, dry-run-first cleanup. Has quick / standard / deep tiers, retest and fix modes. Ships templates for test accounts and scoped cleanup. |
| [system-simulation](system-simulation/SKILL.md) | A lead that simulates a working period (a week or a month) on a running multi-role system (bookings, shops, tickets, memberships). About 10 agents play customers and staff at the same time, in rounds; the lead moves the data back in time between rounds and checks it against invariants. At the end it reports the money that moved, was given away and was lost, costs the findings, records the results, and runs a scoped cleanup. Ships reference scripts for the cast, the time shift, the invariants runner, the money ledger and cleanup. |
| [owasp-audit](owasp-audit/SKILL.md) | A security lead that runs 10 auditors through an app, one per OWASP Top 10 risk (with the Mobile Top 10 folded in), and merges their findings into one verified, ranked list. A fix phase follows, then 2 gate agents (Exploit Verifier and Build Guardian) cross-check every fix. Both must pass before anything is committed. |
| [codebase-wiki](codebase-wiki/SKILL.md) | A documentation lead that runs an Opus overseer and about 6 Sonnet workers, each owning one area of the codebase, to build an Obsidian-style wiki (linked notes, architecture, security model, request lifecycles, glossary, open-issues list) plus a `status.md`. The overseer rules on clashes between workers. A bundled checker (`check-wiki.mjs`) verifies links, coverage and secrets before anything is committed. Has an `update` mode that re-documents only what changed. |

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

`system-simulation` is installed the same way (link `system-simulation`). Its scripts are Node (`.cjs`) reference implementations for Supabase / Postgres; for another stack keep the shape (config in, cast file out, dry-run cleanup) and swap the data layer.

`persona-qa` and `system-simulation` each carry their own copy of `business-impact.md` and `results-template.md` (a skill folder must be self-contained when linked). Keep the two copies identical when you change one.

## Adding a skill

1. Create `<skill-name>/SKILL.md` with `name` and `description` frontmatter. The description decides when the skill triggers.
2. Put supporting files next to it and link them from `SKILL.md`.
3. Link the folder into `~/.claude/skills/` as above, and add a row to the table.
