---
name: codebase-wiki
description: Run a documentation lead (an Opus overseer) that sends Sonnet workers through a codebase, one per area with exclusive write ownership, to build an Obsidian-style wiki (linked notes, architecture overview, security model, request lifecycles, glossary, open-issues list) and a status.md; clashes between workers are ruled on by the overseer, and a link/coverage/secrets checker must pass before anything is committed. Use when the user asks to "document the codebase", "write the architecture docs", "make a wiki", "explain how this project works", "Obsidian docs", "wikilinks", "status.md", or wants an existing wiki refreshed after code changes ("update the docs").
---

# Codebase Wiki

You are the **documentation lead**. You don't document the code yourself. You:
1. agree the scope and format with the user
2. launch one **Opus overseer**, who plans the notes and runs the **Sonnet workers**
3. verify the result yourself (don't just relay the overseer's report)
4. write or refresh `status.md`
5. only commit or push when the user asks, after the hygiene check below

Briefs: [overseer.md](overseer.md) · [worker.md](worker.md) · [status-template.md](status-template.md) · checker: [check-wiki.mjs](check-wiki.mjs)

The output is a vault of Markdown notes where the **filename is the note title** and notes link with `[[Title]]`, `[[Title#Heading]]`, `[[Title|alias]]` (Obsidian style). The owner opens the folder as a vault and starts at `00 Index`.

## Rules (every agent gets these, word for word)

- **Documentation only.** Nobody edits source code, config or existing docs. Agents write **only** inside their own folder of the wiki.
- **No secrets.** Environment variable **names** only, never values. Never read or quote `.env*`. No keys, tokens, passwords, personal emails, or real customer data. Fake/mock data is described, not listed.
- **Facts come from reading the code.** Cite `path` (and `path:line` where it matters). Anything not verified is marked `unverified`. A bug or inconsistency is **recorded in Open issues**, never smoothed over in prose.
- **Verify framework-specific behaviour against the installed docs**, not memory, when the repo says its framework version has breaking changes (e.g. an `AGENTS.md` warning, `node_modules/<pkg>/dist/docs/`).
- **Keep technical terms intact.** Each note opens with a 2-3 sentence "In plain English" paragraph; don't water the terms down.
- **Save tokens.** Dense notes (~150-400 words, hubs longer), tables over prose, code excerpts <= 10 lines, no copying whole files, link instead of repeating.
- **No git commits or pushes by agents.**
- **Excluded areas** the user names (e.g. work in progress) are not documented, beyond a one-line mention where something else depends on them.

## Arguments

- **No argument:** full build.
- **`update`:** refresh an existing wiki (see "Update mode"). Cheapest option; use it after code changes.
- **`status`:** only (re)write `status.md` from the current repo state. No agents needed.
- **`check`:** only run the checker and report.
- **`per-file`:** one note per source file (about 130 notes for 130 files; most thorough, most expensive). Default depth is **one note per module** (per route, per important lib file, per component group, per table).
- **`plain-links`:** emit normal Markdown links instead of `[[wikilinks]]` (GitHub does not render `[[ ]]`).

## Step 1: Map and agree (do it yourself, briefly)

1. `git ls-files` and the manifest (package.json etc.): count files and lines per top-level folder. Get real numbers; they drive the split.
2. Ask the user, in one message, with a recommended default for each:
   - **Format:** Obsidian wikilinks (default) or plain links.
   - **Depth:** per module (default, saves tokens) or per file.
   - **Exclusions:** anything in progress or private.
   - **Public repo?** (see "Hygiene before commit"). If yes, ask whether AI involvement may be visible.
   - **Go-ahead for the cost.** Opus overseer + ~6 Sonnet workers is a big run; say so, don't quote a number.
3. **Tell the user the plan before executing** if they asked for it: areas and owners, phases, clash protocol, how you'll verify.
4. Choose **5-7 areas** with disjoint file sets. A typical web-app split: platform (tooling, config, tests, scripts), database, core domain logic, accounts/auth, customer UI, admin. Merge small areas, split any with > ~35 files.

## Step 2: Launch the overseer

Spawn **one** background agent: `subagent_type: general-purpose`, `model: opus`, using the template in [overseer.md](overseer.md) filled with: project summary, the areas with exact file lists, exclusions, depth, format, wiki path (default `docs/wiki/`), scratchpad path, and the checker (copy [check-wiki.mjs](check-wiki.mjs) into the scratchpad first).

Immediately afterwards, send the overseer **its own agent ID** with SendMessage (`ToolSearch select:SendMessage` first if it is a deferred tool). Workers need that ID to send `CLASH:` / `QUESTION:` messages.

The overseer spawns the Sonnet workers itself (`model: sonnet`, background). **In practice agents can spawn agents here**; if the overseer cannot, it must finish Phase 0 (the registry), say so, and stop. Then you launch the workers using [worker.md](worker.md), pointing them at the overseer's ID, and relay messages.

Don't poll. Say what's running, then wait for the overseer's report.

## Overseer phases (summary; full text in [overseer.md](overseer.md))

0. **Registry.** Read the layout; write `_meta/Note Registry` listing every planned note: exact title, folder, owner, one-line scope, source files. Fixes names up front so workers can link to notes that don't exist yet. Defines the note template, link rules, concept-note names, and the frontmatter stamp.
1. **Workers in parallel.** Each documents its area using [worker.md](worker.md).
2. **Synthesis (overseer).** `00 Index` (hub linking everything), `Architecture Overview`, `Security Model`, `Request Lifecycles` (step-by-step for the main user journeys), `Glossary`, the ~15-20 concept notes, `_meta/Open issues`, `_meta/Rulings`.
3. **Verification.** Run [check-wiki.mjs](check-wiki.mjs); fix every failure; spot-check >= 6 claims per worker against the code; fix errors.

