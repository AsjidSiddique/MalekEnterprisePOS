# Architecture

## The big picture

```
   Shop network                                          Cloud (this repo)
┌────────────────────────────────┐                ┌──────────────────────────┐
│ Till 1 ─┐                      │                │ Next.js on Vercel        │
│ Till 2 ─┼─▶ Shop server        │── licence ────▶│  /api/pos/*   (public)   │
│ Till 3 ─┘   (PostgreSQL)       │   check only   │  /api/admin/* (admin)    │
└────────────────────────────────┘                │  /api/cron/*  (secret)   │
                                                  │  /api/webhooks/* (signed)│
   Sales data never leaves the shop.              │ Firebase: Auth, Firestore│
                                                  │           Storage        │
                                                  └──────────────────────────┘
```

The POS keeps all sales and stock data in a local PostgreSQL database. The cloud only knows who the customer is, what they've paid for, which licence key they hold, and which tills have registered.

## Layers

| Layer | Path | Notes |
|---|---|---|
| Pure domain rules | `src/lib/billing`, `src/lib/licensing`, `src/lib/releases` | No I/O. Fully unit tested. Every business rule (VAT, invoice status changes, licence state, terminal limit, version ordering) lives here |
| Firestore services | `src/services` | Admin-panel reads/writes through the client SDK; the security rules are the real gate |
| Server-only code | `src/lib/*/server.ts`, `src/app/api` | Firebase Admin SDK; anything that must not be forgeable (licence keys, terminal registration, billing job, webhooks) |
| UI | `src/components`, `src/app` | Public marketing site, admin panel |

## Licensing

### Keys
Format `MEP-XXXX-XXXX-XXXX-XXXX-XXXX` (32-character alphabet without look-alikes). Generated on the server with a cryptographic RNG. Only the SHA-256 hash and a short prefix are stored; the full key is shown to the admin once and cannot be recovered (regenerate instead). Regenerating invalidates the old key immediately but keeps the licence's registered terminals.

### Licence state
`computeLicenseState(license, subscriptionStatus, today)` returns one of `ACTIVE`, `GRACE`, `SUSPENDED`, `EXPIRED`, `REVOKED`. `ACTIVE` and `GRACE` are operational (the POS may trade); the rest are not. Rules, in priority order: revoked → revoked; subscription suspended or cancelled → suspended; past expiry plus grace days → expired; past expiry inside grace, or subscription overdue/grace → grace; otherwise active.

### Renewal
Licences renew themselves: while a subscription is `ACTIVE`, the daily job and each POS check-in push the expiry to the next billing date plus grace days. Paying an invoice is therefore what keeps a licence alive; nobody re-issues keys monthly.

### The POS contract

**Register a till** (first run, or whenever the POS needs to (re)confirm itself)

```
POST /api/pos/terminals/register
{ "token": "MEP-....", "hardwareId": "<stable machine id>", "deviceName": "Till 2",
  "version": "1.0.3", "localIp": "192.168.1.12", "shopName": "Main shop" }
```
Returns `201` (new) or `200` (already registered) with a lease. The terminal limit is enforced in a transaction, so simultaneous registrations cannot exceed it. `403` means over the limit, licence not operational, or the terminal was disabled/revoked by an admin.

**Check in** (about daily, from the shop server)

```
POST /api/pos/license/verify
{ "token": "MEP-....", "hardwareId": "<optional>", "version": "1.0.3" }
```
Returns a lease. If `hardwareId` is sent and that terminal was disabled or revoked, `valid` is `false`, which is how "remote unlink" works: the admin revokes a terminal, and it is blocked at its next check-in.

**The response**

```json
{ "valid": true, "state": "ACTIVE", "message": "Licence is active.",
  "lease": "{\"v\":1,\"licenseId\":\"…\",\"licensee\":\"…\",\"state\":\"ACTIVE\",\"terminalLimit\":3,
             \"expiryDate\":\"2026-11-01\",\"issuedAt\":\"…\",\"validUntil\":\"…\",\"operational\":true,…}",
  "signature": "<base64 Ed25519>" }
```

