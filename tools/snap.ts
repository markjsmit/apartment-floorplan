// npm run snap -- <room> [version] [--cam x,z,yaw,pitch] [--top] [--person heli] [--mood day|golden|night] [--lights off|cozy|work] [--size 1280x800] [--states id:state,...] [--clean] [--out file.png]
// --clean hides the app's buttons and labels (render inputs).
// Renders the viewer headless and saves a PNG Claude can look at. Uses the running dev server on :5180,
// or starts a temporary one on :5181. Never reports UI state (noreport=1), so Mark's selection stays untouched.
import fs from 'node:fs';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { chromium } from 'playwright';
import { ROOT } from './load-files';

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--cam', '--person', '--mood', '--lights', '--size', '--out', '--states'];
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
const [room, version = 'current'] = positional;
if (!room) {
  console.log('usage: npm run snap -- <room> [version] [--cam x,z,yaw,pitch] [--top] [--person heli] [--mood day|golden|night] [--lights off|cozy|work] [--size 1280x800] [--states id:state,...] [--clean] [--out file.png]');
  process.exit(1);
}

async function reachable(url: string) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

let server: ViteDevServer | undefined;
let base = 'http://localhost:5180/';
if (!(await reachable(`${base}api/bundle`))) {
  server = await createServer({ root: ROOT, server: { port: 5181, strictPort: true }, logLevel: 'error' });
  await server.listen();
  base = 'http://localhost:5181/';
}

// fail loudly on a typo instead of silently photographing another room
const bundle = (await (await fetch(`${base}api/bundle`)).json()) as { versions: Record<string, { rooms: { id: string }[] }> };
const house = bundle.versions[version];
const problem = !house
  ? `unknown version "${version}" (have: ${Object.keys(bundle.versions).join(', ')})`
  : !house.rooms.some((r) => r.id === room)
    ? `unknown room "${room}" in ${version} (have: ${house.rooms.map((r) => r.id).join(', ')})`
    : null;
if (problem) {
  console.error(problem);
  await server?.close();
  process.exit(1);
}

const q = new URLSearchParams({ room, version, noreport: '1' });
if (flag('cam')) q.set('cam', flag('cam')!);
if (args.includes('--top')) q.set('view', 'top');
if (flag('person')) q.set('person', flag('person')!);
if (flag('mood')) q.set('mood', flag('mood')!);
if (flag('lights')) q.set('lights', flag('lights')!);
if (flag('states')) q.set('states', flag('states')!);
if (args.includes('--no-ao')) q.set('ao', '0');
const [w, h] = (flag('size') ?? '1280x800').split('x').map(Number);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?${q}`);
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 60000 });
  // models and textures that are still downloading
  await page.waitForFunction(() => !(window as { __loading?: boolean }).__loading, null, { timeout: 60000 });
  // a live dev-server stream (another session editing) can keep the network busy: don't wait forever
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  if (args.includes('--clean')) {
    await page.addStyleTag({ content: '.app > *:not(.viewer) { display: none !important; }' });
  }
  await page.waitForTimeout(800);
  const outDir = path.join(ROOT, '.snaps');
  fs.mkdirSync(outDir, { recursive: true });
  const out = flag('out') ?? path.join(outDir, `${room}-${version.replace(/\//g, '_')}${args.includes('--top') ? '-top' : ''}.png`);
  await page.screenshot({ path: out });
  console.log(out);
  if (errors.length) console.log(`page errors:\n${errors.join('\n')}`);
} finally {
  await browser.close();
  await server?.close();
}
