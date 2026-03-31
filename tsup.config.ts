import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'reader/index': 'src/reader/index.ts',
  },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  format: ['esm'],
  outDir: 'dist',
  sourcemap: true,
  target: 'es2020',
});
