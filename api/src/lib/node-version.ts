const MIN_MAJOR = 20;
const MIN_MINOR = 19;

/**
 * Checked by every entry point, not just the server. Vite requires
 * >=20.19, and better-sqlite3 is compiled against a specific Node ABI, so an
 * older runtime fails in ways that look unrelated -- a proxy ECONNREFUSED, or
 * a cryptic module error. One clear sentence up front is worth a lot here.
 */
export function assertNodeVersion(context: string): void {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR)) return;

  console.error(
    `\n[${context}] This app needs Node ${MIN_MAJOR}.${MIN_MINOR} or newer -- you are running ${process.versions.node}.\n` +
      `\nUpgrade Node (see .nvmrc, which pins 22.12.0), then re-run 'npm install' so the\n` +
      `native SQLite module is rebuilt for it. Alternatively run the app with Docker:\n` +
      `  docker compose up --build\n`,
  );
  process.exit(1);
}
