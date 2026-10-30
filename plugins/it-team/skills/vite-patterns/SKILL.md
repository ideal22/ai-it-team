---
name: vite-patterns
description: Vite config, plugins, env vars, proxy, chunking, pre-bundling, and pitfalls, version-gated for Vite 7 (Rollup) vs 8 (Rolldown). Use when editing vite.config.ts or debugging Vite dev/build issues.
---

# Vite Patterns

Build-tool and dev-server patterns for Vite-based React + TypeScript apps. Run scripts via the
lockfile's package manager (yarn default).

## When to Activate

- Editing `vite.config.ts`, adding plugins, aliases, proxy, or chunking
- Setting up `.env` files or exposing config to the client
- Debugging HMR, slow dev server, pre-bundling / CJS interop, or dev-vs-build differences
- Publishing a library with `build.lib`
- Build failures that need deeper triage: hand off to the `build-error-resolver` agent

## Version Gate (check `vite` in package.json first)

| Concern | Vite 7 | Vite 8 |
|---|---|---|
| Production bundler | Rollup | Rolldown |
| Bundler options key | `build.rollupOptions` | `build.rolldownOptions` (`rollupOptions` kept as compat alias) |
| Default minifier | esbuild | Oxc (`minify: 'oxc'`) |
| Dep pre-bundling | esbuild | Rolldown |

Everything below works on both unless marked **[Vite 8 only]**. Don't emit Rolldown/Oxc options
into a Vite 7 project.

## How It Works

- **Dev** serves source as native ESM and transforms per request - fast cold start, precise HMR
- **Build** bundles with Rollup (7) or Rolldown (8), with tree-shaking and code splitting
- **Pre-bundling** converts CJS/UMD deps to ESM once, cached in `node_modules/.vite`
- **Env vars** are statically inlined at build time; only `VITE_`-prefixed vars reach client code
- **`vite build` does not type-check** - run `tsc -b` (or `tsc --noEmit`) before/with the build

## Base Config

```ts
// vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

Keep the alias in sync with `tsconfig.json` `paths` (`"@/*": ["./src/*"]`), or use
`vite-tsconfig-paths` instead of duplicating many aliases.

## React Plugin Choice

| Plugin | Transform | Pick it when |
|---|---|---|
| `@vitejs/plugin-react` | Babel when Babel plugins are configured | You need Babel plugins - including **React Compiler** (`babel-plugin-react-compiler`) |
| `@vitejs/plugin-react-swc` | SWC | You want SWC and need no Babel plugins (SWC plugins are possible) |

Both provide Fast Refresh. Choose by plugin needs, not speed folklore.

```ts
// React Compiler via the Babel-based plugin
react({ babel: { plugins: ['babel-plugin-react-compiler'] } })
```

## Useful Plugins

| Plugin | Purpose |
|---|---|
| `@tailwindcss/vite` | Tailwind v4 |
| `vite-plugin-checker` | `tsc` + ESLint in a worker with an overlay in dev |
| `vite-tsconfig-paths` | Honor `tsconfig` `paths` |
| `vite-plugin-svgr` | SVGs as React components |
| `rollup-plugin-visualizer` | Bundle treemap for size audits |
| `vite-plugin-pwa` | PWA + Workbox |
| `vite-plugin-dts` | `.d.ts` emission in library mode |

Custom plugin skeleton (start inline; extract only if reused):

```ts
import type { Plugin } from 'vite'

function customFormat(): Plugin {
  return {
    name: 'custom-format',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.custom')) return null
      return { code: `export default ${JSON.stringify(code)}`, map: null }
    },
  }
}
```

Virtual modules: `resolveId` returns `'\0virtual:id'`; user code imports `'virtual:id'`.
Debug the pipeline with `vite-plugin-inspect`.

## Environment Variables

Load order: `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local` (later wins).

```ts
// src/vite-env.d.ts - type your vars
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SENTRY_DSN?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Validate at startup with Zod in `shared/config` so a missing var fails fast:

```ts
import { z } from 'zod'

const EnvSchema = z.object({ VITE_API_URL: z.string().url() })
export const env = EnvSchema.parse(import.meta.env)
```

### Security traps

- **`VITE_` exposes the value to the client.** Anything `VITE_`-prefixed is inlined into the
  shipped JS; minification or disabled source maps do not hide it. Only public values (API base
  URLs, feature flags, publishable keys) go there. Secrets stay server-side.
