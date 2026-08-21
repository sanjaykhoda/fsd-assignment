// tsc only emits .js — schema.sql has to be copied into dist/ by hand.
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await cp(resolve(root, 'src/db/schema.sql'), resolve(root, 'dist/db/schema.sql'));
console.log('copied schema.sql -> dist/db/schema.sql');
