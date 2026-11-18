// Money ledger: how much money moved, how much was given away, how much was lost.
// (Supabase / Postgres reference implementation; adapt the data layer, keep the maths.)
//
//   node ledger.cjs <config.json> [--md]
//
// Run it BEFORE cleanup: cleanup deletes the data these numbers come from.
// If the data is synthetic (a simulation, a seed script) set "synthetic": true; the output is
// then labelled ILLUSTRATIVE and must not be presented as business figures.
//
// config.json (see ledger.example.json)
// {
//   "envFile": "...", "urlVar": "...", "keyVar": "...",
//   "currency": "£", "minorUnit": 100, "synthetic": true,
//   "table": "bookings", "statusColumn": "status", "amountColumn": "total_pence",
//   "dateColumn": "booking_date", "itemColumn": "service_id",
//   "groups": { "realised": ["completed"], "expected": ["confirmed", "pending"], "lost": ["no_show", "cancelled"] },
//   "freeItems": {                      // items charged at 0 but worth money; valued at the list price of another item
//     "priceTable": "services", "idColumn": "id", "priceColumn": "price_pence",
//     "valueAs": { "core": "haircut", "plus": "haircut", "premium": "haircut-beard" }
//   },
//   "recurring": {                      // subscription fees: one fee per row
//     "table": "memberships", "planColumn": "plan", "priceByPlan": { "core": 2999, "plus": 3999, "premium": 6999 }
//   }
// }
//
// The valueAs map and the plan prices are INPUTS: tag them OWNER or ASSUMPTION in the record.
// "Given away" values a free item at list price; the real cost is the delivery cost plus the
// lost chance to sell that capacity, so say which you mean when you present it.
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const cfgPath = args.find((a) => !a.startsWith("--"));
if (!cfgPath) {
  console.error("usage: node ledger.cjs <config.json>");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
process.loadEnvFile(cfg.envFile);
const db = createClient(
  process.env[cfg.urlVar || "NEXT_PUBLIC_SUPABASE_URL"],
  process.env[cfg.keyVar || "SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { persistSession: false } },
);
const cur = cfg.currency || "£";
const unit = cfg.minorUnit || 100;
const money = (n) => `${n < 0 ? "-" : ""}${cur}${(Math.abs(n) / unit).toFixed(2)}`;

async function all(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await db.from(table).select(cols).range(from, from + 999);
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    out.push(...r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}
const weekOf = (d) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};
const table = (head, rows) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

(async () => {
  const cols = [cfg.statusColumn, cfg.amountColumn, cfg.dateColumn, cfg.itemColumn].join(",");
  const rows = await all(cfg.table, cols);
  const g = cfg.groups;
  const inGroup = (name, r) => (g[name] || []).includes(r[cfg.statusColumn]);
  const sum = (list) => list.reduce((n, r) => n + (r[cfg.amountColumn] || 0), 0);

  const realised = rows.filter((r) => inGroup("realised", r));
  const expected = rows.filter((r) => inGroup("expected", r));
  const lost = rows.filter((r) => inGroup("lost", r));

  let prices = {};
  if (cfg.freeItems) {
    const p = await all(cfg.freeItems.priceTable, `${cfg.freeItems.idColumn},${cfg.freeItems.priceColumn}`);
    prices = Object.fromEntries(p.map((x) => [x[cfg.freeItems.idColumn], x[cfg.freeItems.priceColumn]]));
  }
  const valueOfFree = (r) => {
    const f = cfg.freeItems;
    if (!f || (r[cfg.amountColumn] || 0) !== 0) return 0;
    const as = f.valueAs[r[cfg.itemColumn]];
    return as ? prices[as] || 0 : 0;
  };
  const givenAway = realised.reduce((n, r) => n + valueOfFree(r), 0);
  const givenAwayCount = realised.filter((r) => valueOfFree(r) > 0).length;
  const upcomingFree = expected.reduce((n, r) => n + valueOfFree(r), 0);

  let recurring = 0, recurringRows = 0;
  if (cfg.recurring) {
    const m = await all(cfg.recurring.table, cfg.recurring.planColumn);
    recurringRows = m.length;
    recurring = m.reduce((n, r) => n + (cfg.recurring.priceByPlan[r[cfg.recurring.planColumn]] || 0), 0);
  }

  const byItem = {};
  for (const r of realised) {
    const k = r[cfg.itemColumn] || "?";
    (byItem[k] ||= { n: 0, money: 0, free: 0 });
    byItem[k].n++;
    byItem[k].money += r[cfg.amountColumn] || 0;
    byItem[k].free += valueOfFree(r);
  }
  const byWeek = {};
  for (const r of rows) {
    const w = weekOf(r[cfg.dateColumn]);
    (byWeek[w] ||= { done: 0, doneN: 0, lost: 0, lostN: 0 });
    if (inGroup("realised", r)) { byWeek[w].done += r[cfg.amountColumn] || 0; byWeek[w].doneN++; }
    if (inGroup("lost", r)) { byWeek[w].lost += r[cfg.amountColumn] || 0; byWeek[w].lostN++; }
  }

  const out = [];
  if (cfg.synthetic) out.push("> **ILLUSTRATIVE ONLY: synthetic data. These are not business figures.** Use them to check the formulas.\n");
  out.push(`## Money ledger (${rows.length} ${cfg.table} rows)\n`);
  out.push(table(["Measure", "Count", "Amount", "How computed"], [
    ["Money that moved (realised)", realised.length, money(sum(realised)), `${cfg.statusColumn} in [${(g.realised || []).join(", ")}], sum of ${cfg.amountColumn}`],
    ["Booked but not yet realised", expected.length, money(sum(expected)), `${cfg.statusColumn} in [${(g.expected || []).join(", ")}]`],
    ["Lost (no-shows and cancellations)", lost.length, money(sum(lost)), `${cfg.statusColumn} in [${(g.lost || []).join(", ")}], at the price recorded`],
    ...(cfg.freeItems ? [
      ["Given away (realised, valued at list price)", givenAwayCount, money(givenAway), "free items valued at the list price of the mapped item"],
      ["Given away (booked, not yet realised)", expected.filter((r) => valueOfFree(r) > 0).length, money(upcomingFree), "same, for upcoming"],
    ] : []),
    ...(cfg.recurring ? [["Recurring fees (one per row)", recurringRows, money(recurring), "sum of plan price per row"]] : []),
  ]));
  out.push("\n### By item (realised)\n");
  out.push(table(["Item", "Count", "Charged", "Given away value"], Object.entries(byItem).sort((a, b) => b[1].money - a[1].money).map(([k, v]) => [k, v.n, money(v.money), money(v.free)])));
  out.push("\n### By week\n");
  out.push(table(["Week starting", "Realised count", "Realised", "Lost count", "Lost"], Object.entries(byWeek).sort().map(([w, v]) => [w, v.doneN, money(v.done), v.lostN, money(v.lost)])));
  const total = sum(realised) + recurring;
  out.push(`\n**Total money that moved (realised + recurring): ${money(total)}.** Given away at list price: ${money(givenAway)}${total ? ` (${((givenAway / total) * 100).toFixed(0)}% of that)` : ""}.`);
  console.log(out.join("\n"));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
