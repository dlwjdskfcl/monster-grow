// TypeScript 파일을 esbuild 로 묶어서 바로 실행 (예: node scripts/run-ts.mjs scripts/balance-sim.ts)
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const entry = process.argv[2];
const out = join(mkdtempSync(join(tmpdir(), 'mk-')), 'run.mjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
process.argv.splice(2, 1);
await import(pathToFileURL(out).href);
