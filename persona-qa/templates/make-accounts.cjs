// Create pre-confirmed throwaway test accounts (Supabase / Postgres reference implementation).
// Adapt the data layer for other stacks; keep the shape: one config in, one accounts file out.
//
//   node make-accounts.cjs <config.json> <out.json>
//
// Run it from a folder where `@supabase/supabase-js` resolves (the project root), or set
//   NODE_PATH=<project>/node_modules
//
// Why: sign-up on a live site sends emails (built-in limits are tiny and example.com bounces),
// so personas log in with accounts that already exist and are confirmed. Sign-up itself is
// tested separately, a few times at most.
//
// config.json
// {
//   "envFile": "C:/path/to/project/.env.local",
//   "urlVar": "NEXT_PUBLIC_SUPABASE_URL",
//   "keyVar": "SUPABASE_SERVICE_ROLE_KEY",
//   "emailDomain": "example.com",
//   "prefix": "qa",
//   "accounts": [
//     { "id": "impatient", "kind": "customer", "name": "QA impatient" },
//     { "id": "admin-impatient", "kind": "staff", "name": "QA admin impatient" }
//   ],
//   "staffRegistry": { "table": "admins", "userColumn": "user_id" }   // optional: staff are rows here
// }
//
// The output file contains passwords. Keep it in the scratchpad, never in the repo.
const fs = require("node:fs");
const { createClient } = require("@supabase/supabase-js");

const [cfgPath, outPath] = process.argv.slice(2);
if (!cfgPath || !outPath) {
  console.error("usage: node make-accounts.cjs <config.json> <out.json>");
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
  for (const a of cfg.accounts) {
    const email = `${cfg.prefix || "qa"}+${a.id}-${stamp}@${cfg.emailDomain || "example.com"}`;
    const password = `Qa-${a.id}-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
    const r = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: a.name || a.id },
    });
    if (r.error) {
      console.error(`could not create ${a.id}: ${r.error.message}`);
      process.exit(1);
    }
    if (a.kind === "staff" && cfg.staffRegistry) {
      const reg = await db.from(cfg.staffRegistry.table).insert({ [cfg.staffRegistry.userColumn]: r.data.user.id });
      if (reg.error) {
        console.error(`could not register ${a.id} as staff: ${reg.error.message}`);
        process.exit(1);
      }
    }
    out.push({ id: a.id, kind: a.kind, email, password, userId: r.data.user.id });
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(out.map((o) => `${o.kind.padEnd(8)} ${o.id.padEnd(20)} ${o.email}`).join("\n"));
})();
