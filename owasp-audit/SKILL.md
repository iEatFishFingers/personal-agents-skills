---
name: owasp-audit
description: Run a security lead that sends 10 auditor agents through an app, one per OWASP Top 10 risk (with the OWASP Mobile Top 10 folded in), merges their findings into one ranked list, optionally fixes them, and then has 2 gate agents jointly verify that the fixes close the holes and nothing broken gets committed. Use when the user asks for a "security audit", "security review", "OWASP", "top 10", "pen test my app", "check for security holes", or wants security findings re-checked ("security retest").
---

# OWASP Audit

You are the **security lead**. You don't audit the app yourself. You:
1. map the system and write the shared brief
2. run 10 auditor agents in parallel, one per risk area
3. merge their findings into one ranked list
4. on request, coordinate the fixes
5. run the 2 gate agents, who must both pass before anything is committed

The auditor briefs are in [auditors.md](auditors.md). The gate briefs are in [gate.md](gate.md).

## Rules of engagement (every agent gets these, word for word)

This is authorized testing of the user's own app. Stay inside these limits:
- **Read-only on the project.** Auditors never edit project files, commit, push or change config. Write scripts and notes only in your scratchpad folder.
- **Local first.** Dynamic tests run against a local dev server or a local build. Production or staging is touched only if the lead says the user explicitly allowed it, and then:
  - read-only requests, using only the test account named in the brief
  - no denial-of-service, load or brute-force testing (at most a handful of requests to show that a rate limit is missing)
  - no real payments, no emails or messages to real people
  - never read, change or delete another real user's data. If a hole would expose it, stop at proving the hole exists (e.g. a count or an HTTP status) and report it.
- **Secrets stay secret.** If you find a credential, report its location and type, show at most the first 4 characters, and never use it against a live service.
- **Obey the repo's local-dev rules** in CLAUDE.md (e.g. env flags that stop a local backend from processing real users' jobs).
- **No guessing presented as fact.** Every finding is either **[PROVEN]** (reproduced, or a complete code path traced end to end) or **[SUSPECTED]** (plausible, with what would confirm it).

## Arguments

- **No argument:** full audit, all 10 auditors.
- **`fix`:** after merging, fix the findings the user approves, then run the gate.
- **`gate`:** skip the audit; run only the 2 gate agents on the current uncommitted diff.
- **`retest`:** re-check earlier findings (see "Retest").
- **A list of auditor numbers or names** (e.g. `1 5 injection`): run only those.
- **`prod-ok`:** the user explicitly allows read-only checks against production with a test account. Never assume this.

## Step 1: Map the system (do it yourself)

Spend real effort here. Auditors are only as good as the map.

1. **Components and trust boundaries.** List every part that runs code or stores data: clients (web, iOS, Android), backend services, database, auth provider, storage/CDN, payment provider, analytics, background workers, scheduled jobs, CI/CD and deploy targets. For each boundary, note who is trusted on each side.
2. **Entry points.** Server routes (with their auth decorators), database RPCs and policies (e.g. Supabase RLS, SECURITY DEFINER functions), webhooks, deep links and URL schemes, file imports and uploads, OTA update channels, and admin tools or scripts.
3. **Data inventory.** What personal or sensitive data exists (emails, payment state, files, tokens), where it is stored (DB tables, device storage, logs, analytics, CDN) and who can read it.
4. **Secrets.** Where the env files, CI secrets and build-time env vars live, and which keys ship inside client bundles by design (e.g. a public anon key) versus which must never ship (service-role keys, API secrets).
5. **Platform splits.** Which code runs on web vs native. Native-only paths can only be checked by reading code.
6. **Run targets.** Can a local backend, web build or test suite run? Start what's safe with `run_in_background`, obey the CLAUDE.md rules, and wait until it responds.
7. **Tooling.** Check what's available: `npm audit`, `pip-audit`, `semgrep`, `gitleaks` or `trufflehog`, `curl`. Use what exists. Don't install global tools without asking.
8. **Write the shared brief** (under about 40 lines): the component list, entry-point locations, data inventory, secret locations, run targets and URLs, the test account (if any), the current commit (`git log --oneline -1`), whether `prod-ok` was given, and the rules of engagement.

## Step 2: Spawn the 10 auditors

Spawn all 10 **in one message**, in parallel and in the background, as `general-purpose` subagents. Each prompt contains:
1. the shared brief
2. the rules of engagement
3. that auditor's block from [auditors.md](auditors.md), copied in full
4. the method and output contract below

**Method and output contract** (append to every auditor prompt):
> **Phase 1: map your attack surface (about 30%).** From the brief and the code, list every place your risk area could apply, each with `file:line`.
>
> **Phase 2: hunt (about 70%).** For each place, trace the real code path end to end. Where a safe dynamic test is possible (local server, unit-level script, crafted file), run it and keep the evidence: the request and response, the output, or the script. Prefer proving one serious hole over listing twenty theoretical ones.
>
> For each finding give:
> - **ID** (`<auditor#>-<n>`, e.g. `5-2`) and a title
> - **Severity:** CRITICAL (remote compromise, other users' data, money, or no-auth admin) / HIGH (needs a small precondition, or affects one user's account) / MEDIUM (defence in depth missing, or limited impact) / LOW (hardening)
> - **[PROVEN]** or **[SUSPECTED]**
> - **Where:** `file:line`, plus the route, function or component
> - **Attack:** who the attacker is, what they do step by step, and what they get
> - **Evidence:** the trace, the command and output, or the test result (secrets redacted)
> - **Fix:** a concrete change, naming the file and the approach. Mention anything the fix could break.
> - **OWASP mapping:** e.g. `A01:2025` and/or `M3:2024`
>
> Also list **what you checked that held up**, with `file:line`, so the lead knows the coverage. Stay under 1,200 words. Don't pad: if your area is clean, say so and show what you checked.

