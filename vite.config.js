import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from project root
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'

  return {
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(__dirname, './'),
    envPrefix: 'VITE_',
    // Remove console.log em produção para segurança e performance
    esbuild: {
      drop: isProduction ? ['console', 'debugger'] : []
    },
    define: {
      // Expose VITE_ prefixed env vars with fallbacks
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY || ''),
      'import.meta.env.VITE_CLICKUP_API_KEY': JSON.stringify(env.VITE_CLICKUP_API_KEY || ''),
      'import.meta.env.VITE_CLICKUP_TEAM_ID': JSON.stringify(env.VITE_CLICKUP_TEAM_ID || ''),
      'import.meta.env.VITE_CLICKUP_SPACE_ID': JSON.stringify(env.VITE_CLICKUP_SPACE_ID || ''),
      'import.meta.env.VITE_CLICKUP_FOLDER_ID': JSON.stringify(env.VITE_CLICKUP_FOLDER_ID || ''),
      'import.meta.env.VITE_CLICKUP_LIST_ID': JSON.stringify(env.VITE_CLICKUP_LIST_ID || ''),
    }
  }
})
