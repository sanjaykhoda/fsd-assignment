# Reviewer Guide

Step-by-step instructions to run and review the Quality Inspection Tracker.

Everything here takes about five minutes. If anything goes wrong, jump to
[Troubleshooting](#troubleshooting) at the bottom — the three most likely
problems are all environment issues with one-line fixes.

---

## 1. Clone the repository

```bash
git clone https://github.com/sanjaykhoda/fsd-assignment.git
cd fsd-assignment
```

## 2. Check your Node version

```bash
node --version
```

**Node 20.19 or newer is required** — 22.x recommended. `.nvmrc` pins 22.12.0.

Vite needs this floor, and an older Node fails in ways that look unrelated, so
it is worth the five seconds to check.

> **If you upgrade Node after installing**, delete `node_modules` and reinstall.
> The SQLite driver is a native module compiled for one specific Node version.

## 3. Install dependencies

```bash
npm install
```

**Windows PowerShell:** if you see `npm.ps1 cannot be loaded because running
scripts is disabled`, use `npm.cmd install` instead. That is a PowerShell
execution-policy setting, not anything specific to this project. Git Bash and
`cmd.exe` are unaffected.

## 4. Seed the database

```bash
npm run seed
```

Loads 24 sample inspections spread over the last 30 days, across every severity
and defect type, with roughly 40% already resolved.

This step is optional — the app seeds itself on first start if the database is
empty — but it is the reset button if you want to start clean after clicking
around.

## 5. Start the app

```bash
npm run dev
```

One command starts both halves: the Express API on port 4000 and the Vite dev
server on port 5173. Wait for both to report ready.

## 6. Open it

### → <http://localhost:5173>

**Not port 4000.** The UI is served from 5173 and proxies API calls through to
4000 behind the scenes.

## 7. Log in

```
Username:  supervisor
Password:  inspect123
```

**Both fields are prefilled — just click "Sign in".**

---

## Viewing it as intended

This is a mobile-first app built for a supervisor on a phone. To see it at the
target size:

1. Press `F12` to open DevTools
2. Press `Ctrl+Shift+M` (`Cmd+Shift+M` on Mac) for the device toolbar
3. Choose **iPhone 14**, or set the dimensions to **390 × 844**

Every screen is verified at that width with no horizontal scrolling.

## What to try

| # | Where | What |
| --- | --- | --- |
| 1 | **Inspections** | Switch between All / Open / Resolved. Tap **Filters** for severity, defect type and date range. |
| 2 | **Search box** | Type `selvedge` — it searches remarks and resolution notes, not just machine IDs. |
| 3 | **Log** tab | Record a new defect. The date defaults to today. |
| 4 | Tap an **Open** card | Then **Mark as resolved**. The confirm button stays disabled until you write a note — the note is mandatory. |
| 5 | **Summary** | Open/resolved counts by severity. Tap a row to jump to that filtered list. |
| 6 | **⚙ gear icon** | Add or retire defect types. These are managed at runtime, not hardcoded. |

Things worth noticing: applied filters show as removable chips, the filter state
lives in the URL (so views are shareable and the back button undoes a filter),
and every list state — loading, empty, error — is handled.

---

## Testing the SAP webhook

**Endpoint**

```
POST http://localhost:4000/api/sap-webhook
```

**Required headers**

| Key | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `X-SAP-Secret` | `sap-dev-secret` |

> **No bearer token here.** `X-SAP-Secret` is the only credential this endpoint
> accepts. It is a machine-to-machine integration — SAP has no user account to
> log in with — so it uses a shared secret rather than a user session. Omitting
> the header returns `401`.
>
> The secret is overridable with the `SAP_WEBHOOK_SECRET` environment variable.

**Payload**

```json
{
  "NotificationNo": "10000451",
  "PlantSection": "LOOM-14",
  "DefectCode": "WEAVE",
  "Priority": "1",
  "NotificationDate": "2026-08-21",
  "ShortText": "Broken pick, roll 22"
}
```

| Field | Required | Maps to |
| --- | --- | --- |
| `NotificationNo` | **yes** | External reference, and the idempotency key |
| `PlantSection` | **yes** | Machine / line ID |
| `DefectCode` | no | Defect type — `WEAVE`, `SHADE`, `HOLE`, `COUNT`, `OTHER` |
| `Priority` | no | Severity — `1`=Critical, `2`=Major, `3`=Minor |
| `NotificationDate` | no | Inspection date, defaults to today |
| `ShortText` | no | Remarks |

An unrecognised `DefectCode` is filed under **Other** with the original code
preserved in the remarks, rather than rejected — a real inbound integration
must not silently drop messages.

**curl**

```bash
curl -X POST http://localhost:4000/api/sap-webhook \
  -H 'Content-Type: application/json' \
  -H 'X-SAP-Secret: sap-dev-secret' \
  -d '{"NotificationNo":"10000451","PlantSection":"LOOM-14","DefectCode":"WEAVE","Priority":"1","ShortText":"Broken pick, roll 22"}'
```

**PowerShell**

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/sap-webhook `
  -Headers @{ 'X-SAP-Secret' = 'sap-dev-secret' } `
  -ContentType 'application/json' `
  -Body '{"NotificationNo":"10000451","PlantSection":"LOOM-14","DefectCode":"WEAVE","Priority":"1","ShortText":"Broken pick, roll 22"}'
```

**Run it twice.** The first call returns `201`; the second returns `200` with
the same record and creates no duplicate, because the endpoint is idempotent on
`NotificationNo`. The new inspection appears at the top of the list with a
**SAP** tag.

---

## Running the tests

```bash
npm test
```

58 API tests covering the invariants worth protecting: the mandatory resolution
note, inclusive date-range boundaries, severity sorting by meaning rather than
alphabetically, pagination correctness, webhook idempotency, and defect-type
referential integrity.

---

## Alternative: Docker

If you would rather not install Node:

```bash
git clone https://github.com/sanjaykhoda/fsd-assignment.git
cd fsd-assignment
docker compose up --build
```

### → <http://localhost:4000>

Steps 2 through 5 are not needed — the image builds both halves and runs them as
a single process, and the database seeds itself on first boot. Same login.

To start again from an empty database: `docker compose down -v`.

---

## Troubleshooting

**`npm.ps1 cannot be loaded because running scripts is disabled`** (Windows)
Use `npm.cmd` instead of `npm`, or run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. Git Bash and
`cmd.exe` are unaffected.

**`ECONNREFUSED 127.0.0.1:4000` / the API never starts**
Almost always Node being too old. Check `node --version` — below 20.19 the API
prints a version message and exits. Note that `npm run seed` still works on an
old Node while `npm run dev` does not, which makes this confusing.

**`NODE_MODULE_VERSION` mismatch / `ERR_DLOPEN_FAILED`**
The native SQLite module was built for a different Node version. Run
`rm -rf node_modules && npm install`.

**Port 4000 already in use**
Something else is on the port and the dev proxy is forwarding to it. Stop it, or
move this app: `PORT=4100 API_PORT=4100 npm run dev` (both the API and the proxy
read those, so they cannot drift apart).

**The app loads but has no data**
Run `npm run seed`.

---

## Where to look in the code

| Path | What |
| --- | --- |
| `api/src/inspections/repository.ts` | All inspection SQL — filtering, sorting, summary |
| `api/src/inspections/routes.ts` | Thin router: no SQL, no business logic |
| `api/src/domain/schemas.ts` | Zod schemas — the single source of validation |
| `api/src/db/schema.sql` | Two tables; the mandatory-note rule is a CHECK constraint |
| `api/src/sap/routes.ts` | Mock SAP webhook and its mapping |
| `web/src/pages/ListPage.tsx` | URL-driven filters, search and pagination |
| `web/src/lib/api.ts` | One fetch path, one error type |

Design reasoning, stated assumptions, and what was cut and why: **[README.md](README.md)**
Full endpoint reference and error codes: **[docs/API.md](docs/API.md)**
