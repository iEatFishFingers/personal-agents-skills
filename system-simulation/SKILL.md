---
name: system-simulation
description: Simulate a working period (a week, a month) on a running system with a cast of agents playing many roles at the same time (customers, staff, owner), advance simulated time between rounds, check the data against invariants after every round, and record what broke and how much money it could cost. Works for any multi-role system (bookings, shops, tickets, queues, memberships), not just SaaS. Use when the user asks to "simulate a month", "run users and admins at the same time", "stress the business rules with many people", "see where bugs appear in real use", or wants a month-end review with money numbers. For one persona at a time on a single flow, use persona-qa instead.
---

# System simulation

Single-persona testing finds friction in one flow. A **simulation** finds what breaks when many people, in different roles, use the same system at the same moment over time: collisions for scarce things, limits that hold or leak, staff actions that surprise customers, numbers that disagree between screens, and what the whole thing means in money.

You are the **lead**. You don't play a role. You:
1. scope the run and get the money context from the owner
2. design the cast, the periods, the time model and the invariants
3. set up accounts and tools
4. run the periods in rounds, checking the data between rounds
5. review the "month", cost the findings, record the results, and clean up (scoped)

## Arguments
- **No argument:** a 4-period run with about 10 agents (about 8 customers and 2 staff).
- **`periods N`:** number of simulated periods (default 4; a "week" each is the usual unit).
- **`cast N`:** cast size. Cost grows with cast × periods; 10 × 4 is already large. Offer a smaller version first (6 × 2) when the budget is unclear.
- **`plan`:** produce the plan (roles, scripts, invariants, time model) and stop for approval.
- **`no-money`:** skip the business-impact work (default is to do it).

## Step 0: Scope it with the owner
Ask only what you can't read from the repo.
1. **Environment.** Local, staging or production? Production needs explicit permission, no real payments, no load testing, and every record tracked for scoped removal.
2. **Off limits.** What must not change (cloned or third-party parts, real customer data)?
3. **Money.** Run the interview in [business-impact.md](business-impact.md): prices, volume, capacity, margin, cost of an unhappy customer, how money is collected. Record answers with provenance. Unknowns become questions in the final record.
4. **What counts as a bug here.** Which rules does the owner care most about (limits, prices, hours, who can see what)? These become invariants.

## Step 1: Design the run (write it down, show it if `plan`)

**Cast.** Pick roles that **collide on purpose**. Cover at least:
- a regular who uses the product as intended, and a premium or subscribed user
- a one-off user with no subscription
- someone who changes their mind (books, cancels, rebooks)
- someone who hits every limit, from two tabs
- someone who competes for the scarce resource (the same busy slots, the same stock)
- someone who never shows up or never pays
- someone who leaves and deletes their account
- **staff**: one who works the day (marks outcomes, records walk-ins) and one owner who changes configuration mid-run (hours, prices, time off, availability)

Write each role's script one period at a time (see [role-scripts.md](role-scripts.md)): a goal, a character, and 1–3 actions per period, including one boundary probe.

**Invariants.** List what must ALWAYS be true, from the rules the owner gave and the code you read: no double booking or overselling, caps hold, free items never charged and paid items never free, totals match the price list at the time, audit fields are filled, statuses move only along allowed paths, ownership and deletion rules hold, limits per customer hold. Write them as an invariants file for [templates/invariants.cjs](templates/invariants.cjs). **This is the ground truth**: agents can misread a screen, the database can't.

**Time model.** The real clock does not move. Simulate periods by moving the data, not time:
- Choose a shift (a multiple of 7 days keeps weekdays) that actually brings the earliest records into the past. A shift that is too small leaves "last period's" records still in the future, and the roles whose script depends on them can't act (this happened).
- Shift everything the roles created (records, subscriptions, time off) with [templates/shift.cjs](templates/shift.cjs). Things created after a shift are not shifted, so subscriptions or records made later will look out of step; note it as a simulation artifact.
- State what cannot be simulated (billing cycles, expiries that depend on the real clock) and don't pretend otherwise.

**Money checks.** Decide which numbers the ledger will report at the end ([templates/ledger.cjs](templates/ledger.cjs)): money that moved, value given away (free or discounted items at list price), value lost to no-shows and cancellations, recurring revenue. Mark simulation money as illustrative.

## Step 2: Set up

