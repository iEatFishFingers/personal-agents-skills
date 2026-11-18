// Invariants runner: read-only consistency checks between simulation rounds.
//
//   node invariants.cjs <config.json> <cast.json> <invariants-module.cjs>
//
// The module is where YOUR rules live (what must always be true). It exports:
//   module.exports = async ({ db, cast, now }) => ({ summary: "one line of counts", problems: ["...", ...] });
// `db` is a service-role Supabase client (read it only), `cast` is the cast array from cast.json,
// and `now` is { date: "YYYY-MM-DD", min: minutes since midnight } in config.timezone.
// See invariants.example.cjs for a booking-style set.
//
// Exit code 1 when any problem is found, so you can chain it. A clean result over several rounds
// is real evidence; a problem is a lead to investigate (it may also be a data artifact: say which).
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const [cfgPath, castPath, modPath] = process.argv.slice(2);
if (!cfgPath || !castPath || !modPath) {
  console.error("usage: node invariants.cjs <config.json> <cast.json> <invariants-module.cjs>");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const cast = JSON.parse(fs.readFileSync(castPath, "utf8")).cast;
process.loadEnvFile(cfg.envFile);
const db = createClient(
  process.env[cfg.urlVar || "NEXT_PUBLIC_SUPABASE_URL"],
  process.env[cfg.keyVar || "SUPABASE_SERVICE_ROLE_KEY"],
  { auth: { persistSession: false } },
);

const tz = cfg.timezone || "UTC";
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const now = { date: `${g("year")}-${g("month")}-${g("day")}`, min: Number(g("hour")) * 60 + Number(g("minute")) };

(async () => {
  const mod = require(path.resolve(modPath));
  const res = await mod({ db, cast, now });
  console.log(`now ${now.date} ${now.min}min (${tz}) | ${res.summary}`);
  if (res.problems.length) {
    console.log(`PROBLEMS (${res.problems.length}):\n  ` + res.problems.join("\n  "));
    process.exitCode = 1; // not process.exit(): on Windows that can trip a libuv assertion after network calls
    return;
  }
  console.log("invariants: all OK");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
