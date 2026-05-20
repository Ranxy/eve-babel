import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve('src/main/main.ts')
      },
      outDir: 'out/main'
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve('src/main/preload.ts'),
        formats: ['cjs']
      },
      outDir: 'out/preload',
      rollupOptions: {
        output: {
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    build: {
      outDir: '../../out/renderer'
    },
    root: 'src/renderer',
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})