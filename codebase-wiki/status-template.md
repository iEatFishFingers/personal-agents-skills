# status.md template

Keep it short and factual. It answers one question: *"where did we leave off?"* Write it at the repo root. Refresh it at the end of every working session and after every wiki run (`/codebase-wiki status`). No secrets, no personal data.

```markdown
# <Project>: project status

**Last updated:** <date>

## Last thing done
<1-3 sentences: the most recent piece of work, and whether application code changed.>

## What exists and works
<bulleted by feature: public site, accounts, core flow, admin, tests, tooling. Say what is live and what was confirmed working.>

## In progress: <current effort, if any>
<Who is doing what. A small table of steps with status: Done / Next / To do.>

## Decisions still open
<bullets: each with why it matters.>

## Known issues
<top 3-6 items, each one line; point at the full list: docs/wiki/_meta/Open issues.md>

## Where things are
| Path | What |
|---|---|
| `docs/wiki/` | The codebase wiki. Open as an Obsidian vault and start at `00 Index`. |
| ... | ... |

## Working conventions
<e.g. commit message style, no secrets in git, nothing pushed unless asked. Don't state anything the owner would rather not show on a public repo; check first.>
```

## Rules
- **Dates are absolute** (`2026-11-18`), never "today" or "last week".
- **Last thing done** is the first section so a returning reader (or a new session) sees it immediately.
- **Reflect the repo, not memory:** check `git log -5`, `git status`, and what actually exists before writing "done".
- **Don't duplicate the wiki:** summarise and link.
- **Public repo:** status files often mention how work is being done (tools, assistants, process). Ask before pushing if that would be visible and the owner cares.
