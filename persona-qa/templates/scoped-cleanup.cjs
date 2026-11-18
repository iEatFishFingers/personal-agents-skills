// Scoped cleanup of test data (Supabase / Postgres reference implementation).
//
//   node scoped-cleanup.cjs <config.json> [--apply]
//
// DRY RUN BY DEFAULT: it prints what it WOULD delete. Add --apply to delete.
//
// What "scoped" means: it only ever touches rows that belong to the test accounts, or rows
// with no owner that were created after the run started. It never runs an unfiltered delete.
// A broad delete ("every row with no owner", "every row in a table") is exactly what a
// permission check should block, and what can destroy real data. Preview, then apply.
//
// config.json
// {
//   "envFile": "C:/path/to/project/.env.local",
//   "urlVar": "NEXT_PUBLIC_SUPABASE_URL", "keyVar": "SUPABASE_SERVICE_ROLE_KEY",
//   "emailPattern": "^qa\\+.*@example\\.com$",        // which auth users are test accounts
//   "since": "2026-11-18T18:39:00Z",                  // run start (UTC); unowned rows older than this are kept
//   "tables": [                                       // order matters: children before parents
//     { "table": "bookings", "ownerColumn": "user_id", "unownedCreatedAfter": "created_at" },
//     { "table": "memberships", "ownerColumn": "user_id" }
//   ],
//   "also": [                                         // other rows you created, deleted by exact match
//     { "table": "time_off", "column": "reason", "in": ["QA away", "QA ill"] }
//   ],
//   "unlink": [                                       // set a column to null where it points at a test account
//     { "table": "barbers", "column": "user_id" }
//   ]
// }
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const cfgPath = args.find((a) => !a.startsWith("--"));
if (!cfgPath) {
  console.error("usage: node scoped-cleanup.cjs <config.json> [--apply]");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
process.loadEnvFile(cfg.envFile);
const db = createClient(
  process.env[cfg.urlVar || "NEXT_PUBLIC_SUPABASE_URL"],
  process.env[cfg.keyVar || "SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { persistSession: false } },
);
const re = new RegExp(cfg.emailPattern);

const count = async (q) => {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r.count ?? 0;
};

(async () => {
  console.log(apply ? "APPLYING deletes (scoped)" : "DRY RUN: nothing will be deleted (add --apply)");
  const users = [];
  for (let page = 1; ; page++) {
    const r = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (r.error) throw new Error(r.error.message);
    users.push(...r.data.users);
    if (r.data.users.length < 200) break;
  }
  const test = users.filter((u) => re.test(u.email || ""));
  const ids = test.map((u) => u.id);
  console.log(`test accounts matching ${cfg.emailPattern}: ${test.length}`);

  for (const u of cfg.unlink || []) {
    if (!ids.length) break;
    const n = await count(db.from(u.table).select("*", { count: "exact", head: true }).in(u.column, ids));
    console.log(`unlink ${u.table}.${u.column}: ${n} rows`);
    if (apply && n) await db.from(u.table).update({ [u.column]: null }).in(u.column, ids);
  }
  for (const t of cfg.tables || []) {
    if (ids.length) {
      const n = await count(db.from(t.table).select("*", { count: "exact", head: true }).in(t.ownerColumn, ids));
      console.log(`${t.table}: ${n} rows owned by test accounts`);
      if (apply && n) {
        const r = await db.from(t.table).delete().in(t.ownerColumn, ids);
        if (r.error) throw new Error(r.error.message);
      }
    }
    if (t.unownedCreatedAfter && cfg.since) {
      const n = await count(
        db.from(t.table).select("*", { count: "exact", head: true }).is(t.ownerColumn, null).gte(t.unownedCreatedAfter, cfg.since),
      );
      console.log(`${t.table}: ${n} unowned rows created after ${cfg.since}`);
      if (apply && n) {
        const r = await db.from(t.table).delete().is(t.ownerColumn, null).gte(t.unownedCreatedAfter, cfg.since);
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
  if (apply) for (const u of test) {
    const r = await db.auth.admin.deleteUser(u.id);
    console.log(`${u.email}: ${r.error ? r.error.message : "deleted"}`);
  }
  else for (const u of test) console.log(`would delete account ${u.email}`);
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1; // not process.exit(): avoids a libuv assertion on Windows after network calls
});
