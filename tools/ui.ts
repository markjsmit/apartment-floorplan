// npm run ui -- select <id> | clear | goto <room> [version] | look-at <id> | toast "<text>" | reload | state
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load-files';

const PORT = 5180;
const [cmd, ...rest] = process.argv.slice(2);

function usage(): never {
  console.log('usage: npm run ui -- select <id> | clear | goto <room> [version] | look-at <id> | toast "<text>" | reload | state');
  process.exit(cmd ? 1 : 0);
}

async function send(command: object) {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command),
    });
    const body = (await res.json()) as { clients: number };
    console.log(body.clients ? `sent to ${body.clients} open view(s)` : 'sent, but no browser tab is open');
  } catch {
    console.error(`dev server not reachable on :${PORT} — start it with npm run dev`);
    process.exit(1);
  }
}

switch (cmd) {
  case 'select':
  case 'look-at':
    if (!rest[0]) usage();
    await send({ type: cmd, id: rest[0] });
    break;
  case 'clear':
  case 'reload':
    await send({ type: cmd });
    break;
  case 'goto':
    if (!rest[0]) usage();
    await send({ type: 'goto', room: rest[0], ...(rest[1] ? { version: rest[1] } : {}) });
    break;
  case 'toast':
    await send({ type: 'toast', text: rest.join(' ') });
    break;
  case 'state': {
    const file = path.join(ROOT, '.ui-state/ui-state.json');
    console.log(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '(no ui state yet — is the viewer open?)');
    break;
  }
  default:
    usage();
}
