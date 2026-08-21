import { config } from '../config.ts';
import { createDefectTypeRepository } from '../defect-types/repository.ts';
import { createInspectionRepository } from '../inspections/repository.ts';
import type { Severity } from '../domain/constants.ts';
import { shiftIsoDate, todayLocalIso } from '../lib/dates.ts';
import { assertNodeVersion } from '../lib/node-version.ts';
import { createDb, type Db } from './client.ts';
import { migrate } from './migrate.ts';

interface DemoRow {
  daysAgo: number;
  machineId: string;
  code: string;
  severity: Severity;
  remarks: string;
  resolution?: string;
}

/**
 * Fixed, not random: a reviewer who reseeds gets the same screen, and the API
 * tests can assert on real counts. Spread across 30 days, every severity and
 * every defect type, roughly 40% resolved, so the list, the filters and the
 * summary all have something to show on first load.
 */
const DEMO_ROWS: DemoRow[] = [
  { daysAgo: 0, machineId: 'LOOM-14', code: 'WEAVE', severity: 'Critical', remarks: 'Broken pick repeating every ~2m across the width' },
  { daysAgo: 0, machineId: 'LOOM-03', code: 'SHADE', severity: 'Minor', remarks: 'Slight shade drift against approved swatch' },
  { daysAgo: 1, machineId: 'LINE-B2', code: 'COUNT', severity: 'Major', remarks: 'Weft count reading 46 against spec 50' },
  { daysAgo: 1, machineId: 'LOOM-07', code: 'HOLE', severity: 'Critical', remarks: 'Tear near selvedge, roll pulled from despatch', resolution: 'Temple rings replaced; two rolls re-inspected and cleared' },
  { daysAgo: 2, machineId: 'LOOM-14', code: 'WEAVE', severity: 'Major', remarks: 'Reed mark visible under raking light' },
  { daysAgo: 3, machineId: 'LINE-A1', code: 'SHADE', severity: 'Major', remarks: 'Batch-to-batch variation on navy dye lot', resolution: 'Dye lot rejected, re-dyed against master swatch' },
  { daysAgo: 4, machineId: 'LOOM-22', code: 'OTHER', severity: 'Minor', remarks: 'Oil spotting near beam, cleaned in place', resolution: 'Lubrication line re-routed and guard fitted' },
  { daysAgo: 5, machineId: 'LOOM-03', code: 'COUNT', severity: 'Minor', remarks: 'EPI marginally low on the first 20m' },
  { daysAgo: 6, machineId: 'LINE-B2', code: 'WEAVE', severity: 'Critical', remarks: 'Float defect across full width, production stopped' },
  { daysAgo: 7, machineId: 'LOOM-11', code: 'HOLE', severity: 'Major', remarks: 'Pinholes at regular intervals', resolution: 'Worn dropper wire replaced on frame 3' },
  { daysAgo: 9, machineId: 'LOOM-07', code: 'SHADE', severity: 'Minor', remarks: 'Barre visible in transmitted light only' },
  { daysAgo: 10, machineId: 'LINE-A1', code: 'COUNT', severity: 'Major', remarks: 'Denier deviation flagged by lab sample' },
  { daysAgo: 11, machineId: 'LOOM-14', code: 'WEAVE', severity: 'Minor', remarks: 'Isolated double end, trimmed', resolution: 'Operator retrained on drawing-in sequence' },
  { daysAgo: 13, machineId: 'LOOM-22', code: 'OTHER', severity: 'Major', remarks: 'Selvedge curling on take-up' },
  { daysAgo: 14, machineId: 'LOOM-11', code: 'HOLE', severity: 'Critical', remarks: 'Large tear, 8m of roll scrapped', resolution: 'Faulty temple assembly swapped; scrap logged against batch' },
  { daysAgo: 16, machineId: 'LINE-B2', code: 'SHADE', severity: 'Major', remarks: 'Tailing between roll start and end' },
  { daysAgo: 18, machineId: 'LOOM-03', code: 'WEAVE', severity: 'Major', remarks: 'Starting mark after shift changeover', resolution: 'Loom-start parameters corrected on the controller' },
  { daysAgo: 20, machineId: 'LOOM-07', code: 'COUNT', severity: 'Minor', remarks: 'Within tolerance but trending low' },
  { daysAgo: 22, machineId: 'LINE-A1', code: 'HOLE', severity: 'Major', remarks: 'Snags traced to a rough guide roller', resolution: 'Guide roller polished and re-chromed' },
  { daysAgo: 24, machineId: 'LOOM-14', code: 'OTHER', severity: 'Minor', remarks: 'Fluff accumulation affecting finish' },
  { daysAgo: 26, machineId: 'LOOM-22', code: 'WEAVE', severity: 'Critical', remarks: 'Repeating weft bar across four rolls', resolution: 'Weft accumulator serviced; affected rolls downgraded' },
  { daysAgo: 28, machineId: 'LOOM-11', code: 'SHADE', severity: 'Minor', remarks: 'Minor variation, accepted by customer', resolution: 'Customer concession recorded against order 44182' },
];

/** Two records that arrived through the mock SAP webhook rather than the UI. */
const DEMO_SAP_ROWS = [
  { daysAgo: 2, machineId: 'LOOM-09', code: 'WEAVE', severity: 'Critical' as Severity, notificationNo: '10000451', text: 'Broken pick, roll 22' },
  { daysAgo: 8, machineId: 'LINE-C4', code: 'COUNT', severity: 'Major' as Severity, notificationNo: '10000462', text: 'Count deviation flagged by inline gauge' },
];

export function seedDemoData(db: Db): number {
  const inspections = createInspectionRepository(db);
  const defectTypes = createDefectTypeRepository(db);
  const today = todayLocalIso();

  const idByCode = new Map(defectTypes.list(true).map((type) => [type.code, type.id]));

  return db.transaction(() => {
    let inserted = 0;

    for (const row of DEMO_ROWS) {
      const created = inspections.create({
        inspectedOn: shiftIsoDate(today, -row.daysAgo),
        machineId: row.machineId,
        defectTypeId: idByCode.get(row.code)!,
        severity: row.severity,
        remarks: row.remarks,
      });
      if (row.resolution) inspections.resolve(created.id, row.resolution);
      inserted += 1;
    }

    for (const row of DEMO_SAP_ROWS) {
      inspections.create({
        inspectedOn: shiftIsoDate(today, -row.daysAgo),
        machineId: row.machineId,
        defectTypeId: idByCode.get(row.code)!,
        severity: row.severity,
        remarks: `${row.text} | SAP notification ${row.notificationNo}`,
        source: 'sap',
        externalRef: row.notificationNo,
      });
      inserted += 1;
    }

    return inserted;
  });
}

/**
 * Called on boot. Only ever fills an empty table, so a restart can never wipe
 * real data -- reseeding on purpose is `npm run seed`, which is explicit.
 */
export function seedIfEmpty(db: Db): void {
  const row = db.get<{ count: number }>('SELECT COUNT(*) AS count FROM inspections');
  if ((row?.count ?? 0) > 0) return;

  const inserted = seedDemoData(db);
  console.log(`Seeded ${inserted} demo inspections (empty database detected).`);
}

/** `npm run seed` -- wipes inspections and reinserts the demo set. */
function main(): void {
  assertNodeVersion('seed');
  const db = createDb();
  migrate(db);
  db.run('DELETE FROM inspections');
  const inserted = seedDemoData(db);
  console.log(`Reseeded ${inserted} demo inspections into ${config.dbPath}`);
  db.close();
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
