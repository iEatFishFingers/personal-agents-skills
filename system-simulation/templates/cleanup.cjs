// Scoped cleanup after a simulation (Supabase / Postgres reference implementation).
//
//   node cleanup.cjs <config.json> <cast.json> [--apply]
//
// DRY RUN BY DEFAULT: prints what it WOULD delete. Read it, then add --apply.
//
// "Scoped" means it only touches rows that belong to the cast (by user id), unowned rows
// created after the run started (for example walk-ins entered by staff), and exact-match rows you
// list under "also". It never runs an unfiltered delete. Broad deletes ("every row with no owner",
// "everything in a table") are exactly what a permission check should block and what can destroy
// real data. If a preview shows rows you don't recognise, STOP and look at them.
//
// Run the ledger and export your numbers BEFORE this: it deletes the data they come from.
//
// config.json
// {
//   "envFile": "...", "urlVar": "...", "keyVar": "...",
//   "tables": [                                         // children before parents
//     { "table": "bookings", "ownerColumn": "user_id", "unownedCreatedAfter": "created_at" },
//     { "table": "memberships", "ownerColumn": "user_id" }
//   ],
//   "also":   [ { "table": "time_off", "column": "reason", "in": ["Sim away", "Sim ill"] } ],
//   "unlink": [ { "table": "barbers", "column": "user_id" } ]   // undo staff-to-resource links
// }
//
// Afterwards: verify that configuration the run changed (prices, hours) is back to the original.
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const [cfgPath, castPath] = args.filter((a) => !a.startsWith("--"));
if (!cfgPath || !castPath) {
  console.error("usage: node cleanup.cjs <config.json> <cast.json> [--apply]");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const castFile = JSON.parse(fs.readFileSync(castPath, "utf8"));
const ids = castFile.cast.map((c) => c.userId);
const since = castFile.startedAt;
process.loadEnvFile(cfg.envFile);
const db = createClient(
  process.env[cfg.urlVar || "NEXT_PUBLIC_SUPABASE_URL"],
  process.env[cfg.keyVar || "SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { persistSession: false } },
);
const count = async (q) => {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.count ?? 0;
};

(async () => {
  console.log(apply ? "APPLYING scoped deletes" : "DRY RUN: nothing will be deleted (add --apply)");
  console.log(`cast accounts: ${ids.length}; run started ${since}`);
  for (const u of cfg.unlink || []) {
    const n = await count(db.from(u.table).select("*", { count: "exact", head: true }).in(u.column, ids));
    console.log(`unlink ${u.table}.${u.column}: ${n} rows`);
    if (apply && n) {
      const r = await db.from(u.table).update({ [u.column]: null }).in(u.column, ids);
      if (r.error) throw new Error(r.error.message);
    }
  }
  for (const t of cfg.tables || []) {
    const owned = await count(db.from(t.table).select("*", { count: "exact", head: true }).in(t.ownerColumn, ids));
    console.log(`${t.table}: ${owned} rows owned by the cast`);
    if (apply && owned) {
      const r = await db.from(t.table).delete().in(t.ownerColumn, ids);
      if (r.error) throw new Error(r.error.message);
    }
    if (t.unownedCreatedAfter) {
      const n = await count(
        db.from(t.table).select("*", { count: "exact", head: true }).is(t.ownerColumn, null).gte(t.unownedCreatedAfter, since),
      );
      console.log(`${t.table}: ${n} unowned rows created after the run started`);
      if (apply && n) {
        const r = await db.from(t.table).delete().is(t.ownerColumn, null).gte(t.unownedCreatedAfter, since);
        if (r.error) throw new Error(r.error.message);
      }
    }
  }
  for (const a of cfg.also || []) {
    const n = await count(db.from(a.table).select("*", { count: "exact", head: true }).in(a.column, a.in));
    console.log(`${a.table} where ${a.column} in [${a.in.join(", ")}]: ${n} rows`);
    if (apply && n) {
      const r = await db.from(a.table).delete().in(a.column, a.in);
      if (r.error) throw new Error(r.error.message);
    }
  }
  for (const c of castFile.cast) {
    if (!apply) { console.log(`would delete account ${c.email}`); continue; }
    const r = await db.auth.admin.deleteUser(c.userId);
    console.log(`${c.email}: ${r.error ? r.error.message : "deleted"}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
