import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { config } from '../config.ts';
import { todayLocalIso } from '../lib/dates.ts';
import { createTestContext, type TestContext } from './helpers.ts';

describe('mock SAP webhook', () => {
  let ctx: TestContext;

  before(() => {
    ctx = createTestContext();
  });

  after(() => ctx.db.close());

  const payload = (overrides: Record<string, unknown> = {}) => ({
    NotificationNo: '10000451',
    PlantSection: 'LOOM-14',
    DefectCode: 'WEAVE',
    Priority: '1',
    NotificationDate: todayLocalIso(),
    ShortText: 'Broken pick, roll 22',
    ...overrides,
  });

  const post = (body: unknown, secret: string | null = config.sap.webhookSecret) => {
    const req = request(ctx.app).post('/api/sap-webhook');
    if (secret !== null) req.set('X-SAP-Secret', secret);
    return req.send(body);
  };

  it('rejects a request with no shared secret', async () => {
    const res = await post(payload(), null);
    assert.equal(res.status, 401);
  });

  it('rejects a wrong shared secret', async () => {
    const res = await post(payload(), 'wrong-secret');
    assert.equal(res.status, 401);
  });

  it('maps a valid payload onto an inspection with 201', async () => {
    const res = await post(payload());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.machineId, 'LOOM-14');
    assert.equal(res.body.data.defectType, 'Weave Defect');
    assert.equal(res.body.data.severity, 'Critical', 'Priority 1 maps to Critical');
    assert.equal(res.body.data.source, 'sap');
    assert.equal(res.body.data.externalRef, '10000451');
    assert.equal(res.body.data.status, 'Open');
    assert.match(res.body.data.remarks, /Broken pick, roll 22/);
  });

  // SAP retries. A retry must not create a second inspection.
  it('is idempotent: a replay returns 200 with the original record', async () => {
    const replay = await post(payload());

    assert.equal(replay.status, 200, 'not 201 -- nothing new was created');
    assert.equal(replay.body.data.externalRef, '10000451');

    const list = await request(ctx.app).get('/api/inspections?machineId=LOOM-14').set(ctx.auth);
    assert.equal(list.body.meta.total, 1, 'exactly one row for this notification');
  });

  it('files an unrecognised defect code under Other and keeps the original code', async () => {
    const res = await post(payload({ NotificationNo: '10000999', DefectCode: 'MYSTERY' }));

    assert.equal(res.status, 201, 'an unknown code must not drop the message');
    assert.equal(res.body.data.defectType, 'Other');
    assert.match(res.body.data.remarks, /MYSTERY/);
  });

  it('maps priorities to severities and defaults an unknown priority to Major', async () => {
    const major = await post(payload({ NotificationNo: 'P2', Priority: '2' }));
    const minor = await post(payload({ NotificationNo: 'P3', Priority: '3' }));
    const unknown = await post(payload({ NotificationNo: 'P9', Priority: '9' }));
    const missing = await post(payload({ NotificationNo: 'P0', Priority: undefined }));

    assert.equal(major.body.data.severity, 'Major');
    assert.equal(minor.body.data.severity, 'Minor');
    assert.equal(unknown.body.data.severity, 'Major');
    assert.equal(missing.body.data.severity, 'Major');
  });

  it('accepts a numeric NotificationNo as well as a string', async () => {
    const res = await post(payload({ NotificationNo: 20000123 }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.externalRef, '20000123');
  });

  it('defaults the date to today when the payload omits it', async () => {
    const res = await post(payload({ NotificationNo: 'NO-DATE', NotificationDate: undefined }));
    assert.equal(res.body.data.inspectedOn, todayLocalIso());
  });

  it('returns 422 when a required field is missing', async () => {
    const res = await post({ PlantSection: 'LOOM-01' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'NotificationNo');
  });
});

describe('auth', () => {
  let ctx: TestContext;

  before(() => {
    ctx = createTestContext();
  });

  after(() => ctx.db.close());

  it('issues a token for the configured credentials', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: config.auth.username, password: config.auth.password });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.username, config.auth.username);
  });

  it('rejects a wrong password with the same message as a wrong username', async () => {
    const badPassword = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: config.auth.username, password: 'wrong' });
    const badUsername = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: config.auth.password });

    assert.equal(badPassword.status, 401);
    assert.equal(badUsername.status, 401);
    assert.equal(badPassword.body.error.message, badUsername.body.error.message);
  });

  it('rejects a garbage bearer token', async () => {
    const res = await request(ctx.app).get('/api/inspections').set({ Authorization: 'Bearer not-a-token' });
    assert.equal(res.status, 401);
  });

  it('leaves the health endpoint open', async () => {
    const res = await request(ctx.app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'ok');
  });
});
