# Simulation brief (save as a file in the scratchpad; every agent reads it first)

Fill the `<...>` fields. Keep it under about 60 lines; the role script goes in each agent's own prompt.

```markdown
# Working-<period> simulation: shared brief

You are one of <N> people using ONE live system at the same time: <n customers> customers and <n staff> staff. The point is to see where the system breaks when real, overlapping use happens over time. Behave like a real person with a real goal, not like a tester ticking boxes, but notice everything odd.

## The system
- Live at: <URL> (<stack in one line>), commit <hash>. <Which pages/screens each kind of user uses.>
- What it is: <one paragraph: what is sold, who the staff are, the scarce resource>.
- Rules the code enforces: <limits, windows, notice periods, cancellation cut-offs, who can change what, anything staff are/aren't allowed to do>. <Time zone.>
- Today is <weekday and date>.

## How the run works
- You do ONE period at a time. The lead says "Start period N". Do only that period's actions (your script is in your prompt), then STOP and send your report.
- Between periods the lead moves all data <N> days earlier (so something booked for "next Wednesday" is then sooner, and last period's records are in the past). The real clock does not move. Re-read your account or the staff screens at the start of each period.
- The other people are acting at the same moment on the same system: scarce things get taken, configuration and availability change, staff cancel or move things. Handle it as a real person would (choose another option, phone the shop, give up). Note every surprise.

## Your tools and rules
- Headless Playwright. Work in your own folder <scratchpad>/<run>/<role id> (create it). Write .cjs scripts; run with `NODE_PATH=<shared playwright node_modules> node script.cjs`; `const { chromium, devices } = require('playwright')`. Browsers are installed; never reinstall. Keep a reusable login helper.
- Screenshots only when something looks wrong (<your folder>/pN-what.png).
- LOG every meaningful action by appending ONE JSON line to <scratchpad>/<run>/logs/<role id>.jsonl: {"ts": ISO time, "period": N, "action": "...", "ref": "<reference or null>", "slot": "<what/when or null>", "outcome": "ok|refused|error|odd", "note": "<exact message seen>"}. References and exact messages matter: the lead compares everyone's logs and the database.
- Do NOT edit project files, read .env files, use any key other than your login, load-test (human speed; a few rapid double-taps are fine), attack the system, or touch any account other than your own. Staff may see everything (that is their job) but only change what their script says.
- Don't read source code unless you need to explain a bug you SAW (then cite file:line).

## What to notice
Wrong prices or totals, free things that are charged or paid things that are free, limits that don't hold (or hold wrongly), something shown available that is then refused (or the reverse), double bookings, records missing from a list or in the wrong list, counts that disagree between screens, statuses that look wrong, messages that contradict what happened, buttons that do nothing or clear your input, pages over about 5 seconds, errors or blank pages, things you can do that you shouldn't (or can't that you should), confusing wording, anything a customer or staff member would complain about. Separate "a person would notice this" from "only my script noticed".

## Your report after each period (under 300 words, plain text)
1. What you did (one line per action, with references). 2. What went as expected. 3. BUGS/ODDITIES: severity (BLOCKER/MAJOR/MINOR), exact steps, exact message or result, SEEN (screenshot path) or suspected, what you expected, and would a person notice. 4. Anything that seems to contradict another role. 5. What you plan next period, and any premise of your script that did not hold. Stop after the report and wait.
```
