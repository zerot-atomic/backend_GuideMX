# MXGuide Backend — Security Audit Report

**Date**: 2026-11-13  
**Scope**: Full backend (NestJS + Prisma + PostgreSQL)  
**Method**: Manual code review, configuration analysis, architecture assessment  

---

## Executive Summary

| Severity | Count | SLA |
|----------|-------|-----|
| **CRITICAL** | 11 | ≤ 2 weeks |
| **MEDIUM** | 32 | — |
| **LOW** | 27 | ≤ 6 months |
| **TOTAL** | 70 | — |

---

## 🔴 CRITICAL — Fix within 2 weeks

| # | Vulnerability | Location | Exploitability | Impact |
|---|---------------|----------|----------------|--------|
| C1 | **4-char password reset token (36^4 = 1.6M combinations)** | `account-recovery.service.ts:11-12` | HIGH — Online brute-force feasible within rate limits (1000/hr IP = 1.6M/1667hr ≈ 70 days; distributed botnet = hours) | Full account takeover via password reset |
| C2 | **JWT_SECRET used directly for token signing (no rotation in JwtStrategy)** | `jwt.strategy.ts:11`, `auth.module.ts:14` | HIGH — Static secret never rotates; JwtKeyService rotates but is **unused** by Passport strategy | Long-term token forgery, impersonation |
| C3 | **Google OAuth dummy credentials allow unauthenticated startup** | `google.strategy.ts:11-12` | MEDIUM — Server starts with `not-configured`; OAuth flow fails silently or exposes misconfiguration | Auth bypass if misconfigured in prod; credential leakage risk |
| C4 | **CORS enabled with no origin restrictions** | `main.ts:21` | HIGH — `app.enableCors()` allows all origins, credentials | CSRF, data exfiltration via malicious sites |
| C5 | **Helmet defaults only — no CSP, no HSTS preload, no frame-ancestors** | `main.ts:12` | MEDIUM — XSS, clickjacking, MIME sniffing | Client-side attacks, credential theft |
| C6 | **Rate limit: 100 req/min global — too permissive for auth endpoints** | `app.module.ts:46` | HIGH — Login, register, password reset share generic limit | Credential stuffing, enumeration, DoS |
| C7 | **Password reset rate limit bypass: email check returns 200 for non-existent users** | `account-recovery.service.ts:98-105` | MEDIUM — Attacker can enumerate valid emails via timing or response differences | User enumeration, targeted attacks |
| C8 | **No password complexity requirements (min 6 chars only)** | `register.dto.ts:8`, `login.dto.ts:7` | HIGH — Weak passwords accepted, no breach detection | Credential stuffing success, account compromise |
| C9 | **bcrypt cost factor 10 (low for 2026)** | `account-recovery.service.ts:274` | MEDIUM — GPU cracking ~100k H/s per GPU | Offline hash cracking if DB leaked |
| C10 | **JWT expires in 7d default — no refresh token rotation** | `auth.module.ts:15`, `.env.example:6` | MEDIUM — Long-lived access tokens, no revocation mechanism | Token theft = 7-day access |
| C11 | **File upload: no validation of file type, size, or content** | `uploads.service.ts`, `uploads.controller.ts` | HIGH — Cloudinary accepts any file; no MIME/size checks server-side | Malicious file upload, stored XSS via SVG, DoS via large files |

---

## 🟡 MEDIUM — Fix in normal sprint cycle