### Naming and link rules (fixed in the registry)
- Filename == title; **titles unique** across the vault; no `/ \ : # ^ [ ] |` in titles.
- Repos have many `page.tsx` / `actions.ts` / `index.ts`: name notes by purpose or route (`Route account-membership`, `Actions account-bookings`), never by bare filename.
- Every note has **>= 8 wikilinks**: what it depends on, "Used by", relevant concept notes, its area hub, `00 Index`.
- Frontmatter on every note: `area`, `source` (list of paths), `commit` (`git rev-parse --short HEAD`), `updated` (date).

### Clash protocol
Workers never edit another area's notes. A worker sends the overseer `CLASH:` (two want the same concept, disagree on a fact, the code contradicts another area's description, or it needs something outside its folder) with evidence (`file:line`), then waits. The overseer **reads the code itself**, decides, replies to **both** parties with the same ruling, and logs it in `_meta/Rulings`. A clash that exposes a real code bug goes to `_meta/Open issues` instead of being papered over. In the first real run there were no clashes; the overseer instead made 7 rulings while reconciling reports. Both paths are fine.

## Step 3: Verify yourself (don't just relay)

When the overseer reports, check independently:
1. **Nothing outside the wiki changed:** `git status --short | grep -v docs/` should print nothing.
2. **Counts:** notes, words, wikilinks. **Use `find ... -print0 | xargs -0`**: note filenames contain spaces and plain `cat $(find ...)` breaks.
3. **Re-run the checker** yourself; expect all counters at 0.
4. **Secrets and personal data scan** of the wiki (and status.md): JWT-like strings, key prefixes, project refs/URLs, the user's email, any password you know of, test credentials.
5. **Excluded areas didn't leak** (grep for their names).
6. **Spot-check 4-6 facts** against the code, especially numbers and rules (limits, durations, windows, defaults) and one "bug" from Open issues.
7. Report honestly: counts vs target (the first run overshot 93 vs 60-80 because the overseer kept one note per route/table), unverified items, and the open-issues list.

## Step 4: status.md

Always write (or refresh) `status.md` at the repo root from [status-template.md](status-template.md): the **last thing done**, what works, what's in progress, open decisions, top known issues (pointing at `Open issues`), where things live, working conventions. Facts only, short, no secrets. Refresh it at the end of every working session, not just after a wiki run (`/codebase-wiki status`). Link the wiki from it.

## Update mode (`update`)

Keeps the wiki cheap to maintain:
1. Read the `commit` stamp from the notes' frontmatter (take the oldest if they differ).
2. `git diff --name-only <stamp>..HEAD`; map changed files to notes through each note's `source` list. Files with no note = new coverage needed.
3. Re-dispatch **only the affected areas' workers**, with the list of changed files and the notes to revise (the previous brief files remain valid). New files get new notes registered first.
4. The overseer re-stamps `commit`/`updated` on touched notes, refreshes Index, Architecture Overview and Open issues where affected, re-runs the checker.
5. Refresh `status.md`.

## Hygiene before commit or push (do this every time)

The agent process leaves traces. Before committing:
- **Scan** for secrets and personal data (Step 3.4).
- **Process language:** the `_meta` notes (Registry, Rulings, Open issues) talk about "workers", an "overseer" and area codes like S1-S6, and some notes may carry "(S5)" tags. Any build log or status file may name the AI. If the repo is **public**, say plainly what a reader would see, including that **Open issues is effectively a list of the site's weak spots**, and let the user choose: sanitise (rewrite neutrally, keep technical content), push only the clean notes, or push as-is. Respect the answer; it's their repo. Offer the sanitised option, don't force it.
- **Commit message:** plain, no AI trailers unless the user wants them (check their stated preference first; some users don't).
- **Never push unless asked.** Pushing a history rewrite (e.g. to strip trailers) needs explicit approval, a backup branch, and `--force-with-lease`.

## Gotchas learned in practice

- **`[[wikilinks]]` don't render on GitHub**: they show as plain text. Tell the user to open `docs/wiki` as an Obsidian vault, or use `plain-links`.
- **Note counts overshoot.** Per-module can still reach ~90 notes on a ~130-file repo. Set a target and tell the overseer to merge, or accept it.
- **Line numbers go stale and are often off by a few.** The first run's spot-check caught two wrong line numbers; cite lines only where it matters and re-verify them.
- **Bare filenames don't count as coverage.** The checker wants full paths (`lib/foo.ts`), because `foo.ts` is ambiguous.
- **Coverage must exclude `_meta`** or the registry makes everything look documented.
- **Strip code fences before counting links** so template examples don't inflate the link count.
- **Heading links** (`[[Note#Heading]]`) break if the heading contains `/`; the checker reports them.
- **Two workers share one source file** (e.g. a proxy/middleware that is both platform and auth): split by *aspect* and cross-link, and record the ruling.
- **The overseer hits the live DB only if told to.** Say so explicitly; drift between a schema file and the live database is then reported as unverified, not guessed.
- **Docs describe the code today.** The stamp (`commit`) is how readers (and `update`) know what they are looking at.
- **Good output includes the bad news.** The first run's Open issues found 30 real problems (a free self-serve membership, a logged-in customer being signed out when they open the admin URL, an account-existence leak, missing race guards, missing tests). Surface them to the user; offer to fix.
