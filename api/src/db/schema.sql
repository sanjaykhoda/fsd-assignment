-- Idempotent schema. Re-executed on every boot; safe to run repeatedly.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- defect_types
-- ---------------------------------------------------------------------------
-- Defect types are data, not a hardcoded enum: a plant adds its own defect
-- categories over time without a code change or a migration. The five types
-- named in the brief are seeded below and flagged is_system so they cannot be
-- deleted out from under existing records.
CREATE TABLE IF NOT EXISTS defect_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  code        TEXT    NOT NULL COLLATE NOCASE UNIQUE,  -- short key; SAP payloads map on this
  is_active   INTEGER NOT NULL DEFAULT 1   CHECK (is_active IN (0, 1)),
  is_system   INTEGER NOT NULL DEFAULT 0   CHECK (is_system IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 100,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (length(trim(name)) > 0),
  CHECK (length(trim(code)) > 0)
);

-- ---------------------------------------------------------------------------
-- inspections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- A calendar date ('YYYY-MM-DD'), deliberately NOT a timestamp: "the defect
  -- on the 14th" is a plant-local fact, so range filtering is an exact
  -- lexicographic BETWEEN with no timezone arithmetic anywhere.
  inspected_on    TEXT    NOT NULL CHECK (inspected_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  machine_id      TEXT    NOT NULL CHECK (length(trim(machine_id)) > 0),
  defect_type_id  INTEGER NOT NULL REFERENCES defect_types(id) ON DELETE RESTRICT,
  severity        TEXT    NOT NULL CHECK (severity IN ('Critical', 'Major', 'Minor')),
  remarks         TEXT,

  status          TEXT    NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved')),
  resolution_note TEXT,
  resolved_at     TEXT,

  source          TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'sap')),
  external_ref    TEXT,   -- SAP notification number; makes the webhook idempotent

  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- The brief's hardest rule -- a resolution note is mandatory -- enforced at
  -- the lowest layer, so no code path can bypass it.
  CHECK (status = 'Open' OR (resolution_note IS NOT NULL AND length(trim(resolution_note)) > 0)),
  CHECK (status = 'Open' OR resolved_at IS NOT NULL)
);

CREATE INDEX        IF NOT EXISTS idx_insp_status_severity ON inspections (status, severity);
CREATE INDEX        IF NOT EXISTS idx_insp_inspected_on    ON inspections (inspected_on DESC);
CREATE INDEX        IF NOT EXISTS idx_insp_defect_type     ON inspections (defect_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insp_external_ref    ON inspections (external_ref) WHERE external_ref IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Bootstrap data: the five defect types named in the assignment brief.
-- INSERT OR IGNORE keeps this idempotent across restarts.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO defect_types (name, code, is_system, sort_order) VALUES
  ('Weave Defect',    'WEAVE', 1, 10),
  ('Shade Variation', 'SHADE', 1, 20),
  ('Hole/Tear',       'HOLE',  1, 30),
  ('Count Deviation', 'COUNT', 1, 40),
  ('Other',           'OTHER', 1, 99);
