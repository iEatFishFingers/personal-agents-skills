# Results record template

Write one record per run, in the project, at `docs/qa/<YYYY-MM-DD>-<type>.md` (type = `persona-qa`, `retest`, `simulation`). Keep it short and factual. It must be useful to someone who wasn't there.

**Save it BEFORE cleanup.** Cleanup deletes the data that numbers come from. Export anything you will want later (ledger output, counts, logs summary) first, then clean up.

Rules for the record:
- No secrets, passwords, keys or real customer data. Test account emails may be listed as a pattern, not individually.
- Public repo: say plainly what a reader would see. Ask the owner before committing a record that describes unfixed security findings.
- Every number carries a provenance tag: **DATA / OWNER / ASSUMPTION / UNKNOWN** (see business-impact.md).

```markdown
# <Project>: QA record, <date>

**Type:** persona-qa | retest | simulation  **Tier:** quick | standard | deep
**Commit tested:** <short hash>  **Target:** <local | staging | production URL>
**Run by:** lead + <n> agents (<personas or roles>)

## Scope
- In scope: <areas>
- Off limits (not changed or not judged): <e.g. cloned pages, third-party embeds>
- Out of scope by owner choice: <e.g. translation>

## Business context
| Input | Value | Provenance |
|---|---|---|
| What is sold / list prices | | OWNER |
| Volume (per month) | | OWNER / UNKNOWN |
| Average ticket | | OWNER / DATA / UNKNOWN |
| Capacity | | OWNER |
| Margin per unit | | OWNER / UNKNOWN |
| Cost of an unhappy customer | | OWNER / ASSUMPTION |
| How money is collected today | | OWNER |

## Money map
<charge points, giveaways, built-in losses, recurring flows, controls>

## Findings
| ID | Title | Severity | Evidence | Found by | Loss type | £ / month (low / likely / high) | Confidence | Status |
|---|---|---|---|---|---|---|---|---|

## What if X broke
| Scenario | Blast radius | Noticed in | Recovery | £ range | Provenance |
|---|---|---|---|---|---|

## Top five by monthly exposure
1. ...

## Simulation ledger (simulation runs only)
<output of the ledger template: money that moved, given away, lost to no-shows and cancellations, subscription revenue; say clearly if the data is synthetic>

## What held up
- ...

## Decisions needed from the owner
- ...

## Unknowns the owner must fill
| Question | Why it matters | Changes which number |
|---|---|---|

## Caveats
<test artifacts, simulation artifacts, things not tested>

## Cleanup record
- Created: <accounts, rows, config changes>
- Removed: <what, how it was scoped>
- Left in place: <what and why>
```