| # | Vulnerability | Location | Notes |
|---|---------------|----------|-------|
| M1 | **Raw SQL in findNearby uses template interpolation (not parameterized)** | `places.service.ts:15-30` | Uses `$queryRaw` with `${lat}`, `${lng}`, `${radius}` — Prisma escapes but template strings risky if modified |
| M2 | **Audit log `userId` stored as 'unknown' string for null** | `account-recovery.service.ts:358` | Breaks FK integrity, query confusion; should be nullable |
| M3 | **Audit `details` stored as Json without schema validation** | `schema.prisma:160` | Potential injection via prototype pollution if deserialized unsafely |
| M4 | **No request size limit (body parser default)** | `main.ts` | DoS via large payloads; add `bodyParser` limit |
| M5 | **No API versioning strategy** | All controllers | Breaking changes risk; add prefix `/v1` |
| M6 | **Swagger/OpenAPI not configured** | — | No contract testing, no security scheme docs |
| M7 | **Google OAuth state parameter not validated** | `google.strategy.ts` | CSRF on OAuth flow; Passport handles but verify |
| M8 | **JWT `ignoreExpiration: false` but no clock skew tolerance** | `jwt.strategy.ts:10` | Legitimate tokens rejected on minor time drift |
| M9 | **Password reset token cleanup job not scheduled** | `account-recovery.service.ts:328` | `cleanupExpiredTokens` exists but no cron; DB bloat |
| M10 | **Email template uses `{{token}}` directly — no escaping (Handlebars auto-escapes but verify)** | `reset-password.hbs:23` | Template injection unlikely but confirm Handlebars config |
| M11 | **No security headers beyond Helmet defaults** | `main.ts:12` | Missing: `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Embedder-Policy` |
| M12 | **Trust proxy enabled but no IP validation** | `main.ts:11` | Relies on Render/X-Forwarded-For; spoofable if not behind trusted proxy |
| M13 | **Role guard: no default deny, allows if no roles defined** | `roles.guard.ts:14` | Endpoints without `@Roles()` accessible by any authenticated user |
| M14 | **No audit logging for auth events (login, register, token refresh)** | `auth.service.ts` | Only password reset has audit trail |
| M15 | **Password history not enforced on reset** | `account-recovery.service.ts:274` | User can reuse current password |
| M16 | **No account lockout after failed login attempts** | `auth.service.ts:40-53` | Only password reset has rate limiting |
| M17 | **Google-only accounts can't reset password but error message identical** | `account-recovery.service.ts:108-117` | UX issue; attacker learns account type via timing |
| M18 | **`updateMe` allows password change without current password for Google accounts** | `auth.service.ts:150-177` | Logic gap: Google accounts have no `currentPassword` |
| M19 | **No CORS preflight cache control** | `main.ts:21` | Repeated OPTIONS requests |
| M20 | **Prisma `postgis` extension enabled — attack surface if not used** | `schema.prisma:8` | Reduce attack surface; disable if unused |
| M21 | **No database connection pooling limits configured** | `prisma.service.ts` | Default pool may exhaust DB under load |
| M22 | **Error filter logs stack traces for 500 errors** | `all-exceptions.filter.ts:38-39` | Potential info leak in logs (paths, queries) |
| M23 | **No request ID / correlation ID for tracing** | — | Debugging and audit correlation difficult |
| M24 | **Email `MAIL_PASS` in env — no secret manager integration** | `.env.example:26` | Credentials in plaintext env |
| M25 | **Cloudinary credentials optional but no validation if used** | `uploads.service.ts:9-11` | Silent failure if misconfigured |
| M26 | **No health check / readiness endpoint** | — | K8s/Render cannot probe properly |
| M27 | **No structured logging (JSON) for SIEM integration** | `main.ts`, services | Logs are human-readable only |
| M28 | **JWT key rotation (JwtKeyService) writes to local filesystem** | `jwt-key.service.ts:16,45` | Not shared across instances; breaks in multi-replica deployments |
| M29 | **No rate limit on `/auth/google` mobile endpoint** | `auth.controller.ts:29-32` | Token validation DoS |
| M30 | **Places `findAll` limit default 2000 — potential DoS** | `places.service.ts:45` | Large result sets; add max cap |
| M31 | **No input sanitization on text fields (descriptions, names)** | DTOs use `IsString` only | XSS risk if reflected in web views |
| M32 | **Dependencies not pinned to exact versions in package.json** | `package.json` (not shown) | Supply chain risk; use `npm ci` + lockfile |

---

## 🟢 LOW — Fix within 6 months

