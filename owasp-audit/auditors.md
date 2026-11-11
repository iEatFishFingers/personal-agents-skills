# Auditor blocks

Copy one block in full into each auditor's prompt, together with the shared brief, the rules of engagement and the output contract from SKILL.md. Each block says what the auditor owns, where to look and what to try. Owning an area means hunting it to the end: if you find something outside your area, note it in one line for the lead and move on.

OWASP references: Web Top 10 (2025) as `A01`–`A10`, Mobile Top 10 (2024) as `M1`–`M10`.

---

## 1. Access Control Auditor (A01, M3 authorization)

**You own:** whether every piece of data and every action is limited to the users who should have it.

**Hunt:**
- **Object-level access (IDOR):** every route, RPC or query that takes an ID from the client (book, chapter, user, task, file, token). Can user A read, change or delete user B's object by changing the ID? Trace the ownership check to the server or database, not the client.
- **Database policies:** for each table, check RLS on/off, each policy's `USING` and `WITH CHECK` clauses, and which roles they apply to (anon vs authenticated). `USING (true)`, missing `WITH CHECK` on insert and update, and tables with no policies but RLS off are all red flags. Check views too: they may bypass RLS.
- **Privileged functions:** SECURITY DEFINER functions and service-role code paths. Do they scope by the caller (`auth.uid()`), set a fixed `search_path`, and refuse when the caller is anonymous? Which roles can execute them?
- **Function-level access:** admin, debug, analytics and maintenance endpoints. Are they reachable without an admin check? Look for hidden routes and leftover test endpoints.
- **Optional-auth and anonymous endpoints:** what can an unauthenticated caller do, and does anything trust a user ID sent in the body or query instead of the verified token?
- **Storage and CDN:** public buckets, guessable file URLs, signed-URL expiry, and listing permissions.
- **Share and invite tokens:** entropy, expiry, revocation, and scope (one book vs the whole account).
- **Multi-tenant leaks** in list endpoints: missing `WHERE user_id = …`, pagination exposing others' rows, and search across all users.

**Safe dynamic tests:** against a local server, use two test identities and try cross-account access. Against production (only with `prod-ok`), prove a hole with your own two test accounts, never with real users' IDs.

---

## 2. Security Configuration Auditor (A02, M8)

**You own:** settings, headers and defaults across every deployed component.

**Hunt:**
- **Backend:** debug mode, verbose error pages and stack traces, the CORS policy (`*` with credentials, reflected origins), security headers (HSTS, `X-Content-Type-Options`, frame options and CSP on HTML pages), cookie flags, allowed hosts and request size limits.
- **Hosting config:** vercel.json, render.yaml, Procfile, Dockerfile, gunicorn config. Check for a root user in the container, exposed ports, secrets baked into image layers, and directory listing.
- **Database and auth provider:** whether email confirmation is required, password policy, redirect URL allow-lists (open redirects in auth callbacks), and exposed schemas.
- **Mobile app config:**
  - iOS Info.plist: App Transport Security exceptions (`NSAllowsArbitraryLoads`), URL schemes, background modes, and usage descriptions that match real use.
  - Android manifest: exported components, `usesCleartextTraffic`, `debuggable`, `allowBackup`.
  - Expo app.json and app.config: the updates URL, and runtime-version policy.
- **Leftovers:** test scripts, sample data, admin HTML pages, `.map` source maps in production, and `.git` or env files served statically.
- **Third-party dashboards** you can infer from code: webhook endpoints without secrets, and analytics projects with public write keys used for reads.

---

## 3. Supply Chain Auditor (A03, M2)

**You own:** everything the app runs that it didn't write.

**Hunt:**
- **Known vulnerabilities:** run `npm audit --omit=dev` (per package dir) and `pip-audit -r requirements.txt` if available. Otherwise, read the lockfiles and flag the critical packages you know. Filter to what's reachable in production.
- **Version pinning:** unpinned (`*`, `latest`, wide ranges) runtime dependencies, git or URL dependencies, and lockfile drift from package.json.
- **Install-time code:** `postinstall` and `prepare` scripts in the app and its deps, patch files under `patches/` (read every one: what do they change?), and native setup scripts that download binaries during build (pod install, Gradle). Check whether downloads are pinned by version and verified by checksum.
- **Runtime downloads:** ML models, fonts, scripts and OTA bundles fetched at runtime. Is the source pinned, and is integrity checked (hash or signature) before use?
- **CDN scripts in HTML pages:** pinned versions and Subresource Integrity (SRI).
- **Abandoned or typosquat-looking packages.** Also flag packages with far more permission than they need, such as native modules that are only used for one tiny function.
- **CI/CD:** third-party GitHub Actions pinned by SHA, and secrets exposed to pull requests from forks.

