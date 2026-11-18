// Wiki checker for the codebase-wiki skill. Node >= 18, no dependencies.
//
//   node check-wiki.mjs <repoRoot> [options]
//
// Options (all optional):
//   --wiki <path>          wiki folder relative to the repo         (default: docs/wiki)
//   --index "<title>"      title of the hub every note must link from (default: 00 Index)
//   --min-links <n>        minimum [[wikilinks]] per note            (default: 8)
//   --exclude <a,b,c>      path prefixes NOT required to be covered  (default: docs,knowledge,evals,status.md)
//   --cover <a,b,c>        only require coverage under these prefixes/files (default: every tracked
//                          source file except images, fonts, lockfiles and --exclude)
//   --secret <str,str>     extra literal strings that must never appear (project ref, email, ...)
//   --meta <name>          folder excluded from coverage counting    (default: _meta)
//
// Exit code is 1 if any counter is non-zero. Run it from anywhere; it only reads.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const repo = argv[0];
if (!repo || repo.startsWith("--")) {
  console.error("usage: node check-wiki.mjs <repoRoot> [--wiki docs/wiki] [--index \"00 Index\"] [--min-links 8] [--exclude docs,knowledge,evals,status.md] [--cover app,lib] [--secret a,b] [--meta _meta]");
  process.exit(2);
}
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

const wikiRel = opt("wiki", "docs/wiki").replace(/\\/g, "/").replace(/\/$/, "");
const indexTitle = opt("index", "00 Index");
const minLinks = Number(opt("min-links", "8"));
const exclude = list(opt("exclude", "docs,knowledge,evals,status.md"));
const coverOnly = list(opt("cover", ""));
const extraSecrets = list(opt("secret", ""));
const metaDir = opt("meta", "_meta");

const wiki = path.join(repo, ...wikiRel.split("/"));
if (!fs.existsSync(wiki)) {
  console.error(`wiki folder not found: ${wiki}`);
  process.exit(2);
}

// ---- collect notes ----
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) files.push(p);
  }
})(wiki);

const fails = {
  brokenLinks: [],
  brokenHeadingLinks: [],
  dupTitles: [],
  illegal: [],
  orphans: [],
  notInIndex: [],
  fewLinks: [],
  noFrontmatter: [],
  uncovered: [],
  secrets: [],
};

const titles = new Map();
const headings = new Map();
const stripCode = (s) => s.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

for (const f of files) {
  const t = path.basename(f, ".md");
  if (titles.has(t)) fails.dupTitles.push(t);
  titles.set(t, f);
  if (/[\/\\:#^\[\]|]/.test(t)) fails.illegal.push(t);
}

const inbound = new Map([...titles.keys()].map((t) => [t, new Set()]));
const linkRe = /\[\[([^\]]+?)\]\]/g;
let cover = "";
const texts = new Map();

for (const f of files) {
  const t = path.basename(f, ".md");
  const txt = fs.readFileSync(f, "utf8");
  texts.set(f, txt);
  headings.set(
    t,
    new Set(
      txt
        .replace(/```[\s\S]*?```/g, "")
        .split(/\r?\n/)
        .filter((l) => /^#{1,6} /.test(l))
        .map((l) => l.replace(/^#+ /, "").trim().toLowerCase()),
    ),
  );
  if (!f.includes(`${path.sep}${metaDir}${path.sep}`)) cover += "\n" + txt;
}

for (const f of files) {
  const t = path.basename(f, ".md");
  const txt = texts.get(f);
  if (!/^---\r?\n[\s\S]*?\barea:[\s\S]*?\bsource:[\s\S]*?\bcommit:[\s\S]*?\bupdated:[\s\S]*?\r?\n---/.test(txt)) {
    fails.noFrontmatter.push(t);
  }
  // Template examples live in code fences/inline code: don't count them.
  const body = stripCode(txt);
  let n = 0;
  for (const m of body.matchAll(linkRe)) {
    n++;
    const raw = m[1];
    const target = raw.split("|")[0].split("#")[0].trim();
    if (!titles.has(target)) fails.brokenLinks.push(`${t} -> [[${raw}]]`);
    else if (target !== t) inbound.get(target).add(t);
    const hashPart = raw.split("|")[0].split("#")[1];
    if (hashPart && titles.has(target)) {
      if (!headings.get(target).has(hashPart.trim().toLowerCase())) fails.brokenHeadingLinks.push(`${t} -> [[${raw}]]`);
    }
  }
  if (n < minLinks) fails.fewLinks.push(`${t} (${n})`);
}

for (const [t, s] of inbound) {
  if (t === indexTitle) continue;
  if (s.size === 0) fails.orphans.push(t);
  if (!s.has(indexTitle)) fails.notInIndex.push(t);
}

// ---- coverage: every tracked source file is mentioned by FULL path in some non-meta note ----
let tracked = [];
try {
  tracked = execSync("git ls-files", { cwd: repo, maxBuffer: 1 << 26 }).toString().split("\n").filter(Boolean);
} catch {
  console.error("warning: git ls-files failed; coverage skipped");
}
const skipExt = /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|lock)$/i;
const skipName = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/;
const want = tracked.filter((p) => {
  if (p.startsWith(wikiRel + "/")) return false;
  if (skipExt.test(p) || skipName.test(p)) return false;
  if (exclude.some((x) => p === x || p.startsWith(x.replace(/\/$/, "") + "/"))) return false;
  if (coverOnly.length && !coverOnly.some((x) => p === x || p.startsWith(x.replace(/\/$/, "") + "/"))) return false;
  return true;
});
const norm = cover.replace(/\\/g, "/");
for (const p of want) {
  if (norm.includes(p)) continue;
  // Allow a folder glob mention ("components/booking/*") together with the bare filename.
  const dir = path.posix.dirname(p);
  const base = path.posix.basename(p);
  const globbed = norm.includes(dir + "/*") || norm.includes(dir + "/**");
  if (globbed && norm.includes(base)) continue;
  fails.uncovered.push(p);
}

// ---- secrets / personal data ----
const secretRes = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT-like token"],
  [/sb_(secret|publishable)_[A-Za-z0-9]/, "Supabase key prefix"],
  [/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/, "Stripe-style key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key block"],
  [/(KEY|SECRET|PASSWORD|TOKEN)\s*=\s*[^\s`|]{6,}/i, "KEY=value assignment"],
  [/password\s*[:=]\s*["'][^"']+["']/i, "password literal"],
  [/https:\/\/[a-z0-9]{20}\.supabase\.co/, "Supabase project URL"],
];
for (const f of files) {
  const txt = texts.get(f);
  const name = path.basename(f);
  for (const [re, label] of secretRes) {
    const m = txt.match(re);
    if (m) fails.secrets.push(`${name}: ${label}: ${m[0].slice(0, 12)}...`);
  }
  for (const s of extraSecrets) if (txt.includes(s)) fails.secrets.push(`${name}: forbidden string "${s.slice(0, 3)}..."`);
}

// ---- report ----
console.log(`notes: ${files.length}`);
let bad = 0;
for (const [k, v] of Object.entries(fails)) {
  console.log(`${k}: ${v.length}${v.length ? "\n  " + v.join("\n  ") : ""}`);
  bad += v.length;
}
console.log(bad === 0 ? "RESULT: PASS" : `RESULT: FAIL (${bad} problems)`);
process.exit(bad === 0 ? 0 : 1);
