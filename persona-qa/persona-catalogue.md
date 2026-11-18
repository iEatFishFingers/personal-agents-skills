# Persona catalogue

The five base personas in [personas.md](personas.md) suit a consumer app with first-time users. Many products also have staff, owners, returning customers, or no translation. Pick the set that fits the product, ask the owner which matter (Step 0), and run **each persona once per role** when the roles differ.

## Which set to use

| Product | Run these |
|---|---|
| Consumer app, first-time users | The five in personas.md: impatient, skeptic, constrained mobile, non-native speaker, breaker |
| Booking, shop or marketplace with customers and staff | Impatient, skeptic, constrained mobile, breaker, **icon navigator**, plus **staff under pressure** and **regular / power user** |
| Back-office or B2B admin tool | **Staff under pressure**, **skeptical owner**, constrained mobile, **icon navigator**, **role-boundary breaker** |
| Content or media app | The five in personas.md |

Only run the non-native speaker when translation is in scope. If everyone using the product reads English, swap it for the **icon navigator**: the same "who can find the next step from layout alone" test, without the language question.

## Roles
If the product has more than one kind of account (customer, staff, owner), list them in Step 0 and give each persona the credentials for the role it plays. A persona that tests the admin side uses an admin test account. The breaker also gets a **plain customer** account, so it can try to reach staff features from a lower role.

## Variants

### Staff under pressure
**Who:** A member of staff mid-task, phone in one hand, a customer waiting. Gives the tool about 60 seconds for each job and goes back to paper at the first roadblock.
**Browser:** `devices['iPhone 13']`, normal network. Time every step.
**Jobs (one life each):** (1) log in and see what is happening today for them; (2) record something that is happening right now (a walk-in, an order, a ticket); (3) find a named customer's record and change or cancel it.
**Record:** the exact roadblock (screen, seconds, taps), an in-character exit line, `file:line`, a fix. Note anything that forced a re-do after an error.
**Report (under 600 words):** loss points in order, time to value, up to 5 irritations, what held up.

### Skeptical owner
**Who:** The owner. Distrusts software with the business and with customers' data. Reads every screen and asks "what happens if...".
**Browser:** desktop 1280×800.
**Look for:**
- Claims in the UI that don't match what the code does (labels, help text, confirmations, counts, totals).
- Dangerous actions: deleting or deactivating something that has records, changing hours or prices over existing records, cancelling or bulk changes. Is the owner warned, is it reversible, are customers affected, is there a trail of who did it?
- Customer data shown to staff beyond what the job needs. What leaves the browser?
- Whether the screens agree with the data (counts, totals, statuses) and whether config changes really change what customers can do.
- **Money:** every place a price is set, discounted or given away, and whether the totals shown to staff match what customers see.
**Report (under 800 words):** a trust verdict, up to 12 findings as "what you saw vs the reality", data-protection risks, and a short **money notes** list (where could value leak or be lost).

### Regular / power user
**Who:** Someone who has used the product many times. Knows the shortcuts, pushes limits, uses two tabs, books or buys in bulk, and is annoyed by friction that first-timers don't notice.
**Browser:** desktop or phone, as the product's regulars use it.
**Try:** repeating the core flow several times in a row, hitting every limit (caps, one-per-customer rules), the same action from two tabs at once, undoing and redoing, using the browser's back and reload mid-flow, doing everything with the keyboard.
**Report (under 700 words):** limit and race findings with the exact messages, and whether messages say what to do next.

### Icon navigator
**Who:** Someone who navigates by icons, layout, numbers, colour and position, not by reading. (Use when language support is out of scope.)
**Rule:** before each action, write down only what you can see: icons, images, position, numbers, colours. Decide the action from that list. A button whose meaning exists only in words doesn't exist for you, unless its icon or position makes it obvious (a big primary button at the end of a form, a back arrow, + or ×). Destructive and safe actions must be distinguishable without reading. Statuses must be distinguishable by icon or colour.
**Browser:** phone-sized viewport.
**Report (under 600 words):** each core screen rated navigable by icons and position alone (yes / partly / no), the confusing buttons, and the three cheapest wins (usually icons on primary actions and distinct styling for destructive ones).

### Role-boundary breaker
**Who:** Someone who tries to do what their role should not allow. Run it alongside the base breaker, or fold it in.
**Attack:**
1. Signed out and as the **lowest-privilege account**: open every privileged page, and replay every privileged server action or API call from that session (capture the requests from a privileged session, then replay them as the low role). Can the low role read records, change settings or create things?
2. Look at what the error messages reveal: does a wrong password and a right-password-wrong-role give different messages?
3. Does a low-privilege visitor get signed out, redirected, or shown a clear refusal?
4. Stored injection across roles: put markup or script in a field a customer controls, then view it as staff.
5. Read-only ids: try another user's record ids from your own session.
Never test destructive actions on real data; use a clearly named test record.
**Report (under 700 words):** every attempt with the actual result, and a "held up" list.
