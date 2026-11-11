// Bundles the three parts of the extension into dist/ and copies the static files.
import { build, context } from 'esbuild';
import { cp, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: {
    background: 'src/background.ts',
    content: 'src/content/index.ts',
    panel: 'src/panel/panel.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  logLevel: 'info',
};

await rm('dist', { recursive: true, force: true });
await cp('static', 'dist', { recursive: true });
if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