Tell the user what each auditor covers, one line each, then wait. Don't poll. As each report arrives, give a one-line status ("4 of 10 back, 1 critical so far").

## Step 3: Merge (the lead's real job)

When all 10 are back:
- **Verify every CRITICAL and HIGH yourself** before reporting it: re-read the code path, or re-run the proof safely. Downgrade or drop what doesn't hold up, and say so.
- **Remove duplicates** across auditors (the same root cause often surfaces in access control, auth and design). Keep one entry, credit each auditor, and use the highest justified severity.
- **Rank:** CRITICAL → HIGH → MEDIUM → LOW. Within a level, [PROVEN] comes before [SUSPECTED], and exposure of other users' data or money comes first.
- **Separate decisions from bugs.** Trade-offs (e.g. "a public anon key in the bundle is by design", or "rate-limit at the edge or in the app?") go in a **"Your call"** section with your recommendation first.
- **Coverage table:** one row per auditor: area, entry points checked, findings, and what couldn't be checked (e.g. native-only code, no local server).
- End with **"What's solid"**: the controls that held up.
- Clean up: stop any servers you started, and list anything an auditor created (test accounts, files).

Offer to publish the report as a private artifact if it will be shared. **Never include live secrets, real users' data or working exploit payloads against production in the report.**

## Step 4: Fix phase (only with `fix` or when the user asks)

1. **Get decisions first.** Resolve every "Your call" item, and confirm which findings to fix now.
2. **Split by file ownership, not by finding.** Use 2–4 fixer agents, each with an explicit list of the files it owns. For a shared file, list exactly which functions each fixer may touch.
3. **State the contracts.** If fixer A calls something fixer B adds, give the exact name and signature in both prompts.
4. **Rules for every fixer:**
   - Use Edit, never Write, on existing files.
   - Don't commit.
   - Fix the root cause, not the symptom (e.g. enforce on the server, not just in the client).
   - Add a regression test for each fix where the repo has tests.
   - Run the type checker and tests, and fix only failures in your own files.
   - Report each finding as fixed or skipped (with the reason).
   - Database changes are new, additive migrations. Never edit an applied migration.
5. **Integrate yourself:** relay notes between fixers, run the full type check, tests and builds, and close small gaps.
6. **Go to Step 5.** Nothing is committed before the gate passes.

## Step 5: The gate (2 agents, both must pass)

Spawn **Gate A (Exploit Verifier)** and **Gate B (Build Guardian)** from [gate.md](gate.md) **in one message**, in parallel. Give both:
- the merged findings list (with the IDs claimed as fixed)
- the full diff (`git diff` plus untracked files) and the base commit
- the brief and the rules of engagement
- the repo's quality checks (type check, test, build and lint commands from CLAUDE.md or package files)

**How they work together:**
1. **Round 1 (independent):** each runs its own checklist and returns a verdict: PASS, or BLOCK with a numbered list of blockers.
2. **Round 2 (cross-check):** send each gate agent the other's report with SendMessage. Each must confirm or dispute every one of the other's blockers, and add anything the other's findings reveal in its own area (e.g. Gate B's failing test exposes a fix Gate A wrongly marked closed).
3. **Verdict:** the change may be committed only when **both** say PASS after round 2. Any BLOCK goes back to the fixers, then repeat the gate, re-running only the affected checks. After 3 failed rounds, stop and bring the blockers to the user.

When both pass, commit using the repo's commit rules (identity, message format, CLAUDE.md). **Never push** unless the user asks. Pushing can deploy, so check the repo's push rules first (e.g. "never push while jobs are running").

## Retest

If this session's auditors still exist, resume each with SendMessage, giving it the fix commit and its earlier findings. Ask it to mark each **FIXED / PARTIAL / NOT FIXED** with fresh evidence, and to report new holes the fixes introduced. Otherwise spawn fresh auditors with their block plus the earlier findings to verify. Always finish with the gate if code changed.

## Gotchas learned in practice

- **Client-side checks are not security.** Paywalls, role checks and validation that exist only in the app can be bypassed by calling the API directly. Always ask: "what does the server or database enforce?"
- **Row-level security (RLS):** a table with RLS disabled, or a `USING (true)` policy, exposes every row to any holder of the public key. SECURITY DEFINER functions bypass RLS: check that they scope by `auth.uid()` and set `search_path`.
- **"Optional auth" endpoints** are where IDOR lives: anonymous access plus an ID from the client.
- **Downloaded code and models** (OTA updates, ML models, prebuilt frameworks) are supply-chain and integrity risks. Look for checksum and signature verification.
- **Logs and analytics leak PII** more often than databases do. Grep for emails, tokens and full request bodies in log calls.
- **Archive and document parsers** (zip, epub, docx, xml) mean zip-slip, XML external entities (XXE), decompression bombs and huge-file denial of service.
- **Fixes regress.** A security fix that changes auth or validation often breaks a legitimate flow, which is why Gate B exists.