1. **Pre-flight the tools** (Playwright check, one shared install, one folder per agent, explicit viewports). See persona-qa's setup notes.
2. **Create the cast** with [templates/make-cast.cjs](templates/make-cast.cjs): pre-confirmed accounts, staff registered, any staff-to-resource links. Write the accounts file to the scratchpad (it holds passwords; never the repo).
3. **Write the shared brief** from [brief-template.md](brief-template.md) and save it as a file all agents read.
4. **Create the logs folder** (one JSON-lines log per agent, so agents never write the same file).
5. **Baseline check:** run the invariants runner on the empty (or starting) state. Anything pre-existing must be ignored explicitly and noted.
6. **Record the run start time** (UTC). Scoped cleanup needs it.

## Step 3: Run the periods

For each period:
1. **Launch.** Round 1: spawn every agent in ONE message, in the background, as `general-purpose` subagents (model sonnet is fine), each with: the brief path, its role id and credentials, its character, its full month script, and "do only the current period". Later rounds: `SendMessage` to each agent: "Start period N", what changed (data moved, others' actions it should expect), and any extra step it couldn't do before.
2. **Wait for ALL reports.** Don't poll; give one-line status updates ("4 of 10 back") and add facts only when something is new. Do **not** shift data or start the next period while any agent is still acting, even if the user says to carry on. Say why and offer to proceed without a straggler only if the user asks.
3. **Read the reports** and spot-check anything surprising against the database. Agents guess at causes; explain them (e.g. "that booking was cancelled by the owner in period 2"), because the explanation is often a finding in itself ("the customer was never told").
4. **Run the invariants.** Any problem is a lead to investigate. A clean run over many periods is real evidence, state it.
5. **Shift the data** (`shift.cjs`), re-run the invariants, then start the next period.

Keep your messages to the user short during the run: one line per report, a short note on anything notable. Repeating the same finding every update is noise; keep a running list and say "already on the list".

## Step 4: The month-end review
1. **Final invariants** and a data summary (counts by status, by role).
2. **Aggregate the logs** (outcomes per role and per period: ok, refused, odd). Refusals are mostly the rules working: say which rules fired and whether any legitimate action was refused.
3. **Run the ledger** ([templates/ledger.cjs](templates/ledger.cjs)). Label it synthetic.
4. **Merge the findings**: dedupe across agents; separate **product bugs** from **simulation artifacts** (a script premise that didn't hold, a shift quirk); rank (must fix, should fix, can wait); keep a **Your call** list for policy questions; keep an off-limits bucket.
5. **Cost them** with [business-impact.md](business-impact.md): money map, per-finding exposure ranges with provenance tags, "what if X broke" scenarios, top five by monthly exposure, the questions the owner must answer. Plan economics matter as much as bugs: e.g. an "unlimited" benefit used to its limit can cost more than the fee, even with no bug at all. Work it out from the rules.
6. **Say what held up** and **what was not tested**.

## Step 5: Record, then clean up (in this order)
1. Write the record from [results-template.md](results-template.md) to the project at `docs/qa/<date>-simulation.md`. **Export the ledger and counts first**: cleanup deletes the data they come from.
2. Run [templates/cleanup.cjs](templates/cleanup.cjs) as a **dry run**, read what it will delete, then `--apply`. Scope it by the cast's ids and the run start time. Never run an unfiltered delete (a broad delete will, rightly, be blocked, and can destroy real data).
3. Verify what remains: the owner's own records, configuration back to the original (prices, hours), staff-to-resource links removed, nothing from the cast left.
4. Ask before committing a record that describes unfixed security findings to a public repo.

## Rules every agent gets
- Use only your own account; act at human speed; no load testing; no attacks.
- Don't edit project files, read `.env*`, or use any key other than your login.
- Log every meaningful action with the exact on-screen message and the reference.
- Tell the lead whether a person would notice what you saw (separate test artifacts from real problems).
- State your premises. If a premise doesn't hold (the data isn't where the script says), say so instead of improvising.
- Stop after each period's report and wait.

## Gotchas learned in practice
- **Wait for everyone** before shifting time, or you move data under agents mid-task and lose their results.
- **Scripts assume a world.** Agents hit "the thing I was meant to test isn't possible" when the time shift didn't line up. Check each role's period-N premise against the post-shift data before sending.
- **Agents mis-blame causes.** Cross-check "who cancelled this?" and "why is this status X?" against the database and the other agents' logs.
- **Staff can't know who really attended**, so they'll mark everyone completed. That's a process finding (nothing helps staff close out), not a code bug.
- **The most valuable findings were communication gaps**, not logic bugs: customers never told about staff actions, "contact the shop" with no contact details, past records still showing "confirmed", stale-tab overwrites. Look for them deliberately.
- **Record the money before cleanup.** A month of data is gone once you clean up.
- **Same-key and two-tab races recur** across create and update paths.
- **Large casts are expensive.** Start small unless the owner asks for scale.
