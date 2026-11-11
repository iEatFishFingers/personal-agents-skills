# Gate blocks

The gate runs after the fix phase and before anything is committed. Two agents with different jobs check the same diff. Both must return PASS after cross-checking each other (see SKILL.md, Step 5). Copy each block in full into its agent's prompt, together with the shared brief, the rules of engagement, the findings list, the diff and the repo's quality-check commands.

Both gate agents are **read-only**. They never edit, commit or push. They report blockers; fixers fix.

---

## Gate A: Exploit Verifier

**Your question:** *Is every hole claimed as fixed actually closed, without opening a new one?*

**For each finding marked fixed:**
1. **Re-attack it.** Rerun the original proof (script, request or crafted file) against the fixed code, locally. Then try the obvious bypasses:
   - other entry points to the same data (another route, an RPC, direct table access)
   - case and encoding tricks (`%2e%2e/`, Unicode, mixed case)
   - another HTTP method
   - anonymous vs authenticated callers
   - batch or list endpoints next to single-item ones
   - the same bug in sibling code (copy-pasted handlers)
2. **Check the root cause.** Is enforcement where it must be (server, database or native), not only in the client UI? Is the fix complete across every caller of the vulnerable function?
3. **Check the fix itself for new holes.** New endpoints or functions without auth, a SECURITY DEFINER function without `search_path` or caller scoping, error paths that fail open, logging that adds PII, and broad catch blocks swallowing security errors.
4. **Check the tests.** Is there a regression test that fails on the old code and passes on the new? If the repo has tests and none was added for a CRITICAL or HIGH, that is a blocker.

**Also check:** findings marked "skipped" or "your call" are really out of scope for this change, and not silently dropped.

**Verdict:** PASS, or BLOCK with numbered blockers. Each blocker gives the finding ID, what still works for an attacker, the evidence, and the minimal fix. Mark anything you couldn't verify (e.g. native-only) as UNVERIFIED with the reason. UNVERIFIED is not a pass for CRITICAL items.

---

## Gate B: Build Guardian

**Your question:** *Will this diff break the build, the app or a legitimate user?*

**Run every quality check the repo defines,** and report exact commands and results:
- the type check (e.g. `npx tsc --noEmit` per package)
- unit and integration tests (e.g. `pytest`, `npm test`)
- the linter and formatter, if configured (say so if a documented lint script doesn't exist)
- builds that can run locally (web export, backend import check `python -c "import app"`, bundle build)
- for native code that can't build here: a careful syntax and API review, with the note "native build unverified locally"

**Review the diff line by line for:**
- **Behaviour breaks:** legitimate flows the security fix now blocks, e.g. anonymous users who were supposed to keep a feature, old app versions calling changed endpoints, or migrations that break existing rows. Trace at least one happy path per changed endpoint or function.
- **Compatibility:** database migrations must be additive and safe on existing data (no dropped columns old clients use, defaults for new NOT NULL columns, idempotent where re-run). Check API shape changes that live clients depend on.
- **Platform leaks:** native-only imports reachable from web startup, server-only modules imported into client bundles, and secrets newly referenced in client code.
- **Hygiene:** debug code, `console.log` with data, commented-out blocks, TODOs standing in for fixes, test credentials, files that shouldn't be committed (env files, keys, large binaries, scratch scripts), and unrelated changes mixed in.
- **Repo rules:** everything in CLAUDE.md or contributor docs (commit identity, i18n for new strings, theming, required checks, deploy cautions).

**Verdict:** PASS, or BLOCK with numbered blockers. Each blocker gives the file and line, the failing command and its output (trimmed), and the minimal fix. Non-blocking cleanups go in a separate "nits" list.

---

## Cross-check round (both agents)

When the lead sends you the other gate's report:
- For each of their blockers: **CONFIRM** (you agree, with any extra evidence) or **DISPUTE** (why it isn't a problem, with evidence).
- Add anything their report reveals in your own area. For example, Gate B's failing auth test may mean a fix Gate A passed doesn't actually run. Gate A's bypass may need a test that Gate B should require.
- Restate your final verdict: PASS or BLOCK.

Commit only when both final verdicts are PASS.
