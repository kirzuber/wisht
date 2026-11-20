import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const diagnosticEvents: Plugin = {
  name: 'wisht-terminal-diagnostics',
  configureServer(server) {
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(server.config.env.VITE_SUPABASE_URL||'')) {
      throw new Error('[Wisht] Vite dev requires local Supabase. Run npm run dev from the repository root.');
    }
    server.ws.on('wisht:diagnostic', payload => {
      const { level, event, details } = payload ?? {};
      if (typeof event !== 'string' || !/^(?:wish|deed|auth)\.[a-z_.]{1,55}$/.test(event)) return;
      if (level !== 'info' && level !== 'error') return;
      const fields = [
        typeof details?.step === 'string' && /^[a-zA-Z_ ]{1,40}$/.test(details.step) ? `step=${details.step}` : '',
        typeof details?.code === 'string' && /^[a-zA-Z0-9_]{1,48}$/.test(details.code) ? `code=${details.code}` : '',
        Number.isInteger(details?.status) && details.status >= 0 && details.status <= 599 ? `status=${details.status}` : '',
      ].filter(Boolean);
      const message = `[Wisht] browser ${event}${fields.length ? ' ' + fields.join(' ') : ''}`;
      if (level === 'error') server.config.logger.error(message);
      else server.config.logger.info(message);
    });
  },
};

export default defineConfig({
  plugins: [react(), diagnosticEvents],
  server: { port: Number(process.env.VITE_DEV_PORT||5173), strictPort: true,
    proxy: { '/api': `http://localhost:${process.env.VITE_API_PORT||3001}` } },
});
