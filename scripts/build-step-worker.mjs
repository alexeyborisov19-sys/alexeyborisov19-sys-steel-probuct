import { build } from 'esbuild';
import path from 'node:path';

await build({
  entryPoints: ['lib/server/instant-quote/step-process-entry.ts'],
  outfile: path.join(process.env.NEXT_DIST_DIR || '.next', 'server', 'steel-step-worker.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  external: ['occt-wasm'], logLevel: 'warning',
});
