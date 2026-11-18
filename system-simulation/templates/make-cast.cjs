// Create the simulation cast: pre-confirmed accounts for every role (Supabase / Postgres
// reference implementation; adapt the data layer for other stacks and keep the shape).
//
//   node make-cast.cjs <config.json> <cast.json>
//
// Run from the project root or set NODE_PATH=<project>/node_modules so `@supabase/supabase-js` resolves.
//
// config.json
// {
//   "envFile": "C:/path/to/project/.env.local",
//   "urlVar": "NEXT_PUBLIC_SUPABASE_URL", "keyVar": "SUPABASE_SERVICE_ROLE_KEY",
//   "emailDomain": "example.com", "prefix": "sim",
//   "cast": [
//     { "id": "c1-regular", "kind": "customer", "name": "Example Customer", "phone": "07700900000" },
//     { "id": "s1-owner",   "kind": "staff",    "name": "Sim Owner" },
//     { "id": "s2-worker",  "kind": "staff",    "name": "Sim Worker", "link": { "table": "staff_profiles", "matchColumn": "id", "matchValue": "profile-1", "setColumn": "user_id" } }
//   ],
//   "staffRegistry": { "table": "admins", "userColumn": "user_id" }
// }
//
// `link` points a staff account at an existing row (for example the person they are in the
// system) so features that default to "my own" can be tested. cleanup.cjs unlinks it again.
// The output file contains passwords: keep it in the scratchpad, never in the repo.
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

const [cfgPath, outPath] = process.argv.slice(2);
if (!cfgPath || !outPath) {
  console.error("usage: node make-cast.cjs <config.json> <cast.json>");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
process.loadEnvFile(cfg.envFile);
const url = process.env[cfg.urlVar || "NEXT_PUBLIC_SUPABASE_URL"];
const key = process.env[cfg.keyVar || "SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) {
  console.error("missing Supabase URL or service key in the env file");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const stamp = String(Date.now()).slice(-6);
  const out = [];
  for (const a of cfg.cast) {
    const email = `${cfg.prefix || "sim"}+${a.id}-${stamp}@${cfg.emailDomain || "example.com"}`;
    const password = `${a.kind === "staff" ? "SimStaff" : "Sim"}-${a.id}-${stamp}`;
    const meta = { full_name: a.name || a.id, ...(a.phone ? { phone: a.phone } : {}) };
    const r = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
    if (r.error) {
      console.error(`could not create ${a.id}: ${r.error.message}`);
      process.exit(1);
    }
    const userId = r.data.user.id;
    if (a.kind === "staff" && cfg.staffRegistry) {
      const reg = await db.from(cfg.staffRegistry.table).insert({ [cfg.staffRegistry.userColumn]: userId });
      if (reg.error) {
        console.error(`could not register ${a.id} as staff: ${reg.error.message}`);
        process.exit(1);
      }
    }
    if (a.link) {
      const l = await db.from(a.link.table).update({ [a.link.setColumn]: userId }).eq(a.link.matchColumn, a.link.matchValue);
      if (l.error) {
        console.error(`could not link ${a.id}: ${l.error.message}`);
        process.exit(1);
      }
    }
    out.push({ id: a.id, kind: a.kind, name: a.name, phone: a.phone || null, email, password, userId });
  }
  fs.writeFileSync(outPath, JSON.stringify({ startedAt: new Date().toISOString(), cast: out }, null, 2));
  console.log(out.map((o) => `${o.kind.padEnd(8)} ${o.id.padEnd(22)} ${o.email}`).join("\n"));
  console.log(`run start recorded: ${new Date().toISOString()}`);
})();
