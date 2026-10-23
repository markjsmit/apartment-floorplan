import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadBundleFromDisk, ROOT } from './load-files';

// Dev: serves the house bundle, live-reloads it over SSE, writes the UI state for Claude, relays Claude's commands.
// Build: emits bundle.json and copies asset files (textures, models) to lib/.

const UI_DIR = path.join(ROOT, '.ui-state');
const MAX_EVENT_LINES = 500;

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.json': 'application/json', '.hdr': 'application/octet-stream',
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function json(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function appendEvent(event: unknown) {
  fs.mkdirSync(UI_DIR, { recursive: true });
  const file = path.join(UI_DIR, 'events.log');
  const line = JSON.stringify({ at: new Date().toISOString(), ...(event as object) });
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  lines.push(line);
  fs.writeFileSync(file, lines.slice(-MAX_EVENT_LINES).join('\n') + '\n');
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

export function housePlugin(): Plugin {
  const clients = new Set<ServerResponse>();
  const broadcast = (msg: unknown) => {
    for (const c of clients) c.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  return {
    name: 'house',
    configureServer(server) {
      const watched = [path.join(ROOT, 'house'), path.join(ROOT, 'assets'), path.join(ROOT, 'site.config.json')];
      server.watcher.add(watched);
      let timer: NodeJS.Timeout | undefined;
      server.watcher.on('all', (_event, file) => {
        if (!watched.some((w) => file.startsWith(w))) return;
        clearTimeout(timer);
        timer = setTimeout(() => broadcast({ type: 'reload' }), 150);
      });
      setInterval(() => {
        for (const c of clients) c.write(': ping\n\n');
      }, 20000).unref();

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        try {
          if (url === '/api/bundle' && req.method === 'GET') return json(res, loadBundleFromDisk());
          if (url === '/api/events' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            res.write(': connected\n\n');
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return;
          }
          if (url === '/api/ui-state' && req.method === 'POST') {
            const state = (await readBody(req)) as object;
            fs.mkdirSync(UI_DIR, { recursive: true });
            fs.writeFileSync(path.join(UI_DIR, 'ui-state.json'), JSON.stringify({ updatedAt: new Date().toISOString(), ...state }, null, 2) + '\n');
            return json(res, { ok: true });
          }
          if (url === '/api/event' && req.method === 'POST') {
            appendEvent(await readBody(req));
            return json(res, { ok: true });
          }
          if (url === '/api/command' && req.method === 'POST') {
            const command = await readBody(req);
            broadcast({ type: 'command', command });
            return json(res, { ok: true, clients: clients.size });
          }
          if (url.startsWith('/lib/')) {
            const file = path.join(ROOT, 'assets', decodeURIComponent(url.slice('/lib/'.length)));
            if (!file.startsWith(path.join(ROOT, 'assets')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
              res.statusCode = 404;
              return res.end();
            }
            res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
            return fs.createReadStream(file).pipe(res);
          }
        } catch (e) {
          return json(res, { ok: false, error: (e as Error).message }, 400);
        }
        next();
      });
    },

    generateBundle() {
      const bundle = loadBundleFromDisk();
      if (bundle.errors.length) {
        this.error(`house data has errors (run npm run check):\n${bundle.errors.map((e) => `${e.file}: ${e.message}`).join('\n')}`);
      }
      this.emitFile({ type: 'asset', fileName: 'bundle.json', source: JSON.stringify(bundle) });
      const assetsDir = path.join(ROOT, 'assets');
      for (const file of listFiles(assetsDir)) {
        if (file.endsWith('.json') || path.basename(file).startsWith('.')) continue;
        const rel = path.relative(assetsDir, file).split(path.sep).join('/');
        this.emitFile({ type: 'asset', fileName: `lib/${rel}`, source: fs.readFileSync(file) });
      }
    },
  };
}
