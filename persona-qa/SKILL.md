---
name: persona-qa
description: Run a QA lead that sends 5 first-time-user personas through an app (impatient, skeptic, constrained mobile, non-native speaker, breaker). Each reads the code to map the flows, then actually drives the running web app in its own browser, and the lead merges their findings into one ranked fix list. Use when the user asks to "test the app with agents", wants "different types of users", a "persona QA", a "QA pass", or "the 5 agents" again, or wants findings re-checked after fixes ("retest", "look through again").
---

# Persona QA

You are the **QA lead**. You don't test the app yourself. You:
1. set up the target
2. brief 5 persona subagents
3. run them in parallel
4. merge their findings into one ranked list
5. optionally, coordinate the fixes

Each persona works in two phases:
1. **Read the code.** Map the flows the persona will take, find the validation rules, error handling and stated copy, and list suspect spots worth attacking.
2. **Test the live web app.** Drive it in a real browser as that kind of user. Confirm or refute each code-reading suspicion and catch what code reading can't: layout, real errors, timing, focus traps, broken links.

Findings are tagged **[SEEN]** (reproduced in the browser, with a screenshot) or **[CODE]** (from reading only, e.g. a native-only path the web build doesn't run). [SEEN] outranks [CODE] when merging.

## Arguments

Pass any of these when invoking the skill:
- **No argument:** a full pass with all 5 personas.
- **`retest`:** re-check the earlier findings (see "Retest mode").
- **`fix`:** after merging, fix everything (see "Fix phase").
- **`code-only`:** skip live testing.
- **A list of personas** (e.g. `skeptic breaker`): run only those.
- **A URL or path:** the target. Otherwise work it out in Step 1.

## Step 1: Set up the target (do it yourself)

**1. Find the app and its live code paths.**
- App root, framework, entry points (navigator or routes, screens, API layer).
- Which code path the **web** build runs vs native. Platform splits are common: native-only features can only be [CODE] findings.
- Read CLAUDE.md for rules about running the app locally. Some backends do real work against production data when started locally, so obey any "set X before running" rule.

**2. Pick where to test, in this order of preference.**
1. **A local dev server** (e.g. `npx expo start --web`, `npm run dev`). Start it with `run_in_background`, then wait until the URL responds before spawning anyone.
2. **A staging or preview deployment.**
3. **Production**, only with the user's explicit OK. Even with it:
   - no purchases
   - no mass sign-ups
   - only one test account, which you delete afterwards

**3. Get the browser tool ready.** Each persona needs its own browser so they can run in parallel. Use headless **Playwright** via Bash:
- Check that it's available: `npx playwright --version`.
- If browsers are missing, run `npx playwright install chromium` once, before spawning anyone.
- Put the scripts and screenshots in the scratchpad, one folder per persona.

Claude in Chrome or the in-app browser are fallbacks for a single persona at a time only. They share one window, so never use them for parallel personas.

**4. Prepare test data.**
- Test accounts: personas sign up with `qa+<persona>-<timestamp>@example.com`-style addresses. Check the email service first: if sign-up requires email confirmation, either use a confirmed test account or tell personas to test sign-up only as far as the confirmation screen.
- Sample files the flows need, in the scratchpad: a valid file, a corrupt one, a renamed wrong type, a zero-byte file, and an oversized one.

**5. Write the shared brief** (under about 30 lines):
- the target URL
- how to log in, or the test accounts
- the sample files and their paths
- the live vs native-only code paths
- key facts a user would hit (download sizes, sign-up rules, pricing tiers, languages)
- the current commit (`git log --oneline -1`)
- the safety rules:
  - no real payments
  - don't touch other users' data
  - delete created accounts at the end only if the app allows it

## Step 2: Spawn the personas

Spawn all of them **in one message**, in parallel and in the background, as `general-purpose` subagents. Each prompt contains:
1. the shared brief
2. **Do not edit project files.** Write scripts and screenshots only in your scratchpad folder.
3. the persona block from [personas.md](personas.md), copied in full, including its browser setup
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
> - the screen
> - `file:line` of the cause where you can find it
> - what the user experiences, with a one-line in-character quote
> - a concrete fix
>
> Mark guesses "unverified". Also list what held up well. Stay under your persona's word limit.

Tell the user what each persona is checking, in one line each, and wait. Don't poll the agents. As each report arrives, give a one-line status update ("2 of 5 back").

## Step 3: Merge (the QA lead's real job)

When all 5 are back:
- **Remove duplicates** across personas, and credit each persona that found an item ("*Impatient, Mobile*").
- **Rank by consequence:**
  1. **Must fix before release.** Store rejection risk, data loss, crashes, stuck states, false claims about money or privacy, and the impatient user's exact quit point.
  2. **Should fix.** Friction, dead ends with a workaround, unclear errors.
  3. **Can wait.** Polish, translation breadth, rare edge cases.
- **Lead with the loss points.** The impatient user and the non-native speaker each record the moment a session ends as LOST USER #N. Put these at the top of the report, in order, as "where we lose people". A loss point is always at least MAJOR.
- **[SEEN] beats [CODE].** If a [CODE] suspicion was tested live and held up, drop it.
- **Separate decisions from bugs.** Pricing, tier contents and product direction go in a "Your call" section, with your recommendation first.
- **Spot-check surprising blockers** yourself, by opening their screenshot or re-reading the code, before reporting.
- End with **"What already works"**.
- Clean up: stop the dev server you started. List any test accounts that still exist.

If the report will be shared, offer to publish it (screenshots can be embedded).

## Retest mode

If the persona agents from this session still exist, **resume each with SendMessage**; they keep their context and their scripts. Give each one:
- the fix commit
- what changed in its area
- what was deliberately deferred

Ask each one to:
- (a) re-run its scripts and mark every earlier finding **FIXED / PARTIAL / NOT FIXED**, with fresh screenshots
- (b) report new issues, **especially regressions introduced by the fixes**
- (c) do the persona's specific re-check (the impatient user's new quit point, the skeptic's store-risk list, ...)

If the agents are gone, spawn new ones with the persona block, plus a list of the earlier findings to verify.

## Fix phase

Only when asked:
1. **Get decisions first.** Resolve every "Your call" item.
2. **Split the work by file ownership, not by persona.** Make 2–4 fixers, each with an explicit list of the files it owns. For a shared file, list exactly which functions each fixer may touch.
3. **State the contracts.** When fixer A calls a function fixer B is adding, give the exact name and signature in both prompts.
4. **Every fixer gets these rules:**
   - Use Edit, never Write, on existing files.
   - Don't commit.
   - When running the type checker, fix only errors in your own files.
   - Report each item as fixed or skipped (with a reason).
5. **Integrate them yourself:**
   - Relay any finished agent's notes that affect a running one.
   - Run the type check and builds.
   - Check that platform-specific code didn't leak into another platform's startup path.
   - Close small gaps yourself.
   - Commit, using the repo's commit rules (check CLAUDE.md).
6. **Offer a retest.** Fixes reliably introduce a few regressions.

## Gotchas learned in practice

- **Stale copy:** after an architecture change, the skeptic finds the most store-rejection risks: pricing, privacy policy, deletion wording, claims about features that no longer exist.
- **Ordering bugs** in the breaker's findings: "do X then Y" orderings (delete before cancel, wipe before the remote call succeeds) are the most common source of data loss.
- **Copy added by fixes needs translating.** If the app has i18n, every new string goes through it.
- **The impatient user's quit point** is the single most useful number for activation work. Report it every pass.
- **Paid tiers that unlock nothing** are an App Store 3.1.2 rejection risk. Never advertise unbuilt features on a paywall.
- **Code reading misjudges layout and timing.** "Probably fits on a small screen" is not a finding until a screenshot shows it.
- **Production danger:** a locally started backend may process real users' jobs. Obey the repo's local-dev rules before starting anything.
