import { defineConfig } from 'tsdown'

export default defineConfig([
  // ESM build
  {
    entry: ['src/**/*.js'],
    format: 'esm',
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: false,
    unbundle: true,
    outDir: 'dist/esm',
    target: 'es2020',
    esbuildOptions (options) {
      options.drop = ['console', 'debugger']
      options.legalComments = 'none'
    }
  },
  // CJS build
  {
    entry: ['src/**/*.js'],
    format: 'cjs',
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: false,
    unbundle: true,
    outDir: 'dist/cjs',
    target: 'es2020',
    esbuildOptions (options) {
      options.drop = ['console', 'debugger']
      options.legalComments = 'none'
    }
  }
])
