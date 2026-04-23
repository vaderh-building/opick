import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function newsletterPlugin() {
  return {
    name: 'opick-newsletter-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/newsletter', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const record = {
              email: String(parsed.email || '').trim().toLowerCase(),
              source: parsed.source || 'unknown',
              subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
              at: parsed.at || new Date().toISOString(),
            };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'invalid_email' }));
              return;
            }
            const file = path.resolve(process.cwd(), 'newsletter_signups.json');
            let list = [];
            try {
              if (fs.existsSync(file)) {
                list = JSON.parse(fs.readFileSync(file, 'utf8')) || [];
              }
            } catch {}
            list.push(record);
            fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
            res.statusCode = 201;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'server_error', message: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), newsletterPlugin()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});
