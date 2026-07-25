// Bundles the server (plus the shared/ game engine it imports) into one file.
// Dependencies stay external so Render just installs them normally.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  packages: 'external',
  sourcemap: true,
  banner: {
    // Bundled CJS deps reach for `require` under ESM; shim just that. Path
    // globals are deliberately left alone — src/index.ts derives its own.
    js: [
      "import { createRequire as __createRequire } from 'module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('server bundled -> dist/index.js');
