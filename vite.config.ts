import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    exclude: ['@xmtp/wasm-bindings', '@xmtp/browser-sdk'],
    include: ['@xmtp/proto'],
  },
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
        // 强制 reflect-metadata 保留副作用（防止被 tree-shake）
        moduleSideEffects: (id) => {
          return /node_modules[\\/]reflect-metadata/.test(id)
        },
      },
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
  base: mode === 'production' ? '/cyberchat/' : '/',
}))