`lease` is a JSON **string**. The POS must verify `signature` over that exact string with the embedded public key (Ed25519), and only then parse it. Store the lease and signature locally. While the current time is before `validUntil` and `operational` is true, the POS may trade without contacting the server; `validUntil` is "now + the offline allowance" from Settings (default 7 days). After that it must check in or lock. Never trust an unsigned or unverifiable lease. If `LICENSE_SIGNING_PRIVATE_KEY` isn't set the server returns `"signature": null`, which is a misconfigured server, not a valid licence.

Errors: `401` invalid key (deliberately identical for unknown and malformed keys), `429` rate limited, `503` server not configured. Treat network errors as "offline" and rely on the cached lease.

**Reference implementation:** the sibling `desktop-app/` project (when distributed together with this one) implements exactly this contract in `src/main/java/malekpos/licensing/` - see its `LICENSING.md` for how it stores the lease, verifies the signature, and handles every online/offline/blocked case.

## Access control

`/admin/access` (`src/lib/access.ts`, pure and unit tested) joins every customer with their subscription, licence and terminals into one row: licence state, plain-language expiry ("Expires in 5 days", "Expired 12 days ago"), and how many terminals are active. Rows sort expired first, then expiring within 14 days, then blocked, then everyone else, so the accounts needing attention are always at the top.

- **Filters:** All, Blocked, Expiring soon, Fully allowed, plus a search box.
- **Block access / Allow access** on a row revokes (or reactivates) the licence and disables (or re-enables) every terminal, in one confirmed action. It calls the same `runLicenseCommand` and `setTerminalStatus` functions the Licences and Terminals pages use, so every change is still audit-logged individually — there is no new server route.
- Expanding a row shows the licence (with a one-click **+30 days** extension) and each terminal with its own Block/Allow, for when only one till needs to change.

## Secure downloads

**Goal:** no one can find a permanent address for an installer, and a leaked link stops working.

| Situation | What happens |
|---|---|
| Visitor clicks *Download* | The browser asks `POST /api/download/ticket` for a ticket: a signed token (HMAC-SHA256) naming one release file, valid for **5 minutes**. Only *published* releases qualify. It then follows `GET /api/download/file?t=…` |
| File was **uploaded** | The server checks the ticket and redirects to a Firebase Storage **signed URL** that expires in 5 minutes and forces a download. Storage itself is private, so the raw path is useless |
| File is a **link** in "Hide the link" mode | The server fetches it from the host and **streams it to the visitor**, passing `Range` headers through so downloads can resume. The address never reaches a browser, logs or the audit log |
| File is a **link** in "Send them to the link" mode | Redirect to the address. Simpler and free of bandwidth cost, so it is the right choice for large public files, but the address is visible to whoever looks |
| Admin makes a **private link** | `GET /get/<token>`: a random 192-bit token (only its hash is stored). It expires, has a download limit, can be cancelled, and works for drafts and archived builds too |

Link addresses live in `releaseLinks/{releaseId}`, which the security rules deny to every browser. They are read only by server code.

**Protecting the server that fetches links (SSRF).** Because the server fetches admin-supplied addresses, `src/lib/security/urlGuard.ts` allows only `https` on the standard port, with no embedded credentials, and refuses `localhost`, internal-looking names and any address that resolves to a private, loopback, link-local (including cloud metadata) or reserved range. Redirects are followed by hand, up to five hops, and **every hop is checked again**. A `GITHUB_TOKEN` is attached only to `api.github.com` asset requests, never to redirect targets.

**GitHub picker.** `POST /api/admin/releases/links {action:"github", repo}` lists a repository's recent releases and their installer-type files (`src/lib/releases/github.ts`). The repository name is strictly validated so it can only ever address `api.github.com/repos/<owner>/<name>`. For private repositories the server uses `GITHUB_TOKEN` and the link is forced to "Hide the link" mode.

