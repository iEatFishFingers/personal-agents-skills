---
name: persona-qa
description: Run a QA lead that sends persona agents (impatient, skeptic, constrained mobile, non-native or icon navigator, breaker, plus staff and regular-user variants) through an app. Each reads the code to map the flows, then drives the running web app in its own browser, and the lead merges their findings into one ranked fix list that also estimates what each problem could cost the business. Use when the user asks to "test the app with agents", wants "different types of users", a "persona QA", a "QA pass", or "the 5 agents" again, or wants findings re-checked after fixes ("retest", "look through again"). For many roles using the system at the same time over a period, use system-simulation instead.
---

# Persona QA

You are the **QA lead**. You don't test the app yourself. You:
1. scope the run with the owner (what matters, what is off limits, how money moves)
2. set up the target and test accounts
3. brief persona subagents and run them in parallel
4. merge their findings into one ranked list with a money estimate
5. record the results, clean up, and optionally coordinate the fixes

Each persona works in two phases:
1. **Read the code.** Map the flows the persona will take, find the validation rules, error handling and stated copy, and list suspect spots worth attacking.
2. **Test the live web app.** Drive it in a real browser as that kind of user. Confirm or refute each code-reading suspicion and catch what code reading can't: layout, real errors, timing, focus traps, broken links.

