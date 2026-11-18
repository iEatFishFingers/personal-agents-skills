# Business impact: turning findings into money

A bug list says what is broken. The owner also needs to know **how much money moves through the system and how much could be lost if a given thing broke**. This guide shows how to capture that without inventing numbers.

## The one rule: never invent a number
Every figure in the report carries a provenance tag:

| Tag | Meaning |
|---|---|
| **DATA** | Computed from the real database or ledger (state the query or script). |
| **OWNER** | The owner told you (note when). |
| **ASSUMPTION** | Your estimate, with the reason and a low / likely / high range. |
| **UNKNOWN** | Not known. Name the missing input and show the formula with that input as a parameter. |

Synthetic or example data (a simulation, a seed script) is **never** a business figure. Use it only to check that the formulas work, and label it that way.

## Step A: ask the owner once, in setup
Keep it to the questions you need. Accept "I don't know".
1. **What is sold, and at what prices?** One-off items, subscriptions or memberships, add-ons, deposits.
2. **How much, how often?** Transactions per day or month, the average ticket, how many are repeat customers, the busy and quiet periods.
3. **Capacity.** Staff, opening hours, the maximum number of units that can be sold. A lost slot is only a real loss if the slot would otherwise have sold.
4. **Margin.** What each unit costs to deliver, so you can tell a lost sale from a lost profit.
5. **The cost of an unhappy customer.** Refund or compensation habits, and how long a customer usually stays (lifetime value).
6. **How money is collected today.** Online, in person, later. Anything collected by hand is a leak risk.
7. **Obligations.** Refund rights, consumer or data-protection rules where a breach carries a penalty.

If the owner can't answer, derive what you can from the data (see the ledger template in the simulation skill) and list the rest under "Unknowns the owner must fill".

## Step B: draw the money map
List, in a few lines each, where money moves in the system:
- **Charge points:** where a price is set and where it is charged.
- **Giveaways:** free items, discounts, member benefits, comps. Value each at list price.
- **Losses that happen without a bug:** cancellations, no-shows, expired items.
- **Recurring flows:** subscription fees.
- **Controls:** what stops leakage (a limit, a database constraint, a manual check).

## Step C: cost each finding
For each finding give:

| Field | What to write |
|---|---|
| **Loss type** | Revenue lost, revenue leaked (given away), cost incurred (refund or comp), compliance exposure, or churn |
| **Formula** | e.g. `extra free items per member per month × list price × members` |
| **Driver** | What makes it happen more often |
| **Per occurrence** | £ low / likely / high, with provenance tags |
| **Per month** | £ low / likely / high |
| **Confidence** | High, medium or low |

Some findings have no direct money effect (wording, accessibility). Say "no direct money effect" and still note the trust cost if it applies.

## Step D: ask "what if this broke?"
For the main failure scenarios, estimate **blast radius, how long before anyone notices, how long to recover, and the money range**. The standard list:

1. A price or total is wrong for a day.
2. The same capacity is sold twice (double booking, overselling).
3. A limit can be bypassed (caps, one-per-customer rules).
4. A free or discounted benefit is abused.
5. Collection fails (payment, deposit, hand-collection forgotten).
6. A notification doesn't reach a customer when it should.
7. The system is down at peak for N hours.
8. Data is lost or can't be restored.
9. A staff error is made at scale (bulk cancel, wrong hours saved).
10. A no-show or late cancellation can't be charged.

Add scenarios specific to the product. Estimate each as a range, not a point.

## Step E: present it
- A one-page **exposure table**: scenario or finding, monthly range, provenance, confidence. Put the top five by monthly range first.
- A **"what would change my mind"** note for each big number (the one input that would shrink or grow it).
- A list of **unknowns the owner must fill**, with the exact question for each.
- Compare each fix with the exposure it removes, so the order of fixes follows the money.

## Pitfalls
- **False precision.** A range with provenance beats a single figure.
- **Double counting.** Scenarios overlap. Don't add them together unless you've checked.
- **Mixing synthetic and real data.** Label simulation figures "illustrative".
- **Treating a free benefit's list price as a cost.** A free item costs the delivery cost (and the lost chance to sell it), not necessarily its list price. State which you used.
- **Leaving it to the end.** Capture the owner's answers in setup, because the personas and the simulation can then flag money-relevant findings as they go.