---

## 4. Secrets and Cryptography Auditor (A04, M1, M10)

**You own:** credentials, keys, tokens and anything encrypted or hashed.

**Hunt:**
- **Hardcoded secrets** in source, configs, scripts, docs and test files, **and in git history** (`git log -p -S` for key prefixes such as `sk_`, `service_role`, `AKIA`, `-----BEGIN`, `ghp_`, `xox`; use `gitleaks` or `trufflehog` if available).
- **Client bundles:** list every env var compiled into the web and mobile builds (e.g. `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, `VITE_*`). Which are meant to be public (an anon key, a publishable key) and which must never ship (service-role keys, secret API keys, signing secrets)?
- **Committed env files:** check `.gitignore` coverage of env files and key files, including in subfolders.
- **Token storage on device:** auth tokens in AsyncStorage or plain localStorage vs Keychain (SecureStore). Check what an iCloud or iTunes backup or a jailbroken device would expose.
- **Transport:** any `http://` endpoints, disabled certificate validation, and custom TLS code.
- **Crypto use:** home-made crypto, weak hashes (MD5 or SHA-1 for security), `Math.random()` for tokens or IDs that guard access, predictable share-token generation, and missing constant-time comparisons for webhook signatures.
- **Key rotation:** if a secret is found in history, it is compromised even if removed. Say it needs rotating.

Report locations and key types only, with the value redacted to its first 4 characters.

---

## 5. Injection and Untrusted Input Auditor (A05, M4)

**You own:** every place untrusted data reaches an interpreter, a file path, a parser or a renderer.

**Hunt:**
- **SQL:** string-built queries, f-strings or `%` formatting in SQL, raw RPC parameters, and ORDER BY or column names taken from input.
- **Commands:** `subprocess`, `os.system`, `shell=True`, and ffmpeg or other CLI calls with user-influenced arguments.
- **Paths:** file names from uploads or archives used in paths (`../` traversal), zip-slip in archive extraction (epub, docx, zip), and symlinks in archives.
- **Parsers:**
  - XML external entities (XXE) and entity-expansion bombs in XML, epub or docx parsing
  - decompression bombs (a tiny zip that expands to gigabytes)
  - huge-file denial of service, deeply nested structures, and regex denial of service (ReDoS) on user text
- **Server-side request forgery (SSRF):** any server fetch of a URL that the client can influence, directly or indirectly (redirect following, IDs mapped to URLs). Check access to internal metadata IPs and localhost.
- **Cross-site scripting (XSS)** in web pages and webviews: `dangerouslySetInnerHTML`, `innerHTML`, rendering ebook HTML, unescaped template output, `javascript:` URLs in links, and user-controlled titles in HTML emails.
- **Header and log injection:** CRLF in values echoed into headers, and user text written to logs unescaped.
- **Mobile input:** deep-link parameters, imported-file metadata, and pasted text reaching native code.

**Safe dynamic tests:** craft malicious sample files in your scratchpad (a zip-slip archive, an XXE XML file, a 1 KB file that expands to 1 GB, `<script>` in a title) and run them through the parsers locally, at unit level or against a local server. Never upload them to production.

---

## 6. Business Logic and Insecure Design Auditor (A06)

**You own:** whether the product's rules hold when someone deliberately breaks the expected flow.

**Hunt:**
- **Paywall and entitlements:** is every paid feature enforced on the server or database, or only in the client? Can a free user call the paid endpoint directly, or replay a purchase? Are purchase webhooks or receipts verified with the provider (signature or shared secret) before granting access?
- **Free-tier limits and quotas:** where are they counted? Can they be reset by reinstalling, using a new anonymous account, changing the clock or running parallel requests (race conditions)?
- **Abuse and cost:** endpoints that trigger expensive work (conversion, AI calls, emails, storage) without rate limits or per-user caps. Can an anonymous user make the service spend money?
- **State machines:** jobs, payments and deletion. Look at out-of-order calls, double submission, cancelling mid-way, and deleting an account while jobs run (orphaned data and storage).
- **Account lifecycle:** sign-up enumeration, account deletion really removing data (DB, storage, CDN, analytics), and data export.
- **Trust assumptions:** anything the design trusts that an attacker controls (client clocks, client-reported progress or tier, the referrer).

---

## 7. Authentication and Session Auditor (A07, M3 authentication)

**You own:** proving who the user is, and keeping that proof safe.

**Hunt:**
- **Server token verification:**
  - Is the JWT signature checked with the right secret or JWKS?
  - Are `exp`, `aud` and `iss` checked?
  - Is the algorithm pinned, and is `none` refused?
  - Is a decoded-but-unverified token ever trusted?
- **Auth decorators:** list every route and its decorator. Find routes missing auth, "optional auth" routes that act on a user ID anyway, and inconsistent decorator order.
- **Login, sign-up and reset flows:** user enumeration through different errors or timing, reset-token expiry and reuse, email change without re-auth, and OAuth or magic-link redirect validation.
- **Sessions:** refresh-token handling, logout actually revoking tokens, session fixation, tokens in URLs (where they leak via logs and referrers), and long-lived tokens on shared devices.
- **Anonymous and guest accounts:** can they be upgraded to take over an existing email, and what data do they keep?
- **Brute force:** rate limiting and lockout on login and OTP. Show it's missing with at most 5 requests to a local server.
- **Mobile:** biometric or local auth used as the only gate for server data, and tokens or credentials in logs, crash reports or screenshots.
- **Deletion:** does account deletion invalidate sessions everywhere?

---

## 8. Software and Data Integrity Auditor (A08)

**You own:** whether code and data that arrive from outside are verified before they're trusted.

**Hunt:**
- **Over-the-air (OTA) updates:** for expo-updates, CodePush and similar, check code-signing configuration, who can publish (channel and branch access), runtime-version isolation from live binaries, and rollback.
- **Webhooks:** signature verification (payments, auth, storage), timestamp and replay protection, and idempotency.
- **Deserialization:** `pickle`, `yaml.load` without SafeLoader, `eval`/`exec`/`Function()`, and JSON reviver tricks on untrusted input.
- **Downloaded artifacts:** models, frameworks and data files. Check that hashes are verified before use, and that verification is actually enabled, not just available.
- **Data integrity:** client-supplied values that the server stores as fact (progress, duration, word timings, metadata) and later trusts. Check the cache-poisoning paths.
- **CI/CD and deploy:** who or what can trigger a production deploy, protected branches, and build scripts that pull unpinned remote code.

---

## 9. Logging, Monitoring and Privacy Auditor (A09, M6)

**You own:** what the system records, what it leaks through records, and whether attacks would be noticed.

**Hunt:**
- **PII and secrets in logs:** `console.log`, `print` and logger calls that output emails, tokens, auth headers, full request or response bodies, file paths with user names, or payment data. Check the server, client and native logs.
- **Analytics and telemetry:** every `track`/`identify`/`capture` call. What properties are sent? Are emails or IDs that are personal data sent to third parties? Compare against the privacy policy page, and flag every mismatch.
- **Crash reporting:** what context is attached (breadcrumbs with PII)?
- **Security events:** are failed logins, permission denials, webhook signature failures and admin actions logged in a way someone would see? Is there any alerting?
- **Error tracking hygiene:** stack traces returned to clients, and error messages revealing internals (SQL, file paths, library versions).
- **Retention:** are logs with personal data kept indefinitely, and are deleted users removed from analytics?
- **Mobile privacy:** permissions requested vs used, pasteboard reads, App Privacy label vs actual collection, and third-party SDKs that collect on their own.

---

## 10. Error Handling and Device Data Auditor (A10, M5, M7, M9)

**You own:** how the system behaves when things go wrong, and what's left on the device.

**Hunt:**
- **Failing open:** `try/except: pass` or `catch {}` around auth, entitlement or validation checks that grant access on error. Also look for defaults that assume success when a provider call fails (e.g. "if RevenueCat errors, treat as paid").
- **Unhandled exceptions** on malformed input that crash the worker or the app (denial of service), and partial writes that leave inconsistent state.
- **Resource exhaustion:** unbounded loops, memory or disk growth driven by input size, missing timeouts on outbound calls, and missing size limits on uploads and downloads.
- **Insecure data storage on device (M9):**
  - what's in AsyncStorage, plain files, caches and the documents directory
  - whether it's excluded from backups where it should be
  - whether sensitive files are protected with iOS data protection classes
  - whether deleting the account or logging out removes local data
- **Communication (M5):** any plaintext transport, and certificate handling.
- **Binary protections (M7):** debug flags or dev menus in release builds, source maps shipped, and verbose native logging in release.
- **Error messages:** do they leak internals to users or attackers (stack traces, SQL, paths)?
- **Race conditions** around files and state (e.g. two writers on one file, rename-over without atomicity).
