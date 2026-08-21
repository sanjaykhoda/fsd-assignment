# API Reference

Base URL: `http://localhost:4000/api`

## Response envelope

Every endpoint answers with the same two shapes. The client discriminates on
which key is present, so there is exactly one unwrap path in the whole frontend.

```jsonc
// success
{ "data": { ... } }

// success, for collections
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 37, "totalPages": 2 } }

// failure
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [ { "field": "severity", "message": "Select a severity" } ]
  }
}
```

`details[]` is present only on `422` and is field-level, which is what lets the
web forms render server errors under the right input without duplicating any
validation rules.

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Body or query failed validation; see `details[]` |
| `MALFORMED_JSON` | 400 | Body was not parseable JSON |
| `UNAUTHORIZED` | 401 | Missing, expired or invalid credentials |
| `NOT_FOUND` | 404 | No such resource, or no such route |
| `ALREADY_RESOLVED` | 409 | The inspection has already been resolved |
| `IN_USE` | 409 | The defect type is referenced and cannot be deleted |
| `DUPLICATE` | 409 | A defect type with that name or code already exists |
| `INTERNAL_ERROR` | 500 | Unhandled failure; details are logged, never returned |

## Authentication

All `/api/inspections` and `/api/defect-types` endpoints require a bearer token.
`/api/health` and `/api/sap-webhook` do not (the webhook uses a shared secret
instead, because SAP is a machine caller with no session).

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"supervisor","password":"inspect123"}'
```

```jsonc
{ "data": { "token": "eyJhbGciOi...", "user": { "username": "supervisor" } } }
```

Send it as `Authorization: Bearer <token>`. Tokens expire after 12 hours.

---

## Endpoints

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| `GET` | `/health` | 200 | — |
| `POST` | `/auth/login` | 200 | 401, 422 |
| `GET` | `/inspections` | 200 + `meta` | 401, 422 |
| `POST` | `/inspections` | 201 + `Location` | 400, 401, 422 |
| `GET` | `/inspections/summary` | 200 | 401, 422 |
| `GET` | `/inspections/:id` | 200 | 401, 404 |
| `PATCH` | `/inspections/:id/resolve` | 200 | 401, 404, 409, 422 |
| `GET` | `/defect-types` | 200 | 401 |
| `POST` | `/defect-types` | 201 + `Location` | 401, 409, 422 |
| `PATCH` | `/defect-types/:id` | 200 | 401, 404, 409, 422 |
| `DELETE` | `/defect-types/:id` | 204 | 401, 404, 409 |
| `POST` | `/sap-webhook` | 201 / 200 | 401, 422 |

---

### `GET /inspections`

| Param | Values | Default |
| --- | --- | --- |
| `status` | `Open` \| `Resolved` | all |
| `severity` | `Critical` \| `Major` \| `Minor`; repeatable or comma-separated | all |
| `defectTypeId` | integer; repeatable or comma-separated | all |
| `machineId` | case-insensitive substring match | — |
| `from` / `to` | `YYYY-MM-DD`, **inclusive on both ends** | unbounded |
| `sort` | `inspectedOn` \| `severity` \| `status` \| `machineId` \| `createdAt` | `inspectedOn` |
| `order` | `asc` \| `desc` | `desc` |
| `page` | integer ≥ 1 | 1 |
| `pageSize` | 1–100 | 20 |

`sort=severity&order=desc` returns **Critical first** — severity is ordered by
meaning, not alphabetically (alphabetically it would be exactly backwards).

```bash
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:4000/api/inspections?status=Open&severity=Critical,Major&sort=severity&order=desc'
```

### `POST /inspections`

```jsonc
{
  "inspectedOn": "2026-08-21",        // optional, defaults to today, cannot be in the future
  "machineId": "LOOM-14",             // required, free text
  "defectTypeId": 1,                  // either this...
  "defectType": "Weave Defect",       // ...or this (the name)
  "severity": "Critical",             // required: Critical | Major | Minor
  "remarks": "Recurring on shift B"   // optional
}
```

Returns `201` with the full record and a `Location` header. `status` is always
`Open` on creation; any client-supplied `status` or `id` is ignored.

### `PATCH /inspections/:id/resolve`

```jsonc
{ "resolutionNote": "Beam re-tensioned, verified 2 rolls" }
```

A dedicated action rather than `PATCH /inspections/:id` with
`{"status":"Resolved"}`, because resolving is a state transition carrying an
invariant — the note is mandatory and an inspection cannot be resolved twice —
not a field assignment. That is also what gives `409` an unambiguous meaning.

- Empty or whitespace-only note → `422`
- Already resolved → `409 ALREADY_RESOLVED`, and the original note is preserved

### `GET /inspections/summary`

Accepts the same `from` / `to` params as the list.

```jsonc
{
  "data": {
    "totals": { "open": 14, "resolved": 10, "total": 24 },
    "bySeverity": [
      { "severity": "Critical", "open": 3, "resolved": 3, "total": 6 },
      { "severity": "Major",    "open": 6, "resolved": 4, "total": 10 },
      { "severity": "Minor",    "open": 5, "resolved": 3, "total": 8 }
    ]
  }
}
```

Severities with no rows are returned as zeros rather than omitted, so the UI
never has to handle a missing bucket.

---

### Defect types

Defect types are data, not a hardcoded enum — a plant adds its own categories
without a code change. The five from the original specification are seeded and
flagged `isSystem`.

`GET /defect-types?includeInactive=true` returns retired types as well.

```jsonc
{
  "data": [
    {
      "id": 1, "name": "Weave Defect", "code": "WEAVE",
      "isActive": true, "isSystem": true, "sortOrder": 10,
      "usageCount": 7,
      "createdAt": "...", "updatedAt": "..."
    }
  ]
}
```

`POST /defect-types` takes `{ "name": "Slub / Neps" }`; the `code` is derived
from the name (`SLUB_NEPS`) unless supplied.

**Deletion rules.** A type can be hard-deleted only while `usageCount` is 0.
Once inspections reference it, `DELETE` returns `409 IN_USE` and the caller is
told to deactivate instead — deleting would rewrite history. Retired types stay
readable on existing records but cannot be chosen for new inspections, and
built-in types can be neither renamed, retired, nor deleted.

---

## Mock SAP integration

`POST /api/sap-webhook`, authenticated with a shared secret header rather than a
user token.

### Request

```
POST /api/sap-webhook
Content-Type: application/json
X-SAP-Secret: sap-dev-secret
```

```jsonc
{
  "NotificationNo": "10000451",              // required -> external_ref, and the idempotency key
  "PlantSection": "LOOM-14",                 // required -> machineId
  "DefectCode": "WEAVE",                     // optional -> defect type, matched on code
  "Priority": "1",                           // optional -> severity
  "NotificationDate": "2026-08-21",          // optional -> inspectedOn, defaults to today
  "ShortText": "Broken pick, roll 22"        // optional -> remarks
}
```

### Mapping

| SAP `Priority` | Severity |
| --- | --- |
| `1` | Critical |
| `2` | Major |
| `3` | Minor |
| anything else / absent | Major |

`DefectCode` is matched against the `code` column of `defect_types` (`WEAVE`,
`SHADE`, `HOLE`, `COUNT`, `OTHER`, plus any codes added at runtime).

### Two behaviours worth noting

**It never drops a message.** An unrecognised `DefectCode` is filed under
`Other` with the original code preserved in the remarks, rather than rejected —
a real inbound integration losing notifications is worse than one mis-filing
them.

**It is idempotent.** SAP retries. Replaying the same `NotificationNo` returns
`200` with the record that already exists, not `201` and a duplicate row. This
is enforced by a partial unique index on `external_ref`, so it holds even under
concurrent delivery.

### Try it

```bash
curl -X POST http://localhost:4000/api/sap-webhook \
  -H 'Content-Type: application/json' \
  -H 'X-SAP-Secret: sap-dev-secret' \
  -d '{"NotificationNo":"10000451","PlantSection":"LOOM-14","DefectCode":"WEAVE","Priority":"1","ShortText":"Broken pick, roll 22"}'
```

PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/sap-webhook `
  -Headers @{ 'X-SAP-Secret' = 'sap-dev-secret' } `
  -ContentType 'application/json' `
  -Body '{"NotificationNo":"10000451","PlantSection":"LOOM-14","DefectCode":"WEAVE","Priority":"1","ShortText":"Broken pick, roll 22"}'
```

Run it twice — the second call returns `200` and the inspection list still
contains exactly one row for that notification.