- **`envPrefix: ''`** exposes every env var to client code. Never.
- **`loadEnv(mode, cwd, '')`** loads all vars, including secrets; feeding them into `define`
  ships them. Pass an explicit prefix list instead.

```ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_'])
  return { define: { __APP_API__: JSON.stringify(env.VITE_API_URL) } }
})
```

- Production source maps leak source; keep `build.sourcemap: false` or use `'hidden'` and upload
  to your error tracker
- Gitignore `.env.local`, `.env.*.local`, `dist/`

## Dev Server

```ts
server: {
  port: 5173,
  strictPort: true,            // fail instead of silently picking another port (E2E relies on it)
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
  warmup: { clientFiles: ['./src/main.tsx', './src/app/**/*.tsx'] },
}
```

- WebSocket proxy: add `ws: true`
- Containers: `host: true` to bind `0.0.0.0`; behind a reverse proxy set `hmr.clientPort`
- Monorepo: `server.fs.allow` to serve files above the project root
- Slow dev server: `vite --profile`, press `p` + Enter, inspect the `.cpuprofile`

## Build Optimization

### Chunking

```ts
// Vite 7
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        react: ['react', 'react-dom'],
        radix: ['@radix-ui/react-dialog', '@radix-ui/react-popover'],
      },
    },
  },
}
```

**[Vite 8 only]** the same under `build.rolldownOptions`; check the Rolldown docs for its
native chunk-grouping options before porting complex `manualChunks` functions.

- Prefer route-level `lazy()` splitting first; manual chunks are a second step
- Don't create one chunk per package - hundreds of tiny requests

### Minification

- Vite 7: default esbuild; `minify: 'terser'` if you need terser options
- **[Vite 8 only]** default `minify: 'oxc'`; `'terser'` still available

### Barrels (FSD-compatible)

- FSD slice public-API barrels (`entities/x/index.ts`) are **required** - keep them lean
- Avoid giant re-export-everything barrels inside `shared/ui` and for icon libraries; import
  individual components/icons. Large barrels force Vite to transform every re-exported module in
  dev even when one symbol is used.

## Dependency Pre-Bundling

```ts
optimizeDeps: {
  include: ['some-cjs-package', 'deep-lib/components/**'],
  exclude: ['local-esm-package'],
}
```

- Add to `include` when a CJS dep breaks interop or a late-discovered dep triggers a full reload
- `vite --force` (or deleting `node_modules/.vite`) to clear a stale cache after dep changes or
  branch switches

## Library Mode

```ts
build: {
  lib: {
    entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    formats: ['es'],
    fileName: 'index',
  },
  rollupOptions: {   // [Vite 8: rolldownOptions]
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  },
}
```

- Externalize every peer dependency or consumers get duplicate React
- Types are not emitted: add `vite-plugin-dts` or `tsc --emitDeclarationOnly`

## Testing Integration

Vitest reads `vite.config.ts`; add a `test` block (or a separate `vitest.config.ts` via
`mergeConfig`). Add `/// <reference types="vitest/config" />` at the top for typed `test`
options. Coverage thresholds follow the project's configuration.

## Common Pitfalls

- **Dev differs from build** (CJS interop, CSS order): verify with `yarn build && yarn preview`
- **`vite preview` is not a production server** - deploy `dist/` to a static host/CDN
- **SPA routing 404s** on refresh: configure the host to fall back to `index.html`
- **Stale chunks after deploy**: keep old assets for a window; catch dynamic-import failures
  (`vite:preloadError` event) and reload
- **`require()` in app code** - Vite is ESM-first; use `import`
- **Reassigning `import.meta.hot.data`** - mutate its properties instead
- **`@vitejs/plugin-legacy` by default** - large bundle cost; add only if analytics demand it

## Quick Reference

| Need | Use |
|---|---|
| Typed config | `defineConfig` |
| Path alias | `fileURLToPath(new URL('./src', import.meta.url))` or `vite-tsconfig-paths` |
| Type-check | `tsc -b` in the build script / `vite-plugin-checker` in dev |
| Env in config | `loadEnv(mode, process.cwd(), ['VITE_'])` |
| API in dev | `server.proxy` |
| Container | `server.host: true` |
| Bundle audit | `rollup-plugin-visualizer` |
| Smoke-test prod build | `yarn build && yarn preview` |

<!-- Adapted from everything-claude-code by Affaan Mustafa (MIT License). See ~/.claude/THIRD_PARTY_NOTICES.md -->
