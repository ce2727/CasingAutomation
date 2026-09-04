import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isVercel = !!process.env.VERCEL;

  return {
    plugins: [
      react(),
      // Disable Electron plugins on Vercel to avoid build issues and unnecessary overhead
      !isVercel && electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                external: ['express', 'socket.io', 'localtunnel', 'http', 'path', 'url', 'fs']
              }
            }
          }
        },
      ]),
      !isVercel && renderer(),
    ].filter(Boolean),
    build: {
      // Ensure build terminates and doesn't watch
      watch: null,
    },
    envPrefix: ['VITE_', 'METERED_'],
  }
})
