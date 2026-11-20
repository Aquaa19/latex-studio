import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function texliveDevPlugin() {
  return {
    name: 'texlive-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/texlive', async (req, res, next) => {
        try {
          const { default: handler } = await import('./api/texlive.js');
          await handler(req, res);
        } catch (err) {
          next(err);
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), texliveDevPlugin()],
})