**Counting.** Downloads are counted per release, per day and per file (`downloads/{releaseId}`). A resumed or multi-part download counts once. Share-link limits use the same rule.

**Honest limits.**
- A public link stays public to anyone who already knows it. "Hide the link" prevents it appearing on your site; it can't un-publish it on GitHub. For a genuinely private installer, upload the file, or host it in a private repository and set `GITHUB_TOKEN`.
- Streaming a large file through your host uses its bandwidth and needs a plan that allows long-running functions (the routes ask for up to 300 seconds).
- The download page is public by design: anyone can download the installer. The **licence key** is what controls who can *use* it.
- The DNS check and the fetch resolve the name separately, so a hostile DNS server could in theory answer differently the second time. The redirect and private-range checks make this hard to exploit; for stricter guarantees, put the server behind an egress proxy.

## Billing

The daily job (`src/lib/billing/server.ts`, called by `/api/cron/billing`) is idempotent, so a retried or double-run job changes nothing.

1. **Invoice** every auto-renewing subscription whose next billing date has arrived. The invoice id is `sub_<subscription>_<billing date>`, so the same cycle can never be billed twice. Invoice numbers are sequential per month (`INV-202609-0001`) via a transactional counter.
2. **Flag overdue**: pending invoices past their due date.
3. **Remind**: a reminder N days before the due date and when an invoice goes overdue (deterministic notification ids prevent duplicates).
4. **Reconcile** each subscription from its invoices: paid → `ACTIVE`; overdue → `OVERDUE`; overdue longer than the grace days → `SUSPENDED`. Paying the outstanding invoice restores it.
5. **Licences**: renew for active subscriptions, warn about expiry within 14 days for the rest.
6. **Email** queued messages if Resend is configured and enabled.

Invoice status changes follow a state machine (`checkTransition`). Reverting a paid invoice, or paying a cancelled one, requires explicit confirmation and is audit-logged. Marking an invoice paid records a payment and reconciles the subscription in one step.

## Payments

`PaymentGateway` (`src/lib/billing/gateway.ts`) is the only thing the webhook route knows about. The webhook verifies the signature, checks the amount and currency against the invoice, uses the gateway reference as an idempotency key, then records the payment and reconciles the subscription.

**Adding Yoco:**
1. Write `YocoGateway implements PaymentGateway`: verify Yoco's webhook signature and map its event to `PaymentEvent`.
2. Return it from `getGateway()` when `PAYMENT_PROVIDER=yoco`.
3. Add the checkout step that creates a Yoco payment for an invoice and stores the invoice id in the payment metadata so the webhook can find it.

Nothing else changes. The mock gateway (`PAYMENT_PROVIDER=mock`) accepts events signed with HMAC-SHA256 of the raw body in an `x-signature` header, for testing the full flow.

## Security model

- **Authorization is enforced by Firestore/Storage rules and server checks**, never by the UI alone. Admin is a Firebase custom claim.
- **Licence documents are read-only to browsers.** Keys, registrations, check-ins and the billing job all run server-side.
- **Secrets stay on the server.** Only `NEXT_PUBLIC_*` values reach the browser; the system-status page reports whether an integration is configured without revealing values.
- **Audit log is append-only** and written for every admin change and for server-side events (registrations, billing runs, webhook payments). Licence keys are never logged.
- **Public inputs are bounded:** the contact form is size-checked by the rules and has a honeypot; POS and webhook endpoints validate with Zod and are rate limited.
- **Limits to be aware of:** rate limiting is in-memory per server instance (fine as a speed bump, not a guarantee); the licence check protects against casual sharing and non-payment, not a determined attacker with the desktop app's binary. Ed25519 signing stops forged responses but the POS still has to defend its own local cache.

