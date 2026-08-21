import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createTestContext, defectTypeId, type TestContext } from './helpers.ts';

describe('defect types API', () => {
  let ctx: TestContext;

  before(() => {
    ctx = createTestContext();
  });

  after(() => ctx.db.close());

  const post = (body: unknown) => request(ctx.app).post('/api/defect-types').set(ctx.auth).send(body);

  it('seeds the five defect types named in the brief', async () => {
    const res = await request(ctx.app).get('/api/defect-types').set(ctx.auth);

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((d: { name: string }) => d.name),
      ['Weave Defect', 'Shade Variation', 'Hole/Tear', 'Count Deviation', 'Other'],
    );
    assert.ok(res.body.data.every((d: { isSystem: boolean }) => d.isSystem));
  });

  it('creates a custom type, deriving the code from the name', async () => {
    const res = await post({ name: 'Slub / Neps' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.code, 'SLUB_NEPS');
    assert.equal(res.body.data.isActive, true);
    assert.equal(res.body.data.isSystem, false);
    assert.equal(res.body.data.usageCount, 0);
  });

  it('rejects a duplicate name regardless of case with 409', async () => {
    const res = await post({ name: 'slub / neps' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE');
  });

  it('rejects a blank name with 422', async () => {
    const res = await post({ name: '   ' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'name');
  });

  it('refuses to rename or deactivate a built-in type', async () => {
    const weave = defectTypeId(ctx.db, 'WEAVE');

    const renamed = await request(ctx.app).patch(`/api/defect-types/${weave}`).set(ctx.auth).send({ name: 'Nope' });
    assert.equal(renamed.status, 422);

    const deactivated = await request(ctx.app)
      .patch(`/api/defect-types/${weave}`)
      .set(ctx.auth)
      .send({ isActive: false });
    assert.equal(deactivated.status, 422);

    const deleted = await request(ctx.app).delete(`/api/defect-types/${weave}`).set(ctx.auth);
    assert.equal(deleted.status, 409);
  });

  it('hard-deletes a custom type while nothing references it', async () => {
    const { body } = await post({ name: 'Temporary' });
    const res = await request(ctx.app).delete(`/api/defect-types/${body.data.id}`).set(ctx.auth);
    assert.equal(res.status, 204);
  });

  it('blocks deletion once inspections reference the type, and deactivates instead', async () => {
    const { body } = await post({ name: 'Edge Damage' });
    const typeId = body.data.id;

    await request(ctx.app)
      .post('/api/inspections')
      .set(ctx.auth)
      .send({ machineId: 'LOOM-01', defectTypeId: typeId, severity: 'Major' });

    const deleted = await request(ctx.app).delete(`/api/defect-types/${typeId}`).set(ctx.auth);
    assert.equal(deleted.status, 409, 'deleting would rewrite history');
    assert.equal(deleted.body.error.code, 'IN_USE');

    const deactivated = await request(ctx.app)
      .patch(`/api/defect-types/${typeId}`)
      .set(ctx.auth)
      .send({ isActive: false });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.data.isActive, false);
  });

  it('hides inactive types by default but still returns them on request', async () => {
    const active = await request(ctx.app).get('/api/defect-types').set(ctx.auth);
    const all = await request(ctx.app).get('/api/defect-types?includeInactive=true').set(ctx.auth);

    const names = (res: { body: { data: { name: string }[] } }) => res.body.data.map((d) => d.name);
    assert.ok(!names(active).includes('Edge Damage'));
    assert.ok(names(all).includes('Edge Damage'));
  });

  it('refuses to log a new inspection against an inactive type', async () => {
    const all = await request(ctx.app).get('/api/defect-types?includeInactive=true').set(ctx.auth);
    const inactive = all.body.data.find((d: { isActive: boolean }) => !d.isActive);

    const res = await request(ctx.app)
      .post('/api/inspections')
      .set(ctx.auth)
      .send({ machineId: 'LOOM-01', defectTypeId: inactive.id, severity: 'Major' });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.details[0].field, 'defectTypeId');
  });

  it('keeps existing inspections readable after their type is deactivated', async () => {
    const res = await request(ctx.app).get('/api/inspections?machineId=LOOM-01').set(ctx.auth);
    assert.ok(res.body.data.some((i: { defectType: string }) => i.defectType === 'Edge Damage'));
  });
});
