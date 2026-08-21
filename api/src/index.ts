import { createApp } from './app.ts';
import { config } from './config.ts';
import { createDb } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { seedIfEmpty } from './db/seed.ts';

const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 19;

/** A clear message beats the cryptic syntax error an old Node would produce. */
function assertNodeVersion(): void {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)) return;

  console.error(
    `\nThis app needs Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} or newer -- you are running ${process.versions.node}.` +
      `\nInstall a current Node (see .nvmrc), or run the app with Docker: docker compose up\n`,
  );
  process.exit(1);
}

assertNodeVersion();

const db = createDb();
migrate(db);
seedIfEmpty(db);

const server = createApp(db).listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.dbPath}`);
});

// Without this, `docker compose down` waits out the full 10s grace period.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