| # | Improvement | Location | Rationale |
|---|-------------|----------|-----------|
| L1 | **Increase password reset token to 8 chars (36^8 = 2.8T)** | `account-recovery.service.ts:11-12` | Eliminates online brute-force |
| L2 | **Integrate JwtKeyService with JwtStrategy (dynamic secret)** | `jwt.strategy.ts`, `jwt-key.service.ts` | Enable true key rotation |
| L3 | **Add Content Security Policy (CSP) with nonce/hash** | `main.ts` | Defense-in-depth against XSS |
| L4 | **Add HSTS preload, frame-ancestors, referrer-policy** | `main.ts` | Hardening |
| L5 | **Implement per-endpoint rate limiting (throttler guards)** | `app.module.ts`, controllers | Auth: 5/min; API: 60/min; Upload: 10/min |
| L6 | **Add password strength meter (zxcvbn) + breach check (HIBP)** | `register.dto.ts`, `auth.service.ts` | Reduce weak passwords |
| L7 | **Increase bcrypt cost to 12-14** | `account-recovery.service.ts:274`, `auth.service.ts` | Slow offline cracking |
| L8 | **Add refresh token rotation with reuse detection** | `auth.service.ts`, `auth.module.ts` | Limit token theft window |
| L9 | **Add password history (last 5) on reset/change** | `account-recovery.service.ts`, `auth.service.ts` | Prevent reuse |
| L10 | **Add account lockout after 5 failed logins (15 min)** | `auth.service.ts` | Mitigate credential stuffing |
| L11 | **Add request size limit (1MB default, 10MB for upload)** | `main.ts` | DoS prevention |
| L12 | **Add API versioning (`/v1` prefix)** | `main.ts`, controllers | Safe evolution |
| L13 | **Configure Swagger with security schemes** | `main.ts` | Documentation, testing |
| L14 | **Validate Google OAuth `state` parameter explicitly** | `google.strategy.ts` | CSRF defense |
| L15 | **Schedule token cleanup cron (daily)** | `account-recovery.service.ts:328` | DB hygiene |
| L16 | **Add security headers: Permissions-Policy, COEP, CORP** | `main.ts` | Hardening |
| L17 | **Fix audit `userId` nullable schema** | `schema.prisma:155` | Data integrity |
| L18 | **Add structured JSON logging + request IDs** | `main.ts`, services | Observability, SIEM |
| L19 | **Move secrets to secret manager (AWS/GCP/Azure/Vault)** | `.env.example`, config | Credential hygiene |
| L20 | **Add health/readiness endpoints** | New controller | Orchestration |
| L21 | **Validate file MIME type + size before Cloudinary upload** | `uploads.service.ts`, `uploads.controller.ts` | Prevent malicious uploads |
| L22 | **Add max limit cap on pagination (e.g., 100)** | `places.service.ts`, `reviews.service.ts` | DoS prevention |
| L23 | **Sanitize HTML/text inputs (DOMPurify or similar)** | DTOs, services | XSS prevention |
| L24 | **Pin dependencies to exact versions + enable `npm audit` CI** | `package.json`, CI | Supply chain |
| L25 | **Add integration tests for auth flows** | — | Regression prevention |
| L26 | **Add rate limit on password reset verify/reset endpoints** | `account-recovery.controller.ts` | Prevent token brute-force |
| L27 | **Document threat model and data flow diagrams** | — | Security architecture |

---

## Priority Remediation Plan

### Week 1 (Critical)
1. **C1** — Increase reset token to 8 chars (1 line change)
2. **C2** — Wire JwtKeyService into JwtStrategy (refactor secret loading)
3. **C4** — Restrict CORS to known origins
4. **C5** — Configure Helmet with CSP, HSTS, frame-ancestors
5. **C6** — Add per-endpoint throttler guards for auth endpoints
6. **C11** — Add file validation (MIME, size, magic bytes)

### Week 2 (Critical cont.)
7. **C3** — Fail fast if Google OAuth not configured in prod
8. **C7** — Constant-time email existence response (already OK but verify timing)
9. **C8** — Enforce password policy (min 12, complexity, HIBP check)
10. **C9** — Increase bcrypt cost to 12
11. **C10** — Implement refresh token rotation

### Sprint 1-2 (Medium)
- M1, M2, M4, M5, M9, M13, M14, M15, M16, M19, M21, M22, M26, M28, M30, M32

### Quarter 1 (Low)
- All L1-L27 as capacity allows

---

## Validation Checklist for Critical Fixes

| Fix | Test |
|-----|------|
| C1: 8-char token | Verify 36^8 space; rate limit math |
| C2: Key rotation | Deploy 2 replicas; rotate key; verify both accept old+new |
| C4: CORS | `curl -H "Origin: https://evil.com" -v` → no `Access-Control-Allow-Origin` |
| C5: CSP | Load page; check `Content-Security-Policy` header; test inline script blocked |
| C6: Auth rate limit | Burst 10 login requests → 429 after 5 |
| C11: Upload validation | Upload `.svg` with script → reject; upload 50MB → reject |

---

## Notes

- **JwtKeyService exists but is unused** — this is the single biggest architectural gap. The rotating key infrastructure is built but Passport JWT strategy reads static `JWT_SECRET` from env.
- **Password reset token entropy** is the most immediately exploitable issue. 4 chars = online brute-forcible.
- **CORS + missing CSP** = client-side attack surface wide open.
- **No per-endpoint rate limiting** on auth = credential stuffing trivial.
- **File upload** trusts Cloudinary entirely; no server-side validation.

---

*End of audit. 70 findings across 3 severity tiers.*