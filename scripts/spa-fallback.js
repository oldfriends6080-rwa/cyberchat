#!/usr/bin/env node

/**
 * SPA Fallback Generator
 * 复制 index.html 为 404.html，确保 GitHub Pages 路由刷新不 404
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const distPath = join(process.cwd(), 'dist')
const indexPath = join(distPath, 'index.html')
const fallbackPath = join(distPath, '404.html')

if (!existsSync(indexPath)) {
  console.error('❌ index.html not found in dist/. Run build first.')
  process.exit(1)
}

const indexContent = readFileSync(indexPath, 'utf-8')
writeFileSync(fallbackPath, indexContent)

console.log('✅ Generated 404.html fallback for SPA routing')