## Admin panel extras

- **Team** (`/api/admin/team`): list, add and remove admins. Adding sends no password: a one-time reset link is generated for the new admin to set their own. You can't remove yourself or the last admin, and a removed admin is signed out everywhere.
- **Run billing now** (`/api/admin/billing/run`): the same idempotent job as the nightly cron, started by hand.
- **Reports**: monthly recurring revenue, receivables ageing, best customers (pure functions in `src/lib/reports.ts`, unit tested).
- **Search and export**: Ctrl/⌘+K searches customers, invoices, licences and releases; tables export what's currently shown as CSV (cells starting with `=`, `+`, `-` or `@` are neutralised to prevent spreadsheet formula injection).

## Demo mode

`NEXT_PUBLIC_DEMO_MODE=true` swaps the four Firebase client modules for in-memory versions (`src/lib/demo`) via a webpack alias, seeded with invented data. It is inlined at build time, so a normal build contains none of it. It exists for walkthroughs and design review.

## Data model (Firestore)

`customers`, `shops`, `subscriptions`, `invoices`, `payments`, `licenses`, `terminals`, `releases`, `releaseLinks` (server only), `shareLinks`, `downloads`, `notifications`, `inquiries`, `auditLogs`, plus `pricing/default`, `settings/app` (admin-only), `settings/public` (contact details mirrored for the public site) and `settings/counters` (invoice sequence). Defensive mappers in `src/lib/mappers.ts` turn every document into a typed model and tolerate missing or malformed fields.

## Customer accounts and self-service licensing (added)

A customer can now sign in at `/account`, buy or upgrade a plan, pay, and see their own licence key,
invoices, payments and registered tills - no admin action needed for a normal purchase.

**How a purchase becomes a licence:**
1. `/api/account/order` creates a `PENDING` invoice for the chosen plan/tills/frequency (server-priced,
   never trusted from the browser). Their own negotiated per-terminal price wins if an admin set one.
2. Payment succeeds - either the real gateway's webhook (`/api/webhooks/payments`) or, in test mode only,
   `/api/account/pay-test` - and both go through the same `applyPaymentEvent()` in `src/lib/billing/payments.ts`.
3. That function calls `fulfilPaidOrders()`, which activates (or creates) the subscription and issues (or
   extends) the licence. Each invoice is claimed in a transaction before fulfilling, so a retried webhook
   can never double-issue anything. `loadPortal()` also calls it on every account page load, which is what
   picks up an admin marking a bank-transfer invoice as paid by hand.
4. The customer's account now shows the licence. They can reveal the key (`/api/account/licenses/reveal`,
   ownership-checked, every reveal is audit-logged) because it was sealed with AES-256-GCM into the
   server-only `licenseSecrets` collection at issue time (`src/lib/licensing/secretBox.ts`) - Firestore
   rules block every client from that collection entirely; only the Admin SDK can open it.

**Linking an account to an existing (admin-created) customer:** by verified email match on first sign-in
(`findCustomerForUser` in `src/lib/account/server.ts`), or immediately if an admin later sets a customer's
`email` to match. Never by unverified email, so nobody can claim an account by typing someone else's address.

**Turning on test payments** (to see the whole flow work without a real gateway): in Vercel, set
`PAYMENT_PROVIDER=mock`, `PAYMENT_WEBHOOK_SECRET` (any long random string), and `ALLOW_TEST_PAYMENTS=true`.
Turn `ALLOW_TEST_PAYMENTS` off (or remove it) once a real gateway is connected - the button disappears and
the server route refuses to run even if someone calls it directly.

**Admin side:** `/admin/licenses` -> Generate now accepts a customer with no subscription yet - the server
creates a starter one (no auto-renewal, so it never bills on its own) from that customer's own record. This
is what the "Choose a customer" list not showing a newly-added customer meant: it only listed customers who
already had a subscription. It now lists anyone who doesn't already have an active licence.
