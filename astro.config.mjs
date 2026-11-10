import { defineConfig } from 'astro/config'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readMedia } from './scripts/media.mjs'
import { siteConfig } from './config.mjs'
export default defineConfig({
  site: siteConfig.baseUrl,
  output: 'static',
  trailingSlash: 'always',
  integrations: [{ name: 'ade-comparison:public-media', hooks: { 'astro:build:done': ({ dir }) => {
    for (const image of readMedia()) {
      const target = new URL(`media/${image.path}`, dir)
      mkdirSync(dirname(fileURLToPath(target)), { recursive: true })
      copyFileSync(new URL(`media/${image.path}`, import.meta.url), target)
    }
  } } }],
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: 0 }, ssr: { external: ['sharp'] } },
})
