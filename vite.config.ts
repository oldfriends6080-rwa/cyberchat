import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), nodePolyfills({
    globals: {
      Buffer: true,
      global: true,
      process: true,
    },
  })],
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
      },
      output: {
        // GitHub Pages SPA fallback: 所有路由重定向到 index.html
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
  // XMTP WASM 库路径修复
  assetsInclude: ['**/*.wasm'],
  // 生产环境使用相对路径（SPA 部署）
  base: mode === 'production' ? '/cyberchat/' : '/',
}))
