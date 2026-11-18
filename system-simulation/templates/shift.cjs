// Time travel for a simulation: move the cast's records N days EARLIER so a period "passes".
//
//   node shift.cjs <config.json> <cast.json> <days>
//
// <days> must be a multiple of 7 (keeps weekdays, so opening hours still line up).
//
// Choose <days> so the earliest records actually land in the past. A shift that is too small
// leaves "last period's" records still in the future and the roles that depend on them can't act.
//
// config.json (reuse the make-cast config and add "shift")
// {
//   "envFile": "...", "urlVar": "...", "keyVar": "...",
//   "shift": [
//     { "table": "bookings",    "idColumn": "id", "dateColumns": ["booking_date"],
//       "ownerColumn": "user_id", "includeUnowned": true,   // unowned = created by staff (walk-ins)
//       "since": "created_at" },                            // with includeUnowned: only rows created after the run start
//     { "table": "memberships", "idColumn": "id", "dateColumns": ["starts_on", "ends_on"], "ownerColumn": "user_id" },
//     { "table": "time_off",    "idColumn": "id", "dateColumns": ["start_date", "end_date"], "all": true }
//   ]
// }
//
// Rows are updated one at a time in ASCENDING order of the first date column, so that exclusion
// constraints (no overlapping bookings) are never violated part-way through. Rows created
// after a shift are not shifted; mention that as a simulation artifact when it matters.
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

const [cfgPath, castPath, daysArg] = process.argv.slice(2);
const days = Number(daysArg);
if (!cfgPath || !castPath || !Number.isInteger(days) || days % 7 !== 0) {
  console.error("usage: node shift.cjs <config.json> <cast.json> <days (multiple of 7)>");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const castFile = JSON.parse(fs.readFileSync(castPath, "utf8"));
const ids = castFile.cast.map((c) => c.userId);
process.loadEnvFile(cfg.envFile);
const db = createClient(
  process.env[cfg.urlVar || "NEXT_PUBLIC_SUPABASE_URL"],
  process.env[cfg.keyVar || "SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { persistSession: false } },
);
const shift = (d) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() - days);
  return x.toISOString().slice(0, 10);
};

(async () => {
  let errors = 0;
  for (const t of cfg.shift) {
    const first = t.dateColumns[0];
    const cols = [t.idColumn, ...t.dateColumns].join(",");
    const rows = [];
    if (t.all) {
      const r = await db.from(t.table).select(cols).order(first, { ascending: true });
      if (r.error) throw new Error(`${t.table}: ${r.error.message}`);
      rows.push(...r.data);
    } else {
      const owned = await db.from(t.table).select(cols).in(t.ownerColumn, ids).order(first, { ascending: true });
      if (owned.error) throw new Error(`${t.table}: ${owned.error.message}`);
      rows.push(...owned.data);
      if (t.includeUnowned) {
        let q = db.from(t.table).select(cols).is(t.ownerColumn, null);
        if (t.since) q = q.gte(t.since, castFile.startedAt);
        const un = await q.order(first, { ascending: true });
        if (un.error) throw new Error(`${t.table}: ${un.error.message}`);
        rows.push(...un.data);
      }
      rows.sort((a, b) => String(a[first]).localeCompare(String(b[first])));
    }
    let n = 0;
    for (const r of rows) {
      const patch = Object.fromEntries(t.dateColumns.map((c) => [c, shift(r[c])]));
      const u = await db.from(t.table).update(patch).eq(t.idColumn, r[t.idColumn]);
      if (u.error) {
        errors++;
        console.error(`${t.table} ${r[t.idColumn]}: ${u.error.message}`);
      } else n++;
    }
    console.log(`${t.table}: shifted ${n} rows by -${days} days`);
  }
  console.log(errors ? `done with ${errors} errors` : "done, no errors");
  if (errors) process.exitCode = 1; // not process.exit(): avoids a libuv assertion on Windows after network calls
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
