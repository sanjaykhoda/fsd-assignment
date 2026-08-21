import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { shiftIsoDate, todayLocalIso } from '../lib/dates.ts';
import { createTestContext, defectTypeId, type TestContext } from './helpers.ts';

describe('inspections API', () => {
  let ctx: TestContext;
  let weaveId: number;

  before(() => {
    ctx = createTestContext();
    weaveId = defectTypeId(ctx.db, 'WEAVE');
  });

  after(() => ctx.db.close());

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    machineId: 'LOOM-14',
    defectTypeId: weaveId,
    severity: 'Major',
    ...overrides,
  });

  const create = (overrides: Record<string, unknown> = {}) =>
    request(ctx.app).post('/api/inspections').set(ctx.auth).send(validBody(overrides));

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(ctx.app).get('/api/inspections');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  it('creates an inspection with 201, a Location header and Open status', async () => {
    const res = await create({ remarks: 'Broken pick' });

    assert.equal(res.status, 201);
    assert.equal(res.headers.location, `/api/inspections/${res.body.data.id}`);
    assert.equal(res.body.data.status, 'Open');
    assert.equal(res.body.data.machineId, 'LOOM-14');
    assert.equal(res.body.data.defectType, 'Weave Defect');
    assert.equal(res.body.data.source, 'manual');
    assert.equal(res.body.data.resolutionNote, null);
    assert.equal(res.body.data.inspectedOn, todayLocalIso(), 'defaults to today');
  });

  it('accepts a defect type by name as well as by id', async () => {
    const res = await request(ctx.app)
      .post('/api/inspections')
      .set(ctx.auth)
      .send({ machineId: 'LOOM-02', defectType: 'Hole/Tear', severity: 'Minor' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.defectType, 'Hole/Tear');
  });

  it('returns 422 with a field-level detail when severity is missing', async () => {
    const res = await request(ctx.app)
      .post('/api/inspections')
      .set(ctx.auth)
      .send({ machineId: 'LOOM-14', defectTypeId: weaveId });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.details[0].field, 'severity');
  });

  it('returns 422 for an unknown defect type', async () => {
    const res = await create({ defectTypeId: 9999 });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'defectTypeId');
  });

  it('returns 422 for an inspection dated in the future', async () => {
    const res = await create({ inspectedOn: shiftIsoDate(todayLocalIso(), 1) });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'inspectedOn');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(ctx.app)
      .post('/api/inspections')
      .set(ctx.auth)
      .set('Content-Type', 'application/json')
      .send('{not json');

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'MALFORMED_JSON');
  });

  // -------------------------------------------------------------------------
  // Resolve
  // -------------------------------------------------------------------------

  it('resolves an inspection and records the note and timestamp', async () => {
    const { body } = await create();
    const res = await request(ctx.app)
      .patch(`/api/inspections/${body.data.id}/resolve`)
      .set(ctx.auth)
      .send({ resolutionNote: 'Beam re-tensioned' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Resolved');
    assert.equal(res.body.data.resolutionNote, 'Beam re-tensioned');
    assert.ok(res.body.data.resolvedAt, 'resolvedAt is set');
  });

  // The brief's one non-negotiable rule.
  it('refuses to resolve with a whitespace-only note (422)', async () => {
    const { body } = await create();
    const res = await request(ctx.app)
      .patch(`/api/inspections/${body.data.id}/resolve`)
      .set(ctx.auth)
      .send({ resolutionNote: '   ' });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'resolutionNote');

    const after = await request(ctx.app).get(`/api/inspections/${body.data.id}`).set(ctx.auth);
    assert.equal(after.body.data.status, 'Open', 'stays Open after a rejected resolve');
  });

  it('refuses to resolve with no note at all (422)', async () => {
    const { body } = await create();
    const res = await request(ctx.app).patch(`/api/inspections/${body.data.id}/resolve`).set(ctx.auth).send({});
    assert.equal(res.status, 422);
  });

  it('returns 409 when resolving an already-resolved inspection', async () => {
    const { body } = await create();
    const url = `/api/inspections/${body.data.id}/resolve`;
    await request(ctx.app).patch(url).set(ctx.auth).send({ resolutionNote: 'First fix' });

    const res = await request(ctx.app).patch(url).set(ctx.auth).send({ resolutionNote: 'Second fix' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ALREADY_RESOLVED');

    const after = await request(ctx.app).get(`/api/inspections/${body.data.id}`).set(ctx.auth);
    assert.equal(after.body.data.resolutionNote, 'First fix', 'original note is preserved');
  });

  it('returns 404 for a non-existent inspection', async () => {
    const res = await request(ctx.app).get('/api/inspections/999999').set(ctx.auth);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('returns a JSON 404 for an unknown API route rather than HTML', async () => {
    const res = await request(ctx.app).get('/api/does-not-exist').set(ctx.auth);
    assert.equal(res.status, 404);
    assert.match(res.headers['content-type'], /json/);
  });
});

// ---------------------------------------------------------------------------
// Filtering, sorting and pagination get their own database so the row set is
// known exactly.
// ---------------------------------------------------------------------------

describe('inspections list: filtering, sorting, pagination', () => {
  let ctx: TestContext;
  const today = todayLocalIso();

  before(async () => {
    ctx = createTestContext();
    const weave = defectTypeId(ctx.db, 'WEAVE');
    const hole = defectTypeId(ctx.db, 'HOLE');

    const rows = [
      { machineId: 'LOOM-01', severity: 'Minor', defectTypeId: weave, inspectedOn: shiftIsoDate(today, -10) },
      { machineId: 'LOOM-02', severity: 'Critical', defectTypeId: weave, inspectedOn: shiftIsoDate(today, -5) },
      { machineId: 'LINE-A', severity: 'Major', defectTypeId: hole, inspectedOn: shiftIsoDate(today, -3) },
      { machineId: 'LINE-B', severity: 'Critical', defectTypeId: hole, inspectedOn: today },
      { machineId: 'LOOM-03', severity: 'Minor', defectTypeId: weave, inspectedOn: today },
    ];

    for (const row of rows) {
      await request(ctx.app).post('/api/inspections').set(ctx.auth).send(row);
    }
    // Resolve exactly one, so status filters and the summary have both buckets.
    await request(ctx.app).patch('/api/inspections/1/resolve').set(ctx.auth).send({ resolutionNote: 'Done' });
  });

  after(() => ctx.db.close());

  const list = (query: string) => request(ctx.app).get(`/api/inspections?${query}`).set(ctx.auth);

  it('filters by status', async () => {
    const open = await list('status=Open');
    const resolved = await list('status=Resolved');

    assert.equal(open.body.meta.total, 4);
    assert.equal(resolved.body.meta.total, 1);
    assert.equal(resolved.body.data[0].resolutionNote, 'Done');
  });

  it('filters by multiple severities', async () => {
    const res = await list('severity=Critical,Major');
    assert.equal(res.body.meta.total, 3);
    assert.ok(res.body.data.every((i: { severity: string }) => i.severity !== 'Minor'));
  });

  it('filters by defect type', async () => {
    const res = await list(`defectTypeId=${defectTypeId(ctx.db, 'HOLE')}`);
    assert.equal(res.body.meta.total, 2);
  });

  it('matches machineId as a case-insensitive substring', async () => {
    const res = await list('machineId=line');
    assert.equal(res.body.meta.total, 2);
  });

  // The off-by-one that date-range filters are famous for.
  it('treats from and to as inclusive on both boundaries', async () => {
    const from = shiftIsoDate(today, -5);
    const to = shiftIsoDate(today, -3);

    const res = await list(`from=${from}&to=${to}`);
    assert.equal(res.body.meta.total, 2, 'includes rows dated exactly on both bounds');

    const singleDay = await list(`from=${today}&to=${today}`);
    assert.equal(singleDay.body.meta.total, 2, 'a one-day range returns that day');
  });

  it('rejects a range where from is after to with 422', async () => {
    const res = await list(`from=${today}&to=${shiftIsoDate(today, -5)}`);
    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'from');
  });

  it('rejects a malformed date with 422', async () => {
    const res = await list('from=2026-02-30');
    assert.equal(res.status, 422);
  });

  // Alphabetically 'Critical' < 'Major' < 'Minor', so a naive sort is inverted.
  it('sorts severity by meaning, not alphabetically', async () => {
    const desc = await list('sort=severity&order=desc');
    assert.equal(desc.body.data[0].severity, 'Critical', 'desc = most severe first');
    assert.equal(desc.body.data.at(-1).severity, 'Minor');

    const asc = await list('sort=severity&order=asc');
    assert.equal(asc.body.data[0].severity, 'Minor');
    assert.equal(asc.body.data.at(-1).severity, 'Critical');
  });

  it('sorts by inspection date, newest first, by default', async () => {
    const res = await list('');
    const dates = res.body.data.map((i: { inspectedOn: string }) => i.inspectedOn);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });

  it('paginates with correct meta and no overlap between pages', async () => {
    const first = await list('pageSize=2&page=1');
    const second = await list('pageSize=2&page=2');

    assert.deepEqual(first.body.meta, { page: 1, pageSize: 2, total: 5, totalPages: 3 });
    assert.equal(first.body.data.length, 2);
    assert.equal(second.body.data.length, 2);

    const ids = [...first.body.data, ...second.body.data].map((i: { id: number }) => i.id);
    assert.equal(new Set(ids).size, 4, 'pages do not repeat rows');
  });

  it('caps pageSize at 100', async () => {
    const res = await list('pageSize=500');
    assert.equal(res.status, 422);
  });

  it('summarises counts by severity, zero-filling empty buckets', async () => {
    const res = await request(ctx.app).get('/api/inspections/summary').set(ctx.auth);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.totals, { open: 4, resolved: 1, total: 5 });
    assert.deepEqual(res.body.data.bySeverity, [
      { severity: 'Critical', open: 2, resolved: 0, total: 2 },
      { severity: 'Major', open: 1, resolved: 0, total: 1 },
      { severity: 'Minor', open: 1, resolved: 1, total: 2 },
    ]);
  });

  it('applies date filters to the summary as well as the list', async () => {
    const res = await request(ctx.app).get(`/api/inspections/summary?from=${today}&to=${today}`).set(ctx.auth);
    assert.equal(res.body.data.totals.total, 2);
  });
});