Findings are tagged **[SEEN]** (reproduced in the browser, with a screenshot) or **[CODE]** (from reading only, e.g. a native-only path the web build doesn't run). [SEEN] outranks [CODE] when merging.

## Arguments

Pass any of these when invoking the skill:
- **No argument:** a standard pass (5 personas from the catalogue that fit the product).
- **`tier quick | standard | deep`:** quick = 3 personas (impatient or staff, skeptic, breaker); standard = 5; deep = 5 plus each persona once per role.
- **`retest`:** re-check the earlier findings (see "Retest mode").
- **`fix`:** after merging, fix everything (see "Fix phase").
- **`code-only`:** skip live testing.
- **A list of personas** (e.g. `skeptic breaker`): run only those.
- **`no-money`:** skip the business-impact estimate (default is to do it).
- **A URL or path:** the target. Otherwise work it out in Step 1.

## Step 0: Scope it with the owner (ask once, before anything else)

Ask only what you can't read from the repo. Accept "I don't know".
1. **Off limits.** Which parts must not be changed or judged (cloned pages, third-party embeds, legal text)? Findings there go into their own bucket and get no proposed fix.
2. **Which personas matter.** Is translation in scope? If everyone reads English, swap the non-native speaker for the icon navigator (see [persona-catalogue.md](persona-catalogue.md)).
3. **Roles.** What kinds of account exist (customer, staff, owner)? You need a test account per role.
4. **Where to test** (see Step 1) and how much the run may change.
5. **Money.** Run through the interview in [business-impact.md](business-impact.md) (what is sold, prices, volume, capacity, margin, cost of an unhappy customer, how money is collected). Capture the answers with provenance; unknowns become questions in the report.

## Step 1: Set up the target (do it yourself)

**1. Find the app and its live code paths.**
- App root, framework, entry points (navigator or routes, screens, API layer).
- Which code path the **web** build runs vs native. Platform splits are common: native-only features can only be [CODE] findings.
- Read CLAUDE.md and AGENTS.md for rules about running the app locally and for framework warnings. Some backends do real work against production data when started locally, so obey any "set X before running" rule.

**2. Pick where to test, in this order of preference.**
1. **A local dev server** (e.g. `npm run dev`). Start it with `run_in_background`, then wait until the URL responds before spawning anyone.
2. **A staging or preview deployment.**
3. **Production**, only with the user's explicit OK. Even then: no real payments, no load testing, no mass sign-ups, no touching other people's data, and every record you create is tracked so it can be removed by id.

**3. Get the browser tool ready (pre-flight, once, before spawning anyone).**
- `npx playwright --version`, then launch headless Chromium once to prove it runs. If the library and the downloaded browser versions differ, run `npx playwright install chromium` now.
- Put one Playwright install in a shared folder in the scratchpad and give agents `NODE_PATH=<that>/node_modules`, so they don't each install it.
- One working folder per persona for scripts and screenshots.
- **Viewports are explicit.** Playwright's `iPhone SE` preset is 320×568, narrower than a real SE. For the "small phone" persona use `{ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }` and do one extra pass at 320.
- Claude in Chrome or the in-app browser are fallbacks for a single persona at a time only. They share one window.

**4. Create test accounts and data.**
- Use [templates/make-accounts.cjs](templates/make-accounts.cjs) to create pre-confirmed throwaway accounts, one per persona and role, with the service key held by you. Never hand the service key to a persona. Real sign-up sends emails (tiny limits, bounces), so give each persona at most 2–3 sign-up submissions.
- Keep the accounts file in the scratchpad (it holds passwords), never in the repo.
- Create anything else flows need (sample files, records). Record every id you create.
- If staff can see everything, make sure the shop has realistic data to look at (an example-data script, if the repo has one) before you start.

**5. Write the shared brief** (under about 30 lines):
- the target URL, the current commit, and the live vs native-only code paths
- how to log in (the account for that persona's role)
- the rules a user would hit (limits, prices, hours, deadlines)
- the off-limits list
- the safety rules: no real payments, no load testing, never touch other accounts' data, preview then delete only your own records, never read `.env*`
- what to put in the report (see the contract below)

## Step 2: Spawn the personas

Spawn them **in one message**, in parallel and in the background, as `general-purpose` subagents. Each prompt contains:
1. the shared brief
2. **Do not edit project files.** Write scripts and screenshots only in your scratchpad folder.
3. the persona block from [personas.md](personas.md) or [persona-catalogue.md](persona-catalogue.md), copied in full, including its browser setup
4. the method and output contract below

**Method and output contract** (append it to every persona prompt):
> **Phase 1 (code, about 30% of your effort).** Trace your persona's path through the source and list 5–10 suspect spots, each with `file:line`.
>
> **Phase 2 (live, about 70%).** Write and run Playwright scripts (Node, `chromium.launch()`) that act as your persona.
> - Take a screenshot at each step and at every problem. Save them as `<scratchpad>/<persona>/NN-what.png`.
> - Capture `page.on('console')` errors and failed requests.
> - Prefer accessible locators (`getByRole`, `getByText`), the same way a user finds things.
> - Use short scripts and iterate. If a selector fails, take a screenshot and adapt; don't guess repeatedly.
>
> For each finding give:
> - severity (BLOCKER / MAJOR / MINOR)
> - **[SEEN]** (with screenshot path) or **[CODE]**
> - **Would a human notice this?** Say so. A locator ambiguity or a hidden duplicate id that no user would see is a test artifact, not a finding.
> - the screen
> - `file:line` of the cause where you can find it
> - what the user experiences, with a one-line in-character quote
> - **what it could cost the business**, in one line, in words only (lost sale, free item given away, refund, angry customer, compliance), no invented numbers
> - a concrete fix
>
> Mark guesses "unverified". Also list what held up well. List what you did NOT test. Stay under your persona's word limit.

Tell the user what each persona is checking, in one line each, and wait. Don't poll the agents. As each report arrives, give a one-line status update ("2 of 5 back").

## Step 3: Merge (the QA lead's real job)

When all are back:
- **Remove duplicates** across personas, and credit each persona that found an item ("*Impatient, Mobile*").
- **Drop test artifacts.** If no human would notice it, it isn't a finding.
- **Rank by consequence:**
  1. **Must fix before release.** Data loss, crashes, stuck states, money lost or given away, false claims about money or privacy, security holes, and the impatient user's exact quit point.
  2. **Should fix.** Friction, dead ends with a workaround, unclear errors.
  3. **Can wait.** Polish, rare edge cases.
- **Lead with the loss points** where a user quits (impatient, staff under pressure, icon navigator, non-native). A loss point is always at least MAJOR.
- **[SEEN] beats [CODE].** If a [CODE] suspicion was tested live and held up, drop it.
- **Off-limits bucket.** Findings in off-limits areas go in a separate section with no fix proposed; the owner may raise them elsewhere.
- **Separate decisions from bugs.** Pricing, tier contents, policy and product direction go in a "Your call" section, with your recommendation first.
- **Verify before you report.** Spot-check surprising blockers in the code. For anything that depends on data (a count, a status, a total, "this was cancelled and I don't know why"), **check the database** and explain it; agents' guesses about causes are often wrong.
- **Estimate the money** unless `no-money`: follow [business-impact.md](business-impact.md). Every figure is tagged DATA / OWNER / ASSUMPTION / UNKNOWN, as a range. List the questions the owner must answer to firm up the big numbers.
- End with **"What already works"** and **"What was not tested"**.

**Record it, then clean up** (in this order):
1. Write the results record from [results-template.md](results-template.md) to `docs/qa/<date>-persona-qa.md` in the project. Export any numbers you'll want later **before** deleting data.
2. Run [templates/scoped-cleanup.cjs](templates/scoped-cleanup.cjs): dry run first, read the preview, then `--apply`. Cleanup is scoped to the test accounts and to rows created after the run started. Never run an unfiltered delete.
3. Stop any dev server you started. List what remains (and why).

If the report will be shared, offer to publish it. Ask before committing a record that describes unfixed security findings to a public repo.

## Retest mode

If the persona agents from this session still exist, **resume each with SendMessage**; they keep their context and their scripts. Give each one:
- the fix commit
- what changed in its area
- what was deliberately deferred

Ask each one to:
- (a) re-run its scripts and mark every earlier finding **FIXED / PARTIAL / NOT FIXED**, with fresh screenshots
- (b) report new issues, **especially regressions introduced by the fixes**
- (c) do the persona's specific re-check (the impatient user's new quit point, the skeptic's risk list, ...)

If the agents are gone, spawn new ones with the persona block, plus a list of the earlier findings to verify. Update the results record with the new statuses.

## Fix phase

Only when asked:
1. **Get decisions first.** Resolve every "Your call" item, or state the default you will use for each and list it as an assumption in the final report.
2. **Split the work by file ownership, not by persona.** Make 2–6 fixers, each with an explicit list of the files it owns (including which test files). For a shared file, list exactly which functions each fixer may touch. Put cloned or off-limits files on a frozen list in every prompt.
3. **State the contracts.** When fixer A calls a function fixer B is adding, give the exact name and signature in both prompts, and say who writes it first. Apply any database change yourself before the workers start.
4. **Every fixer gets these rules:**
   - Use the Edit tool, never Write, Python or sed, on existing files. Workers broke this repeatedly; ask each to report any slip and read those diffs yourself.
   - Don't commit. Don't read `.env*`. Never run database writes through MCP. Don't run integration tests or builds (you do).
   - When running the type checker, fix only errors in your own files; parallel edits cause transient errors elsewhere.
   - Report each item as fixed or skipped (with a reason), and every assumption.
5. **Integrate them yourself:**
   - Relay any finished agent's notes that affect a running one.
   - Run the type check, lint, unit tests, then the live-database tests and the build.
   - A changed function signature breaks old tests, especially integration tests the workers didn't run. Update them.
   - Race fixes recur: check every create and update path for the same check-then-insert pattern (idempotency keys, caps).
   - Close small gaps yourself.
   - Commit, using the repo's commit rules (check CLAUDE.md and the user's standing preferences).
6. **Offer a retest.** Fixes reliably introduce a few regressions.

## Gotchas learned in practice

- **Stale copy:** after an architecture change, the skeptic finds the most review and trust risks: pricing, privacy policy, deletion wording, claims about features that no longer exist.
- **Ordering bugs** in the breaker's findings: "do X then Y" orderings (delete before cancel, wipe before the remote call succeeds) are the most common source of data loss.
- **Two tabs and retries:** last-write-wins updates, and the same request submitted twice, are common. Look for them in every update path, not only creates.
- **Messages that mislead:** a generic hint ("not sure it went through?") shown on a clear refusal confuses users. Match the message to the kind of failure.
- **Silent consequences of staff actions:** if staff cancel or change something a customer relies on and nothing tells the customer, that is a finding even when nothing is "broken".
- **Role boundaries are the highest-value check** for back-office tools: replay privileged actions from a low-privilege session.
- **Copy added by fixes needs translating** if the app has i18n.
- **The impatient user's quit point** is the single most useful number for activation work. Report it every pass.
- **Paid tiers that unlock nothing** are a store-rejection and trust risk. Never advertise unbuilt features on a paywall.
- **Code reading misjudges layout and timing.** "Probably fits on a small screen" is not a finding until a screenshot shows it.
- **Agents guess at causes.** Check cancellations, counts and "who did this" against the data.
- **Production danger:** a locally started backend may process real users' jobs. Obey the repo's local-dev rules before starting anything.
- **Cleanup that is too broad gets blocked**, and rightly: preview first, scope by owner id and creation time.
